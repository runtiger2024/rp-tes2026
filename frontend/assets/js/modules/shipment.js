/**
 * shipment.js - 集運訂單管理核心模組 (V2026 旗艦版)
 * 負責：歷史訂單列表渲染、狀態過濾、查看詳情報告與付款連動
 */
import { apiClient } from "../api/apiClient.js";

export const shipmentModule = {
  state: {
    allShipments: [],
    currentStatus: "all",
  },

  /**
   * 初始化：綁定 UI 事件
   */
  init() {
    console.log("🚢 Shipment Module Initializing...");
    this.bindEvents();
    this.fetchShipments();
  },

  bindEvents() {
    // 1. 綁定 Filter Chips (狀態切換按鈕)
    const filterChips = document.querySelectorAll(".order-filter-chip");
    filterChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        // 更新 UI 狀態
        filterChips.forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");

        // 更新數據狀態並重新渲染
        this.state.currentStatus = chip.getAttribute("data-status");
        this.renderList();
      });
    });
  },

  /**
   * 從 API 獲取集運單資料
   */
  async fetchShipments() {
    try {
      const response = await apiClient.get("/api/shipments");
      this.state.allShipments = response.data || [];
      this.renderList();
    } catch (error) {
      console.error("Failed to fetch shipments:", error);
      const container = document.getElementById("shipments-table-body");
      if (container) {
        container.innerHTML = `<tr><td colspan="5" class="text-center text-danger">數據同步失敗，請檢查網路連線。</td></tr>`;
      }
    }
  },

  /**
   * 執行渲染邏輯：深度對位 shipments.html 的表格結構
   */
  renderList() {
    const container = document.getElementById("shipments-table-body");
    const emptyState = document.getElementById("shipments-empty-state");
    if (!container) return;

    // 執行過濾邏輯
    const filtered = this.state.allShipments.filter((s) => {
      return (
        this.state.currentStatus === "all" ||
        s.status === this.state.currentStatus
      );
    });

    // 處理空數據顯示
    if (filtered.length === 0) {
      container.innerHTML = "";
      if (emptyState) emptyState.style.display = "block";
      return;
    } else {
      if (emptyState) emptyState.style.display = "none";
    }

    // 深度還原：生成表格列 HTML
    container.innerHTML = filtered
      .map(
        (s) => `
      <tr>
        <td>
          <a href="javascript:void(0)" class="order-id-link" onclick="window.shipmentModule.viewDetails('${
            s.id
          }')">
            ${s.id.substring(0, 8).toUpperCase()}
          </a>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">
            ${new Date(s.createdAt).toLocaleDateString()}
          </div>
        </td>
        <td>${this.renderStatusBadge(s.status)}</td>
        <td>
          <div style="font-weight: 700; color: #334155;">${
            s.recipientName || "未填寫"
          }</div>
          <div style="font-size: 12px; color: #64748b;">${
            s.packageCount || 0
          } 件包裹</div>
        </td>
        <td>
          <div style="font-family: 'Monaco', monospace; font-weight: 800; color: #1e293b;">
            NT$ ${s.totalFee ? s.totalFee.toLocaleString() : 0}
          </div>
          <div style="font-size: 11px; color: ${
            s.paymentStatus === "PAID" ? "#22c55e" : "#f5222d"
          };">
            ${s.paymentStatus === "PAID" ? "● 已入帳" : "○ 待核款"}
          </div>
        </td>
        <td class="text-center">
          <div class="order-btn-group">
            <button class="btn-order-action" onclick="window.shipmentModule.viewDetails('${
              s.id
            }')">
              <i class="fas fa-search-dollar"></i> 詳情
            </button>
            ${
              s.status === "UNPAID"
                ? `
              <button class="btn-order-action btn-pay-now" onclick="window.shipmentModule.payNow('${s.id}')">
                <i class="fas fa-credit-card"></i> 付款
              </button>
            `
                : ""
            }
          </div>
        </td>
      </tr>
    `
      )
      .join("");
  },

  /**
   * 深度還原：狀態標籤色彩
   */
  renderStatusBadge(status) {
    const maps = {
      UNPAID: { text: "待付款", class: "os-unpaid" },
      PENDING: { text: "待發貨", class: "os-pending" },
      SHIPPED: { text: "運輸中", class: "os-shipped" },
      ARRIVED: { text: "已送達", class: "os-arrived" },
      CANCELLED: { text: "已取消", class: "os-cancelled" },
    };
    const s = maps[status] || { text: status, class: "" };
    return `<span class="order-status-badge ${s.class}">${s.text}</span>`;
  },

  /**
   * 呼叫詳情報告彈窗 (對接 modal-manager)
   */
  viewDetails(id) {
    window.modalManager.open("shipment-details", { id });
  },

  /**
   * 呼叫付款資訊彈窗 (對接之前做的 bank-info-modal)
   */
  payNow(id) {
    window.modalManager.open("bank-info-modal", { shipmentId: id });
  },
};

// 曝露給全域以供 HTML onclick 使用
window.shipmentModule = shipmentModule;
