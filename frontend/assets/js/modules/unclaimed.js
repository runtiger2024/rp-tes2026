/**
 * unclaimed.js - 無主包裹認領核心模組 (V2026 旗艦版)
 * 負責：無主包裹清單同步、搜尋過濾、認領表單處理、入庫照大圖預覽
 */
import { apiClient } from "../api/apiClient.js";

export const unclaimedModule = {
  state: {
    cache: [], // 快取數據以消除切換分頁延遲
    isLoading: false,
    currentKeyword: "",
  },

  /**
   * 初始化：綁定 UI 事件與初次讀取
   */
  async init() {
    console.log("📦 Unclaimed Module Initializing...");
    this.bindEvents();
    await this.fetchData();
  },

  /**
   * 事件綁定：搜尋監聽與表單提交
   */
  bindEvents() {
    // 1. 搜尋輸入監聽 (對位 unclaimed-search-input)
    const searchInput = document.getElementById("unclaimed-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.state.currentKeyword = e.target.value.trim().toLowerCase();
        this.render();
      });
    }

    // 2. 認領表單提交監聽 (對位 claim-package-form)
    // 注意：彈窗 HTML 可能會被動態載入，建議在 modalManager 開啟後再次確認綁定
  },

  /**
   * 同步獲取無主包裹數據 (SWR 策略：優先顯示快取，背景更新)
   */
  async fetchData() {
    const tbody = document.getElementById("unclaimed-table-body");
    const container = document.getElementById("unclaimed-list-container");

    // 顯示載入狀態
    if (this.state.cache.length === 0) {
      const loadingHtml = `<div style="text-align:center; padding:40px; color:#94a3b8;"><i class="fas fa-spinner fa-spin"></i> 正在搜尋無主包裹...</div>`;
      if (tbody)
        tbody.innerHTML = `<tr><td colspan="5">${loadingHtml}</td></tr>`;
      if (container) container.innerHTML = loadingHtml;
    }

    try {
      const res = await apiClient.get("/api/packages/unclaimed");
      if (res.success) {
        this.state.cache = res.packages || [];
        this.render();
      }
    } catch (err) {
      console.error("載入無主包裹失敗:", err);
    }
  },

  /**
   * 執行渲染：支援表格與卡片兩種佈局
   */
  render() {
    const tbody = document.getElementById("unclaimed-table-body");
    const container = document.getElementById("unclaimed-list-container");

    // 執行搜尋過濾
    const kw = this.state.currentKeyword;
    const filtered = this.state.cache.filter(
      (p) =>
        p.trackingNumber?.toLowerCase().includes(kw) ||
        p.productName?.toLowerCase().includes(kw) ||
        p.maskedTrackingNumber?.toLowerCase().includes(kw)
    );

    if (filtered.length === 0) {
      const emptyHtml = `<div style="text-align:center; padding:50px; color:#94a3b8;">
        <i class="fas fa-box-open" style="font-size:30px; margin-bottom:15px;"></i><br>
        ${kw ? "找不到符合單號的包裹" : "目前沒有新的無主包裹"}
      </div>`;
      if (tbody) tbody.innerHTML = `<tr><td colspan="5">${emptyHtml}</td></tr>`;
      if (container) container.innerHTML = emptyHtml;
      return;
    }

    // A. 渲染至表格 (桌面版對位)
    if (tbody) {
      tbody.innerHTML = filtered
        .map(
          (pkg) => `
        <tr>
          <td>${new Date(pkg.createdAt).toLocaleDateString()}</td>
          <td style="font-family:monospace; font-weight:700; color:#d32f2f;">
            ${pkg.maskedTrackingNumber || pkg.trackingNumber}
          </td>
          <td>${pkg.productName || "未標註貨物"}</td>
          <td>${pkg.weight ? pkg.weight + " kg" : "--"}</td>
          <td>
            <button class="btn-icon-sm" onclick="window.unclaimedModule.initiateClaim('${
              pkg.id
            }')">
              <i class="fas fa-hand-paper"></i> 認領
            </button>
          </td>
        </tr>
      `
        )
        .join("");
    }

    // B. 渲染至卡片容器 (行動端對位)
    if (container) {
      container.innerHTML = filtered
        .map(
          (pkg) => `
        <div class="unclaimed-card animate-slide-up">
          <div class="pkg-image-wrapper" onclick="window.unclaimedModule.previewImage('${
            pkg.imageUrl || pkg.warehouseImages?.[0]
          }')">
            <img src="${
              pkg.imageUrl ||
              pkg.warehouseImages?.[0] ||
              "assets/img/no-image.png"
            }" alt="包裹照" loading="lazy">
            <div class="img-overlay"><i class="fas fa-search-plus"></i> 查看照片</div>
          </div>
          <div class="pkg-details">
            <div class="pkg-tracking"><small>遮罩單號</small><strong>${
              pkg.maskedTrackingNumber || pkg.trackingNumber
            }</strong></div>
            <div class="pkg-info">
              <span><i class="fas fa-weight-hanging"></i> ${
                pkg.weight || "--"
              } kg</span>
              <span><i class="fas fa-calendar-alt"></i> ${new Date(
                pkg.createdAt
              ).toLocaleDateString()}</span>
            </div>
            <button class="btn-claim" onclick="window.unclaimedModule.initiateClaim('${
              pkg.id
            }')">我要認領</button>
          </div>
        </div>
      `
        )
        .join("");
    }
  },

  /**
   * 觸發認領動作：開啟彈窗並執行嚴格校驗
   */
  initiateClaim(id) {
    // 開啟認領彈窗
    window.modalManager.open("claim-package", { id });

    // 深度還原：強迫客戶手動輸入單號，不自動帶入
    setTimeout(() => {
      const input = document.getElementById("claim-tracking");
      if (input) {
        input.value = "";
        input.readOnly = false;
        input.placeholder = "請輸入完整物流單號以進行認領校驗";
        input.focus();
      }

      // 綁定表單提交 (因為是動態彈窗，需在此綁定)
      const form = document.getElementById("claim-package-form");
      if (form) {
        form.onsubmit = (e) => this.handleClaimSubmit(e);
      }
    }, 200);
  },

  /**
   * 處理認領表單提交
   */
  async handleClaimSubmit(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const tracking = document.getElementById("claim-tracking").value.trim();

    if (!tracking) return alert("請輸入完整物流單號");

    try {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 驗證中...';

      const formData = new FormData();
      formData.append("trackingNumber", tracking);
      const proofFile = document.getElementById("claim-proof")?.files[0];
      if (proofFile) formData.append("proof", proofFile);

      // 對接 /api/packages/claim
      const res = await apiClient.post("/api/packages/claim", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.success) {
        alert("認領成功！該包裹已歸入您的包裹清單。");
        window.modalManager.close();
        await this.fetchData(); // 刷新無主清單
        if (window.parcelModule) window.parcelModule.fetchPackages(); // 若有包裹模組則同步更新
      }
    } catch (err) {
      alert("認領失敗：" + (err.message || "單號不匹配或系統錯誤"));
    } finally {
      btn.disabled = false;
      btn.innerHTML = "提交認領";
    }
  },

  /**
   * 圖片大圖預覽
   */
  previewImage(url) {
    if (!url || url.includes("no-image")) return;
    window.modalManager.open("view-images-modal", { imageUrl: url });
  },
};

// 曝露給全域供 UI 與 onclick 呼叫
window.unclaimedModule = unclaimedModule;
