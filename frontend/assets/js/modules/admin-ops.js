/**
 * admin-ops.js - 管理端倉庫作業核心模組 (V2026 旗艦版)
 * 負責：包裹搜尋、入庫審核、分箱數據維護、運費精算、實拍照上傳
 */
import { apiClient } from "../api/apiClient.js";

export const adminOpsModule = {
  state: {
    currentParcel: null,
    subPackages: [], // 儲存當前分箱數據 [{l, w, h, weight}, ...]
    pricingRules: { volumeDivisor: 6000, rate: 150 }, // 預設試算規則
  },

  /**
   * 初始化：綁定搜尋與入庫列表
   */
  async init() {
    console.log("🏭 Admin Ops Module Initializing...");
    this.fetchParcels();
  },

  /**
   * 從管理端 API 獲取包裹列表 (對應 /api/admin/packages)
   */
  async fetchParcels() {
    const tbody = document.getElementById("admin-parcels-table-body");
    if (!tbody) return;

    try {
      const res = await apiClient.get("/api/admin/packages");
      const parcels = res.data || [];

      tbody.innerHTML = parcels
        .map(
          (p) => `
        <tr>
          <td style="font-family:monospace; font-weight:700;">${
            p.trackingNumber
          }</td>
          <td><span class="badge-${p.status.toLowerCase()}">${this.statusText(
            p.status
          )}</span></td>
          <td>${p.user?.name || "無主件"} (${p.user?.piggyId || "---"})</td>
          <td>${p.weight || 0} kg / ${p.shippingFee || 0} TWD</td>
          <td class="text-right">
            <button class="btn-admin-sm" onclick="window.adminOpsModule.openEditModal('${
              p.id
            }')">
              <i class="fas fa-edit"></i> 處理入庫
            </button>
          </td>
        </tr>
      `
        )
        .join("");
    } catch (err) {
      console.error("載入包裹列表失敗:", err);
    }
  },

  /**
   * 開啟入庫編輯彈窗並填入資料
   */
  async openEditModal(id) {
    try {
      const res = await apiClient.get(`/api/admin/packages/${id}`);
      const p = res.data;
      this.state.currentParcel = p;
      this.state.subPackages = p.boxes || [
        { length: 0, width: 0, height: 0, weight: 0 },
      ];

      // 1. 喚起彈窗 (對接 modal-manager)
      window.modalManager.open("parcel-edit-modal");

      // 2. 異步等待 DOM 渲染後填值
      setTimeout(() => {
        document.getElementById("modal-pkg-id").value = p.id;
        document.getElementById("modal-trackingNumber").value =
          p.trackingNumber;
        document.getElementById("modal-status").value = p.status;
        document.getElementById("modal-productName").value =
          p.productName || "";
        document.getElementById("modal-quantity").value = p.quantity || 1;
        document.getElementById("modal-user-display").innerText = p.user
          ? `${p.user.name} (${p.user.piggyId})`
          : "⚠️ 此為無主件，請手動歸屬";

        this.renderSubPackages();
        this.calculateAutoFee();
      }, 100);
    } catch (err) {
      alert("讀取包裹詳情失敗");
    }
  },

  /**
   * 渲染分箱輸入列 (動態 DOM)
   */
  renderSubPackages() {
    const container = document.getElementById("sub-package-list");
    if (!container) return;

    container.innerHTML = this.state.subPackages
      .map(
        (box, index) => `
      <div class="sub-pkg-row">
        <input type="number" class="sub-pkg-input" placeholder="長" value="${box.length}" oninput="window.adminOpsModule.updateBoxData(${index}, 'length', this.value)">
        <input type="number" class="sub-pkg-input" placeholder="寬" value="${box.width}" oninput="window.adminOpsModule.updateBoxData(${index}, 'width', this.value)">
        <input type="number" class="sub-pkg-input" placeholder="高" value="${box.height}" oninput="window.adminOpsModule.updateBoxData(${index}, 'height', this.value)">
        <input type="number" class="sub-pkg-input" placeholder="重" value="${box.weight}" oninput="window.adminOpsModule.updateBoxData(${index}, 'weight', this.value)">
        <button type="button" class="btn-remove-box" onclick="window.adminOpsModule.removeBox(${index})">&times;</button>
      </div>
    `
      )
      .join("");

    // 綁定增加按鈕
    const btnAdd = document.getElementById("btn-add-sub-package");
    if (btnAdd) btnAdd.onclick = () => this.addBox();
  },

  addBox() {
    this.state.subPackages.push({ length: 0, width: 0, height: 0, weight: 0 });
    this.renderSubPackages();
  },

  removeBox(index) {
    if (this.state.subPackages.length <= 1) return;
    this.state.subPackages.splice(index, 1);
    this.renderSubPackages();
    this.calculateAutoFee();
  },

  updateBoxData(index, field, value) {
    this.state.subPackages[index][field] = parseFloat(value) || 0;
    this.calculateAutoFee();
  },

  /**
   * 運費試算邏輯：深度還原舊版擇優計算
   */
  calculateAutoFee() {
    let totalWeight = 0;
    let totalVolWeight = 0;

    this.state.subPackages.forEach((box) => {
      totalWeight += box.weight;
      totalVolWeight += (box.length * box.width * box.height) / 6000;
    });

    const finalChargeWeight = Math.max(totalWeight, totalVolWeight);
    const estimatedFee = Math.ceil(finalChargeWeight * 150); // 假設每公斤 150 TWD

    const display = document.getElementById("modal-shippingFee-display");
    if (display) display.innerText = estimatedFee.toLocaleString();
  },

  /**
   * 儲存入庫變更：處理 FormData 與圖片
   */
  async saveParcelDetails() {
    const id = document.getElementById("modal-pkg-id").value;
    const formData = new FormData();

    formData.append("status", document.getElementById("modal-status").value);
    formData.append(
      "productName",
      document.getElementById("modal-productName").value
    );
    formData.append(
      "quantity",
      document.getElementById("modal-quantity").value
    );
    formData.append("boxes", JSON.stringify(this.state.subPackages));

    // 處理圖片上傳
    const fileInput = document.getElementById("modal-warehouseImages");
    if (fileInput && fileInput.files.length > 0) {
      for (let i = 0; i < fileInput.files.length; i++) {
        formData.append("warehouseImages", fileInput.files[i]);
      }
    }

    try {
      const res = await apiClient.put(`/api/admin/packages/${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.success) {
        alert("包裹入庫更新成功！");
        window.modalManager.close();
        this.fetchParcels();
      }
    } catch (err) {
      alert("儲存失敗：" + err.message);
    }
  },

  statusText(status) {
    const map = {
      PENDING: "待入庫",
      ARRIVED: "已在倉",
      IN_SHIPMENT: "集運中",
      COMPLETED: "已收貨",
    };
    return map[status] || status;
  },
};

// 曝露給全域供彈窗與列表呼叫
window.adminOpsModule = adminOpsModule;
