/**
 * admin-shipment.js - 管理端訂單處理核心模組 (V2026 旗艦版)
 * 負責：訂單列表稽核、運費核價(Audit)、支付審查、狀態變更、列印分頁對接
 */
import { apiClient } from "../api/apiClient.js";

export const adminShipmentModule = {
  state: {
    allShipments: [],
    currentShipment: null,
    filterStatus: "all",
    searchTerm: "",
  },

  /**
   * 初始化：加載數據與綁定搜尋
   */
  async init() {
    console.log("🚢 Admin Shipment Module Initializing...");
    this.bindEvents();
    this.fetchShipments();
  },

  bindEvents() {
    const searchBtn = document.getElementById("btn-admin-shipment-search");
    if (searchBtn) {
      searchBtn.addEventListener("click", () => {
        this.state.searchTerm =
          document.getElementById("admin-shipment-search-input")?.value || "";
        this.state.filterStatus =
          document.getElementById("admin-shipment-status-filter")?.value ||
          "all";
        this.fetchShipments();
      });
    }
  },

  /**
   * 獲取並渲染管理端訂單列表
   */
  async fetchShipments() {
    const tbody = document.getElementById("admin-shipments-table-body");
    if (!tbody) return;

    try {
      // 對接 /api/admin/shipments
      const res = await apiClient.get("/api/admin/shipments", {
        params: {
          status: this.state.filterStatus,
          search: this.state.searchTerm,
        },
      });
      this.state.allShipments = res.data || [];

      tbody.innerHTML = this.state.allShipments
        .map(
          (s) => `
        <tr>
          <td>
            <div style="font-family:monospace; font-weight:700; color:#1a73e8; cursor:pointer;" onclick="window.adminShipmentModule.openAdminModal('${
              s.id
            }')">
              ${s.id.substring(0, 8).toUpperCase()}
            </div>
            <div style="font-size:11px; color:#94a3b8;">${new Date(
              s.createdAt
            ).toLocaleDateString()}</div>
          </td>
          <td>${this.renderStatusBadge(s.status)}</td>
          <td>
            <div style="font-weight:700;">${s.recipientName}</div>
            <div style="font-size:11px; color:#64748b;">UID: ${
              s.user?.piggyId || "---"
            }</div>
          </td>
          <td>
            <div style="font-weight:800;">NT$ ${
              s.totalFee?.toLocaleString() || 0
            }</div>
            <div style="font-size:11px; color:${
              s.paymentStatus === "PAID" ? "#22c55e" : "#f5222d"
            };">
              ${s.paymentStatus === "PAID" ? "● 已入帳" : "○ 待核款"}
            </div>
          </td>
          <td class="text-right">
            <button class="btn-admin-sm" onclick="window.adminShipmentModule.openAdminModal('${
              s.id
            }')">
              <i class="fas fa-tools"></i> 維護
            </button>
            <button class="btn-admin-sm secondary" onclick="window.adminShipmentModule.printShipment('${
              s.id
            }')">
              <i class="fas fa-print"></i>
            </button>
          </td>
        </tr>
      `
        )
        .join("");
    } catch (err) {
      console.error("載入訂單列表失敗:", err);
    }
  },

  /**
   * 打開高級管理彈窗 (對接 shipment-admin-modal.html)
   */
  async openAdminModal(id) {
    try {
      const res = await apiClient.get(`/api/admin/shipments/${id}`);
      const s = res.data;
      this.state.currentShipment = s;

      window.modalManager.open("shipment-admin-modal");

      // 深度對位 DOM 填值
      setTimeout(() => {
        document.getElementById("edit-shipment-id").value = s.id;
        document.getElementById("m-recipient").innerText = s.recipientName;
        document.getElementById("m-phone").innerText = s.recipientPhone;
        document.getElementById("m-user").innerText = s.user?.name;
        document.getElementById(
          "m-piggy-id"
        ).innerText = `(${s.user?.piggyId})`;

        // 渲染包含的包裹
        this.renderPackageList(s.packages);

        // 狀態與數值
        document.getElementById("m-status").value = s.status;
        document.getElementById("m-cost").value = s.totalFee;
        document.getElementById("m-tracking-tw").value =
          s.trackingNumberTW || "";
        document.getElementById("m-loading-date").value = s.loadingDate
          ? s.loadingDate.split("T")[0]
          : "";
        document.getElementById("m-note").value = s.adminNote || "";

        // 財務稽核區塊控制
        const auditBox = document.getElementById("audit-action-section");
        if (s.status === "AWAITING_REVIEW") {
          auditBox.style.display = "block";
          document.getElementById("m-audit-cost").value = s.totalFee;
        } else {
          auditBox.style.display = "none";
        }

        // 支付憑證預覽
        const proofBox = document.getElementById("m-proof");
        if (s.paymentProof) {
          proofBox.innerHTML = `<img src="${s.paymentProof}" style="width:100%; cursor:zoom-in;" onclick="window.open(this.src)">`;
        } else {
          proofBox.innerHTML = `<span style="color:#94a3b8; font-size:12px;">尚未上傳憑證</span>`;
        }
      }, 150);
    } catch (err) {
      alert("讀取訂單詳情失敗");
    }
  },

  renderPackageList(pkgs) {
    const tbody = document.getElementById("m-packages-list-body");
    if (!tbody) return;
    tbody.innerHTML = pkgs
      .map(
        (p) => `
      <tr>
        <td class="text-center">
          <img src="${
            p.warehouseImages?.[0] || "assets/no-img.png"
          }" class="pkg-thumb">
        </td>
        <td>
          <div style="font-weight:700; font-size:12px;">${p.productName}</div>
          <div style="font-family:monospace; font-size:11px; color:#64748b;">${
            p.trackingNumber
          }</div>
        </td>
        <td><span class="badge-mini">${p.category || "一般"}</span></td>
        <td style="font-size:11px;">${p.weight}kg / ${p.volumeCBM}m³</td>
        <td class="text-right" style="font-weight:700;">$${p.shippingFee}</td>
      </tr>
    `
      )
      .join("");
  },

  /**
   * 提交訂單變更 (含 TW 單號、狀態更新)
   */
  async updateShipmentDetails() {
    const id = document.getElementById("edit-shipment-id").value;
    const body = {
      status: document.getElementById("m-status").value,
      totalFee: parseFloat(document.getElementById("m-cost").value),
      trackingNumberTW: document.getElementById("m-tracking-tw").value,
      loadingDate: document.getElementById("m-loading-date").value,
      adminNote: document.getElementById("m-note").value,
    };

    try {
      await apiClient.put(`/api/admin/shipments/${id}`, body);
      alert("訂單更新成功！");
      window.modalManager.close();
      this.fetchShipments();
    } catch (err) {
      alert("更新失敗：" + err.message);
    }
  },

  /**
   * 核價通過 (對接 AWAITING_REVIEW 審核邏輯)
   */
  window_approveShipment: async function () {
    const id = document.getElementById("edit-shipment-id").value;
    const finalCost = document.getElementById("m-audit-cost").value;
    const auditNote = document.getElementById("m-audit-note").value;

    try {
      await apiClient.post(`/api/admin/shipments/${id}/approve`, {
        finalCost,
        auditNote,
      });
      alert("訂單已核價完成，並通知用戶付款。");
      window.modalManager.close();
      this.fetchShipments();
    } catch (err) {
      alert("核價失敗：" + err.message);
    }
  },

  /**
   * 退回訂單：取消訂單並將包裹狀態設回 ARRIVED
   */
  async returnShipment() {
    const id = document.getElementById("edit-shipment-id").value;
    try {
      await apiClient.post(`/api/admin/shipments/${id}/return`);
      alert("訂單已退回，內部包裹已恢復為『在倉』狀態。");
      window.modalManager.close();
      this.fetchShipments();
    } catch (err) {
      alert("退單失敗：" + err.message);
    }
  },

  /**
   * 開啟列印分頁 (完全還原舊版跳轉邏輯)
   */
  printShipment(id) {
    window.open(`shipment-print.html?id=${id}`, "_blank");
  },

  renderStatusBadge(status) {
    const maps = {
      AWAITING_REVIEW: { text: "待核價", class: "badge-warning" },
      PENDING_PAYMENT: { text: "待付款", class: "badge-danger" },
      PROCESSING: { text: "已收貨", class: "badge-info" },
      SHIPPED: { text: "已裝櫃", class: "badge-primary" },
      COMPLETED: { text: "已完成", class: "badge-success" },
      CANCELLED: { text: "已取消", class: "badge-secondary" },
    };
    const s = maps[status] || { text: status, class: "" };
    return `<span class="status-badge ${s.class}">${s.text}</span>`;
  },
};

// 曝露給全域以供 HTML 使用
window.adminShipmentModule = adminShipmentModule;
window.approveShipment = adminShipmentModule.window_approveShipment; // 相容 HTML onclick
