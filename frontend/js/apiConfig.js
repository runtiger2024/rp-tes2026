// frontend/js/apiConfig.js
/**
 * 小跑豬 ERP 系統 API 全域配置
 */
const API_CONFIG = {
  // 根據環境自動切換 API 網址
  BASE_URL:
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
      ? "http://localhost:3000/api"
      : "https://api.runtiger-erp.com/api", // 替換為實際生產環境網址

  // 靜態資源路徑
  ASSET_URL: "/assets",

  // 逾時設定
  TIMEOUT: 15000,
};

// 將配置掛載至 window 物件以便全域調用
window.API_CONFIG = API_CONFIG;

// 如果有使用 axios，可在此進行全域設定
if (typeof axios !== "undefined") {
  axios.defaults.baseURL = API_CONFIG.BASE_URL;
}
