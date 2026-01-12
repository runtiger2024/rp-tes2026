/**
 * layout-engine.js - 2026 旗艦版核心佈局與模組調度引擎
 * 功能：
 * 1. 動態載入 Section HTML 碎片
 * 2. 自動映射並初始化 JS 模組 (.init())
 * 3. 管理側邊欄 Active 狀態與頁面標題
 * 4. 支援瀏覽器前進/後退 (History API)
 */

export const layoutEngine = {
  state: {
    currentSection: null,
    sectionPath: "components/sections/",
    // 模組映射表：定義分頁名稱與 JS 模組對象的對應關係
    moduleMap: {
      packages: "parcelModule",
      shipments: "shipmentModule",
      wallet: "walletModule",
      recipients: "recipientModule",
      "furniture-procurement": "furnitureModule",
      news: null, // 純內容頁面
      faq: null,
      about: null,
    },
  },

  /**
   * 引擎啟動：監聽導航與歷史紀錄
   */
  init() {
    console.log("🚀 [Layout Engine] 旗艦調度引擎啟動...");

    // 1. 監聽側邊欄點擊事件 (委派模式)
    document.addEventListener("click", (e) => {
      const navLink = e.target.closest("[data-section]");
      if (navLink) {
        e.preventDefault();
        const sectionName = navLink.getAttribute("data-section");
        this.loadSection(sectionName);
      }
    });

    // 2. 處理瀏覽器前進後退
    window.addEventListener("popstate", (e) => {
      if (e.state && e.state.section) {
        this.loadSection(e.state.section, false);
      }
    });

    // 3. 初始頁面加載：優先讀取 URL 參數，否則預設加載 packages
    const urlParams = new URLSearchParams(window.location.search);
    const initialSection = urlParams.get("p") || "packages";
    this.loadSection(initialSection);
  },

  /**
   * 載入特定分頁
   * @param {string} name 分頁名稱
   * @param {boolean} pushState 是否推入歷史紀錄
   */
  async loadSection(name, pushState = true) {
    if (this.state.currentSection === name) return;

    const container = document.getElementById("dashboard-section-content");
    const pageTitle = document.getElementById("current-page-title");

    if (!container) {
      console.error(
        "[Layout Engine] 找不到主要顯示容器 #dashboard-section-content"
      );
      return;
    }

    // 1. 顯示載入動畫
    container.innerHTML = `
      <div class="section-loading-overlay">
        <div class="spinner-border text-primary" role="status"></div>
        <div class="mt-3 text-muted fw-bold">正在同步雲端數據...</div>
      </div>
    `;

    try {
      // 2. 獲取 HTML 內容
      const response = await fetch(`${this.state.sectionPath}${name}.html`);
      if (!response.ok) throw new Error(`無法加載分頁: ${name}`);

      const html = await response.text();

      // 3. 渲染 HTML
      container.innerHTML = html;
      this.state.currentSection = name;

      // 4. 更新 UI 狀態 (標題、菜單高亮)
      this.updateActiveMenu(name);
      if (pageTitle) {
        const activeLink = document.querySelector(`[data-section="${name}"]`);
        pageTitle.innerText = activeLink
          ? activeLink.innerText.trim()
          : "我的儀表板";
      }

      // 5. 更新 URL (不刷新頁面)
      if (pushState) {
        const newUrl = `${window.location.pathname}?p=${name}`;
        window.history.pushState({ section: name }, "", newUrl);
      }

      // 6. ❗【核心關鍵】觸發對應模組初始化 ❗
      this.initModule(name);
    } catch (err) {
      console.error("[Layout Engine] 加載失敗:", err);
      container.innerHTML = `<div class="alert alert-danger m-4">加載分頁時發生錯誤，請稍後再試。</div>`;
    }
  },

  /**
   * 根據分頁名稱自動調用 JS 模組
   */
  initModule(sectionName) {
    const moduleName = this.state.moduleMap[sectionName];
    if (moduleName && window[moduleName]) {
      console.log(`📦 [Module Bridge] 正在初始化: ${moduleName}`);

      // 如果模組有 init 函式則執行
      if (typeof window[moduleName].init === "function") {
        window[moduleName].init();
      }
    } else {
      console.log(
        `ℹ️ [Module Bridge] ${sectionName} 頁面無需獨立模組或模組尚未就緒`
      );
    }
  },

  /**
   * 更新導航欄 Active 樣式
   */
  updateActiveMenu(name) {
    document.querySelectorAll("[data-section]").forEach((el) => {
      el.classList.remove("active");
    });
    const activeLink = document.querySelector(`[data-section="${name}"]`);
    if (activeLink) activeLink.classList.add("active");
  },
};

// 曝露給全域供 inline script 呼叫或調試
window.layoutEngine = layoutEngine;

// 當 DOM 就緒後啟動引擎
document.addEventListener("DOMContentLoaded", () => layoutEngine.init());
