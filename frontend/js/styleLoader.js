/**
 * styleLoader.js
 * V2026.Ultimate.Final - 旗艦版樣式與資產自動導航引擎
 * 核心功能：
 * 1. 智能路徑修復 (解決本地與雲端部署的路徑差異)
 * 2. 自動偵測頁面類型並載入對應 CSS (Admin vs Client)
 * 3. 注入究極 CSS 變數清單 (確保視覺一致性)
 * 4. FOUC 閃爍防護機制
 */

(function () {
  // 1. 初始化頁面隱藏 (防止 CSS 未載入前出現原生 HTML)
  const initialStyle = document.createElement("style");
  initialStyle.id = "fouc-protection";
  initialStyle.innerHTML =
    "body { opacity: 0; transition: opacity 0.3s ease-in; }";
  document.head.appendChild(initialStyle);

  // 2. 環境與路徑偵測
  const path = window.location.pathname;
  const fileName = path.split("/").pop() || "index.html";
  const isAdminPage = fileName.startsWith("admin-");

  // 判斷當前是否在 App 容器或深度目錄中
  const getRootPath = () => {
    // 假設 CSS 始終位於根目錄的 css/ 資料夾
    return "";
  };
  const root = getRootPath();

  // 3. 究極核心變數注入 (確保 JS 驅動的組件也能獲取顏色)
  const injectUltimateVariables = () => {
    const varStyle = document.createElement("style");
    varStyle.id = "ultimate-vars";
    varStyle.innerHTML = `
      :root {
        --p-primary: #1a73e8;
        --p-primary-hover: #1557b0;
        --p-primary-active: #0d47a1;
        --p-primary-light: #e8f0fe;
        --p-primary-bg: #f8faff;
        --admin-primary: #4e73df;
        --admin-primary-dark: #224abe;
        --admin-gradient: linear-gradient(135deg, #4e73df 0%, #224abe 100%);
        --p-accent: #ff5000;
        --p-accent-hover: #e04600;
        --p-accent-active: #c73e00;
        --p-accent-light: #fff2eb;
        --p-success: #00b578;
        --p-success-light: #e6f7f0;
        --p-warning: #ff9000;
        --p-warning-light: #fff7e6;
        --p-danger: #ff3b30;
        --p-danger-light: #fff2f0;
        --p-info: #00b5ff;
        --p-info-light: #e6f7ff;
        --text-main: #1c1c1e;
        --text-body: #3a3a3c;
        --text-sub: #8e8e93;
        --bg-main: #f4f7fa;
        --bg-card: #ffffff;
        --radius-sm: 8px;
        --radius-md: 12px;
        --radius-lg: 18px;
        --radius-xl: 24px;
        --shadow-md: 0 8px 24px rgba(0, 0, 0, 0.08);
        --modal-blur: blur(8px);
      }
    `;
    document.head.appendChild(varStyle);
  };

  // 4. 動態載入 CSS 函式
  const loadCSS = (href, id) => {
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = root + href;
    document.head.appendChild(link);
  };

  // 5. 執行資源裝載過程
  injectUltimateVariables();

  // 載入 FontAwesome (全站通用)
  loadCSS(
    "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
    "fa-core"
  );

  // 根據頁面身份載入主框架
  if (isAdminPage) {
    loadCSS("css/admin-modern.css", "admin-style");
  } else {
    loadCSS("css/theme-client.css", "client-theme");
  }

  // 載入通用的彈窗與動畫
  loadCSS("css/modals-unified.css", "modal-style");

  // 6. 解除隱藏並顯示頁面 (DOMContentLoaded 或樣式載入後)
  const revealBody = () => {
    setTimeout(() => {
      document.body.style.opacity = "1";
      // 移除 fouc 標籤以維持清潔
      const fouc = document.getElementById("fouc-protection");
      if (fouc) fouc.remove();
    }, 100);
  };

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", revealBody);
  } else {
    revealBody();
  }

  // 7. [高級功能] 智能圖片路徑修復 (全站自動化)
  // 此功能會自動修復 Cloudinary 可能出現的 https:/ 單斜線損毀問題
  window.fixImagePath = function (path) {
    if (!path) return "";
    if (path.startsWith("http")) {
      return path.replace(/^https?:\/+(?!\/)/, "https://");
    }
    return path;
  };
})();
