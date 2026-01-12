/**
 * furniture.js - 家具代採購核心模組 (V2026 旗艦版)
 * 負責：匯率運算、手續費精算、需求單提交、歷史報價渲染
 */
import { apiClient } from "../api/apiClient.js";

export const furnitureModule = {
  state: {
    config: {
      exchangeRate: 4.65, // 預設匯率
      serviceFeeRate: 0.05, // 5% 手續費
      minServiceFee: 500, // 最低手續費 500 TWD
    },
    history: [],
    selectedImage: null,
  },

  /**
   * 初始化：讀取系統配置與歷史紀錄
   */
  async init() {
    console.log("🛋️ Furniture Module Initializing...");
    this.bindEvents();
    await this.fetchConfig();
    await this.loadHistory();
  },

  /**
   * 事件綁定：計算觸發與表單提交
   */
  bindEvents() {
    // 1. 金額計算連動
    const calcInputs = ["priceRMB", "quantity"];
    calcInputs.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", () => this.calculateTotal());
    });

    // 2. 圖片預覽處理
    const fileInput = document.getElementById("furniture-ref-image");
    if (fileInput) {
      fileInput.addEventListener("change", (e) => this.handleImagePreview(e));
    }

    // 3. 表單提交
    const form = document.getElementById("furniture-form");
    if (form) {
      form.addEventListener("submit", (e) => this.handleApply(e));
    }
  },

  /**
   * 從後端獲取最新報價參數 (匯率與服務費)
   */
  async fetchConfig() {
    try {
      const res = await apiClient.get("/api/calculator/config");
      if (res.success && res.rates?.procurement) {
        this.state.config = {
          exchangeRate: parseFloat(res.rates.procurement.exchangeRate),
          serviceFeeRate: parseFloat(res.rates.procurement.serviceFeeRate),
          minServiceFee: parseFloat(res.rates.procurement.minServiceFee),
        };
        this.updateRateUI();
      }
    } catch (err) {
      console.warn("使用預設家具報價參數:", this.state.config);
    }
  },

  /**
   * 更新 UI 上的當前匯率提示
   */
  updateRateUI() {
    const rateEl = document.getElementById("procurement-rate-display");
    if (rateEl) {
      rateEl.innerHTML = `<i class="fas fa-info-circle"></i> 當前採購匯率：1 : ${
        this.state.config.exchangeRate
      } (手續費 ${this.state.config.serviceFeeRate * 100}%)`;
    }
  },

  /**
   * 核心運算：深度還原舊版計算公式
   */
  calculateTotal() {
    const rmb = parseFloat(document.getElementById("priceRMB")?.value || 0);
    const qty = parseInt(document.getElementById("quantity")?.value || 1);

    if (rmb <= 0) return;

    const { exchangeRate, serviceFeeRate, minServiceFee } = this.state.config;

    // 1. 計算商品台幣總額
    const productTWD = Math.round(rmb * qty * exchangeRate);

    // 2. 計算手續費 (判斷最低消費)
    let serviceFee = Math.round(productTWD * serviceFeeRate);
    if (serviceFee < minServiceFee) serviceFee = minServiceFee;

    // 3. 渲染至介面 (完全對位舊版 ID)
    const twdDisplay = document.getElementById("priceTWD-display");
    const feeDisplay = document.getElementById("serviceFee-display");
    const totalDisplay = document.getElementById("totalPrice-display");

    if (twdDisplay) twdDisplay.innerText = productTWD.toLocaleString();
    if (feeDisplay) feeDisplay.innerText = serviceFee.toLocaleString();
    if (totalDisplay)
      totalDisplay.innerText = (productTWD + serviceFee).toLocaleString();
  },

  /**
   * 圖片選取預覽邏輯
   */
  handleImagePreview(e) {
    const file = e.target.files[0];
    if (!file) return;
    this.state.selectedImage = file;

    const reader = new FileReader();
    const previewContainer = document.getElementById("furniture-preview-box");
    const previewImg = document.getElementById("furniture-preview-img");

    reader.onload = (event) => {
      if (previewImg) previewImg.src = event.target.result;
      if (previewContainer) previewContainer.style.display = "block";
    };
    reader.readAsDataURL(file);
  },

  /**
   * 提交代購需求 (使用 FormData 處理圖片)
   */
  async handleApply(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');

    // 取得資料
    const formData = new FormData();
    formData.append(
      "factoryName",
      document.getElementById("factoryName").value
    );
    formData.append(
      "productName",
      document.getElementById("productName").value
    );
    formData.append("productUrl", document.getElementById("productUrl").value);
    formData.append("quantity", document.getElementById("quantity").value);
    formData.append("priceRMB", document.getElementById("priceRMB").value);
    formData.append("note", document.getElementById("note").value);

    if (this.state.selectedImage) {
      formData.append("refImage", this.state.selectedImage);
    }

    try {
      btn.disabled = true;
      btn.innerText = "提交中...";

      // 對接 apiClient (需確保 apiClient 支持 FormData 或直接使用 fetch)
      const res = await apiClient.post("/api/furniture/apply", formData, {
        headers: { "Content-Type": "multipart/form-data" }, // 特殊標頭處理
      });

      if (res.success) {
        alert("代購需求提交成功！管理員將於 24 小時內完成報價。");
        document.getElementById("furniture-form").reset();
        document.getElementById("furniture-preview-box").style.display = "none";
        await this.loadHistory();
      }
    } catch (err) {
      alert("提交失敗：" + err.message);
    } finally {
      btn.disabled = false;
      btn.innerText = "確認提交需求";
    }
  },

  /**
   * 加載歷史代購紀錄
   */
  async loadHistory() {
    const tbody = document.getElementById("furniture-history-body");
    if (!tbody) return;

    try {
      const res = await apiClient.get("/api/furniture/history");
      this.state.history = res.data || [];

      if (this.state.history.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding:40px; color:#94a3b8;">尚無代購紀錄</td></tr>`;
        return;
      }

      tbody.innerHTML = this.state.history
        .map(
          (item) => `
        <tr>
          <td>${new Date(item.createdAt).toLocaleDateString()}</td>
          <td>
            <div style="font-weight:700;">${item.productName}</div>
            <div style="font-size:11px; color:#64748b;">${
              item.factoryName || "一般賣家"
            }</div>
          </td>
          <td style="font-family:monospace; font-weight:700;">¥ ${
            item.priceRMB
          }</td>
          <td>${this.renderStatusBadge(item.status)}</td>
          <td class="text-center">
            <button class="btn-icon-sm" onclick="window.furnitureModule.viewDetail('${
              item.id
            }')">
              <i class="fas fa-file-invoice"></i>
            </button>
          </td>
        </tr>
      `
        )
        .join("");
    } catch (err) {
      console.error("載入歷史紀錄失敗:", err);
    }
  },

  renderStatusBadge(status) {
    const maps = {
      PENDING: { text: "待報價", class: "status-pending" },
      QUOTED: { text: "已報價", class: "status-arrived" },
      PURCHASING: { text: "採購中", class: "status-shipped" },
      CANCELLED: { text: "已取消", class: "status-exception" },
    };
    const s = maps[status] || { text: status, class: "" };
    return `<span class="status-badge-mini ${s.class}">${s.text}</span>`;
  },

  /**
   * 開啟報價單詳情彈窗
   */
  viewDetail(id) {
    window.modalManager.open("furniture-detail-modal", { id });
  },
};

// 曝露給全域供 HTML 呼叫
window.furnitureModule = furnitureModule;
