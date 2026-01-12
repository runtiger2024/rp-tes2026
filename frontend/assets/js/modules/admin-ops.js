/**
 * admin-ops.js - V2026.01.Final_Pro
 * 管理端倉庫作業核心模組
 * * 負責功能：
 * 1. 包裹全域搜尋與分頁渲染
 * 2. 入庫審核與狀態流轉 (入庫照上傳)
 * 3. 動態多箱作業 (長/寬/高/重量)
 * 4. 運費擇優試算 (體積重 vs 實際重)
 * 5. 無主件歸屬與異常標記
 */

import { apiClient } from "../api/apiClient.js";

export const adminOpsModule = {
  state: {
    allParcels: [],
    filteredParcels: [],
    currentParcel: null,
    subPackages: [], // 儲存當前分箱數據 [{length, width, height, weight}, ...]
    searchKeyword: "",
    statusFilter: "all",
    // 試算參數：可由後端動態覆蓋
    pricing: {
      volumeDivisor: 6000,
      unitPrice: 150, // 假設每公斤 150 TWD
    },
  },

  /**
   * 初始化模組
   */
  async init() {
    console.log("🏭 [Admin Ops] 倉庫模組啟動中...");
    this.bindSearchEvents();
    await this.fetchParcels();
  },

  /**
   * 綁定搜尋與過濾事件
   */
  bindSearchEvents() {
    const searchInput = document.getElementById("admin-ops-search");
    const filterSelect = document.getElementById("admin-ops-filter");

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.state.searchKeyword = e.target.value.trim().toLowerCase();
        this.applyFilters();
      });
    }

    if (filterSelect) {
      filterSelect.addEventListener("change", (e) => {
        this.state.statusFilter = e.target.value;
        this.applyFilters();
      });
    }
  },

  /**
   * 從 API 獲取包裹清單
   */
  async fetchParcels() {
    try {
      // 對接後端 /api/admin/packages
      const res = await apiClient.get("/api/admin/packages");
      this.state.allParcels = res.data || [];
      this.applyFilters();
    } catch (err) {
      console.error("載入包裹列表失敗:", err);
    }
  },

  /**
   * 執行前端過濾與渲染
   */
  applyFilters() {
    const { allParcels, searchKeyword, statusFilter } = this.state;

    this.state.filteredParcels = allParcels.filter((p) => {
      const matchSearch =
        p.trackingNumber.toLowerCase().includes(searchKeyword) ||
        (p.user?.name || "").toLowerCase().includes(searchKeyword) ||
        (p.user?.piggyId || "").toLowerCase().includes(searchKeyword);

      const matchStatus = statusFilter === "all" || p.status === statusFilter;

      return matchSearch && matchStatus;
    });

    this.renderParcelTable();
  },

  /**
   * 渲染包裹表格
   */
  renderParcelTable() {
    const tbody = document.getElementById("admin-parcels-table-body");
    if (!tbody) return;

    if (this.state.filteredParcels.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">找不到符合條件的包裹</td></tr>`;
      return;
    }

    tbody.innerHTML = this.state.filteredParcels
      .map(
        (p) => `
      <tr>
        <td class="font-monospace fw-bold text-primary">${p.trackingNumber}</td>
        <td>${this.renderStatusBadge(p.status)}</td>
        <td>
          <div class="fw-bold">${p.user?.name || "無主件"}</div>
          <div class="small text-muted">ID: ${p.user?.piggyId || "---"}</div>
        </td>
        <td>
          <div class="small text-muted">重量: ${p.weight || 0} kg</div>
          <div class="small text-muted">材積: ${p.volumeCBM || 0} m³</div>
        </td>
        <td class="fw-bold text-success">$${(
          p.shippingFee || 0
        ).toLocaleString()}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-primary" onclick="adminOpsModule.openEditModal('${
            p.id
          }')">
            <i class="fas fa-barcode"></i> 處理入庫
          </button>
        </td>
      </tr>
    `
      )
      .join("");
  },

  /**
   * 開啟入庫編輯彈窗 (核心功能)
   */
  async openEditModal(id) {
    try {
      const res = await apiClient.get(`/api/admin/packages/${id}`);
      const p = res.data;
      this.state.currentParcel = p;

      // 深度還原分箱數據：若無分箱則預設給一組空的
      this.state.subPackages =
        p.boxes && p.boxes.length > 0
          ? p.boxes.map((b) => ({
              length: b.length,
              width: b.width,
              height: b.height,
              weight: b.weight,
            }))
          : [{ length: 0, width: 0, height: 0, weight: 0 }];

      window.modalManager.open("parcel-edit-modal");

      // 異步等待 DOM 填充
      setTimeout(() => {
        document.getElementById("modal-pkg-id").value = p.id;
        document.getElementById("modal-trackingNumber").value =
          p.trackingNumber;
        document.getElementById("modal-status").value =
          p.status === "PENDING" ? "ARRIVED" : p.status;
        document.getElementById("modal-productName").value =
          p.productName || "";
        document.getElementById("modal-user-display").innerText = p.user
          ? `${p.user.name} (${p.user.piggyId})`
          : "⚠️ 未知客戶 (無主件)";

        this.renderSubPackageInputs();
        this.calculateAutoFee();
      }, 150);
    } catch (err) {
      alert("讀取詳情失敗: " + err.message);
    }
  },

  /**
   * 渲染動態分箱輸入框
   */
  renderSubPackageInputs() {
    const container = document.getElementById("sub-package-list");
    if (!container) return;

    container.innerHTML = this.state.subPackages
      .map(
        (box, index) => `
      <div class="box-input-row animate__animated animate__fadeIn">
        <div class="row g-2 mb-2 align-items-center">
          <div class="col-2"><input type="number" class="form-control" placeholder="長" value="${box.length}" oninput="adminOpsModule.updateBoxData(${index}, 'length', this.value)"></div>
          <div class="col-2"><input type="number" class="form-control" placeholder="寬" value="${box.width}" oninput="adminOpsModule.updateBoxData(${index}, 'width', this.value)"></div>
          <div class="col-2"><input type="number" class="form-control" placeholder="高" value="${box.height}" oninput="adminOpsModule.updateBoxData(${index}, 'height', this.value)"></div>
          <div class="col-3"><input type="number" class="form-control fw-bold" placeholder="重量" value="${box.weight}" oninput="adminOpsModule.updateBoxData(${index}, 'weight', this.value)"></div>
          <div class="col-2"><button type="button" class="btn btn-outline-danger w-100" onclick="adminOpsModule.removeBox(${index})"><i class="fas fa-times"></i></button></div>
        </div>
      </div>
    `
      )
      .join("");
  },

  addBox() {
    this.state.subPackages.push({ length: 0, width: 0, height: 0, weight: 0 });
    this.renderSubPackageInputs();
  },

  removeBox(index) {
    if (this.state.subPackages.length <= 1) return;
    this.state.subPackages.splice(index, 1);
    this.renderSubPackageInputs();
    this.calculateAutoFee();
  },

  updateBoxData(index, field, value) {
    this.state.subPackages[index][field] = parseFloat(value) || 0;
    this.calculateAutoFee();
  },

  /**
   * 運費試算邏輯：擇優計費 (體積重 vs 實際重)
   */
  calculateAutoFee() {
    let totalActualWeight = 0;
    let totalVolumeWeight = 0;

    this.state.subPackages.forEach((box) => {
      const volWeight =
        (box.length * box.width * box.height) /
        this.state.pricing.volumeDivisor;
      totalActualWeight += box.weight;
      totalVolumeWeight += volWeight;
    });

    // 擇優計費
    const finalWeight = Math.max(totalActualWeight, totalVolumeWeight);
    const estimatedFee = Math.ceil(finalWeight * this.state.pricing.unitPrice);

    // 更新介面
    const feeDisplay = document.getElementById("modal-shippingFee-display");
    const weightDisplay = document.getElementById("modal-calc-weight-display");

    if (feeDisplay) feeDisplay.innerText = estimatedFee.toLocaleString();
    if (weightDisplay)
      weightDisplay.innerText = `${finalWeight.toFixed(2)} kg (擇優後)`;
  },

  /**
   * 儲存入庫變更 (處理圖片與 JSON 分箱數據)
   */
  async saveParcelDetails() {
    const id = document.getElementById("modal-pkg-id").value;
    const btn = document.querySelector("#parcel-edit-modal .btn-save");

    const formData = new FormData();
    formData.append("status", document.getElementById("modal-status").value);
    formData.append(
      "productName",
      document.getElementById("modal-productName").value
    );

    // 將分箱數據序列化傳送
    formData.append("boxes", JSON.stringify(this.state.subPackages));

    // 處理入庫實拍照
    const fileInput = document.getElementById("modal-warehouseImages");
    if (fileInput && fileInput.files.length > 0) {
      for (let i = 0; i < fileInput.files.length; i++) {
        formData.append("warehouseImages", fileInput.files[i]);
      }
    }

    try {
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 儲存中...';
      }

      const res = await apiClient.put(`/api/admin/packages/${id}`, formData);

      if (res.success) {
        alert("包裹入庫更新完成！運費已自動重新核算。");
        window.modalManager.close();
        await this.fetchParcels();
      }
    } catch (err) {
      alert("儲存失敗：" + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = "儲存入庫資訊";
      }
    }
  },

  /**
   * 狀態標籤美化
   */
  renderStatusBadge(status) {
    const maps = {
      PENDING: { text: "待入庫", class: "bg-warning" },
      ARRIVED: { text: "已入庫", class: "bg-success" },
      IN_SHIPMENT: { text: "集運中", class: "bg-info text-dark" },
      COMPLETED: { text: "已完結", class: "bg-secondary" },
      EXCEPTION: { text: "異常件", class: "bg-danger" },
    };
    const s = maps[status] || { text: status, class: "bg-light text-dark" };
    return `<span class="badge ${s.class}">${s.text}</span>`;
  },
};

// 曝露給全域以供 HTML 內部的 onclick 呼叫
window.adminOpsModule = adminOpsModule;
