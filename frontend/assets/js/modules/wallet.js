/**
 * wallet.js - 錢包與財務管理核心模組 (V2026 旗艦版)
 * 負責：餘額同步、交易明細渲染、類型過濾與財務狀態展示
 */
import { apiClient } from "../api/apiClient.js";

export const walletModule = {
  state: {
    balance: 0,
    allTransactions: [],
    currentFilter: "all",
  },

  /**
   * 初始化：讀取數據並綁定過濾事件
   */
  async init() {
    console.log("💰 Wallet Module Initializing...");
    this.bindEvents();
    await this.fetchData();
  },

  bindEvents() {
    // 綁定 Filter Chips (交易類型切換)
    const filterChips = document.querySelectorAll(".filter-chip");
    filterChips.forEach((chip) => {
      chip.addEventListener("click", () => {
        filterChips.forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");

        const type = chip.getAttribute("data-type");
        this.filterTransactions(type);
      });
    });

    // 重新整理按鈕 (若 UI 有此 ID)
    const btnSync = document.getElementById("btn-wallet-sync");
    if (btnSync) {
      btnSync.addEventListener("click", () => this.fetchData());
    }
  },

  /**
   * 同步獲取最新餘額與所有交易紀錄
   */
  async fetchData() {
    const loadingIndicator = document.getElementById("tx-loading-indicator");
    if (loadingIndicator) loadingIndicator.style.display = "block";

    try {
      // 1. 獲取餘額 (對應後端 /api/wallet/balance)
      const balanceRes = await apiClient.get("/api/wallet/balance");
      this.state.balance = balanceRes.data.balance || 0;
      this.updateBalanceUI();

      // 2. 獲取交易紀錄 (對應後端 /api/wallet/transactions)
      const txRes = await apiClient.get("/api/wallet/transactions");
      this.state.allTransactions = txRes.data || [];
      this.renderList();
    } catch (error) {
      console.error("Wallet data fetch failed:", error);
    } finally {
      if (loadingIndicator) loadingIndicator.style.display = "none";
    }
  },

  /**
   * 更新頂部 Hero Card 的金額顯示
   */
  updateBalanceUI() {
    const balanceDisplay = document.getElementById("dashboard-user-balance");
    if (balanceDisplay) {
      // 深度還原：千分位格式化
      balanceDisplay.innerText = this.state.balance.toLocaleString();
    }
  },

  /**
   * 執行過濾邏輯
   */
  filterTransactions(type) {
    this.state.currentFilter = type;
    this.renderList();
  },

  /**
   * 渲染交易列表：深度對位 wallet.html 的卡片結構
   */
  renderList() {
    const container = document.getElementById("transaction-list");
    const emptyState = document.getElementById("tx-empty-state");
    if (!container) return;

    // 執行過濾
    const filtered = this.state.allTransactions.filter((tx) => {
      return (
        this.state.currentFilter === "all" ||
        tx.type === this.state.currentFilter
      );
    });

    if (filtered.length === 0) {
      container.innerHTML = "";
      if (emptyState) emptyState.style.display = "block";
      return;
    } else {
      if (emptyState) emptyState.style.display = "none";
    }

    // 深度還原：根據交易類型渲染特定樣式
    container.innerHTML = filtered
      .map((tx) => {
        const isPlus = tx.type === "DEPOSIT" || tx.type === "REFUND";
        const amountPrefix = isPlus ? "+" : "-";
        const amountClass = isPlus ? "amt-plus" : "amt-minus";
        const iconClass = this.renderTypeIcon(tx.type);
        const bgClass = this.renderBgClass(tx.type);

        return `
        <div class="tx-card animate-slide-up" onclick="window.walletModule.showTxDetail('${
          tx.id
        }')">
          <div class="tx-left">
            <div class="tx-icon ${bgClass}">
              <i class="${iconClass}"></i>
            </div>
            <div class="tx-info">
              <div class="title">${
                tx.description || this.renderTypeText(tx.type)
              }</div>
              <div class="date">${new Date(tx.createdAt).toLocaleString()}</div>
            </div>
          </div>
          <div class="tx-right">
            <div class="tx-amount ${amountClass}">
              ${amountPrefix} ${tx.amount.toLocaleString()}
            </div>
            <div class="tx-status">${
              tx.status === "COMPLETED" ? "交易成功" : "處理中"
            }</div>
          </div>
        </div>
      `;
      })
      .join("");
  },

  /**
   * 輔助函式：類型文字還原
   */
  renderTypeText(type) {
    const map = {
      DEPOSIT: "餘額儲值",
      PAYMENT: "運費扣款",
      REFUND: "系統退款",
    };
    return map[type] || "帳務異動";
  },

  /**
   * 輔助函式：圖標對位
   */
  renderTypeIcon(type) {
    const map = {
      DEPOSIT: "fas fa-arrow-up",
      PAYMENT: "fas fa-shopping-bag",
      REFUND: "fas fa-undo",
    };
    return map[type] || "fas fa-exchange-alt";
  },

  /**
   * 輔助函式：背景色對位
   */
  renderBgClass(type) {
    const map = {
      DEPOSIT: "bg-deposit",
      PAYMENT: "bg-payment",
      REFUND: "bg-refund",
    };
    return map[type] || "";
  },

  /**
   * 點擊明細詳情 (未來擴充功能)
   */
  showTxDetail(txId) {
    console.log("Transaction Detail View:", txId);
    // 可在此對接一個 transaction-modal
  },
};

// 曝露給全域供 wallet.html 使用
window.walletModule = walletModule;
