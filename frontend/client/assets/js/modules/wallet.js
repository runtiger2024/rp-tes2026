// frontend/client/assets/js/modules/wallet.js
import { apiClient } from "../../../api/apiClient.js";

export const walletModule = {
  /**
   * 處理圖片網址修復 (整合自原始碼 getImageUrl)
   */
  formatImageUrl(path) {
    if (!path) return null;
    if (path.startsWith("http")) {
      return path.replace(/^https?:\/+(?!\/)/, "https://"); // 修復單斜線損毀
    }
    return `${apiClient.BASE_URL.replace("/api/v1", "")}/${path.replace(
      /^\//,
      ""
    )}`;
  },

  /**
   * 提交儲值申請 (Multipart 檔案上傳)
   */
  async requestDeposit(amount, description, file) {
    const fd = new FormData();
    fd.append("amount", amount);
    fd.append("description", description);
    fd.append("proof", file);

    return await apiClient.upload("/client/wallet/deposit", fd);
  },

  /**
   * 取得銀行帳號資訊
   */
  async getBankInfo() {
    const data = await apiClient.get("/client/settings/public");
    return data.settings.bank_info || null;
  },

  /**
   * 渲染交易紀錄列表
   */
  renderTransactions(container, transactions) {
    if (!transactions.length) {
      container.innerHTML = `<div class="empty-state">目前尚無交易紀錄</div>`;
      return;
    }

    container.innerHTML = transactions
      .map(
        (tx) => `
      <div class="transaction-item animate-fade-in">
        <div class="tx-info">
          <div class="tx-type">${tx.type === "RECHARGE" ? "儲值" : "支付"}</div>
          <div class="tx-date">${new Date(
            tx.createdAt
          ).toLocaleDateString()}</div>
        </div>
        <div class="tx-amount ${
          tx.amount > 0 ? "text-success" : "text-danger"
        }">
          ${tx.amount > 0 ? "+" : ""}${tx.amount.toLocaleString()}
        </div>
      </div>
    `
      )
      .join("");
  },
};
