/**
 * recipient.js - 常用收件人管理核心模組 (V2026 旗艦版)
 * 負責：地址簿渲染、新增/編輯/刪除操作、預設收件人切換
 */
import { apiClient } from "../api/apiClient.js";

export const recipientModule = {
  state: {
    allRecipients: [],
    isLoading: false,
  },

  /**
   * 初始化：綁定 UI 事件並讀取資料
   */
  async init() {
    console.log("📇 Recipient Module Initializing...");
    this.bindEvents();
    await this.fetchRecipients();
  },

  bindEvents() {
    // 1. 綁定「新增收件人」按鈕 (來自 recipients.html)
    const btnAdd = document.getElementById("btn-add-recipient");
    if (btnAdd) {
      btnAdd.onclick = () => {
        window.modalManager.open("profile-edit", { mode: "add" }); // 使用通用編輯彈窗或專屬彈窗
      };
    }
  },

  /**
   * 從 API 獲取收件人列表
   */
  async fetchRecipients() {
    this.state.isLoading = true;
    try {
      const response = await apiClient.get("/api/recipients");
      this.state.allRecipients = response.data || [];
      this.renderList();
    } catch (error) {
      console.error("Failed to fetch recipients:", error);
      const container = document.getElementById("recipients-list-container");
      if (container) {
        container.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#ef4444;">讀取地址簿失敗，請重新整理</div>`;
      }
    } finally {
      this.state.isLoading = false;
    }
  },

  /**
   * 渲染收件人卡片：深度對位 recipients.html 的佈局
   */
  renderList() {
    const container = document.getElementById("recipients-list-container");
    const emptyState = document.getElementById("recipients-empty-state");
    if (!container) return;

    if (this.state.allRecipients.length === 0) {
      container.innerHTML = "";
      if (emptyState) emptyState.style.display = "block";
      return;
    } else {
      if (emptyState) emptyState.style.display = "none";
    }

    // 深度還原：生成具備動態標籤與遮罩的卡片
    container.innerHTML = this.state.allRecipients
      .map(
        (rc) => `
      <div class="rc-card animate-slide-up" data-id="${rc.id}">
        ${rc.isDefault ? '<span class="badge-default">預設收件人</span>' : ""}
        <div class="rc-name">${rc.name}</div>
        <div class="rc-phone"><i class="fas fa-phone-alt"></i> ${rc.phone}</div>
        
        <div class="rc-row">
          <i class="fas fa-id-card"></i>
          <div>身分證字號：<span class="text-mask">${this.maskIdNumber(
            rc.idNumber
          )}</span></div>
        </div>
        <div class="rc-row">
          <i class="fas fa-map-marker-alt"></i>
          <div>${rc.address}</div>
        </div>

        <div class="rc-actions">
          <button class="rc-btn" onclick="window.recipientModule.openEdit('${
            rc.id
          }')">
            <i class="fas fa-edit"></i> 編輯
          </button>
          <button class="rc-btn rc-btn-delete" onclick="window.recipientModule.handleDelete('${
            rc.id
          }')">
            <i class="fas fa-trash-alt"></i> 刪除
          </button>
          ${
            !rc.isDefault
              ? `
            <button class="rc-btn" onclick="window.recipientModule.setDefault('${rc.id}')">
              設為預設
            </button>
          `
              : ""
          }
        </div>
      </div>
    `
      )
      .join("");
  },

  /**
   * 輔助函式：身分證遮罩處理 (完全還原舊版隱私保護)
   */
  maskIdNumber(id) {
    if (!id) return "未提供";
    if (id.length < 5) return id;
    return id.substring(0, 3) + "****" + id.substring(id.length - 3);
  },

  /**
   * 呼叫編輯彈窗
   */
  openEdit(id) {
    const data = this.state.allRecipients.find((r) => r.id === id);
    window.modalManager.open("profile-edit", { mode: "edit", data });
  },

  /**
   * 設定預設收件人
   */
  async setDefault(id) {
    try {
      await apiClient.put(`/api/recipients/${id}/default`);
      // 成功後重新抓取並渲染
      await this.fetchRecipients();
    } catch (error) {
      alert("設定失敗：" + error.message);
    }
  },

  /**
   * 處理刪除邏輯 (含二次確認)
   */
  async handleDelete(id) {
    if (!confirm("確定要從地址簿移除此收件人嗎？此動作無法復原。")) return;
    try {
      await apiClient.delete(`/api/recipients/${id}`);
      await this.fetchRecipients();
    } catch (error) {
      alert("刪除失敗：" + error.message);
    }
  },

  /**
   * 供彈窗呼叫：儲存收件人 (POST/PUT)
   */
  async saveRecipient(formData) {
    try {
      const method = formData.id ? "put" : "post";
      const url = formData.id
        ? `/api/recipients/${formData.id}`
        : "/api/recipients";

      const response = await apiClient[method](url, formData);
      if (response.success) {
        window.modalManager.close();
        await this.fetchRecipients();
      }
    } catch (error) {
      alert("儲存失敗：" + error.message);
    }
  },
};

// 曝露給全域供 recipients.html 及各 onClick 事件使用
window.recipientModule = recipientModule;
