// frontend/assets/js/pages/client/dashboard-main.js
import { apiClient } from "../../api/apiClient.js";
import { userStore } from "../../store/userStore.js";
import { ui } from "../../utils/ui-helper.js";

const SECTION_PATH = "/components/sections/";

export const dashboardController = {
  /**
   * 初始化導覽切換邏輯
   */
  initNavigation() {
    const navLinks = document.querySelectorAll(".nav-link, .tab-btn");
    navLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        const targetSection = e.currentTarget.dataset.section;
        if (targetSection) this.loadSection(targetSection);
      });
    });

    // 預設加載包裹分頁 (符合原本 packages.html 邏輯)
    this.loadSection("packages");
  },

  /**
   * 非同步加載 HTML Section
   */
  async loadSection(name) {
    const container = document.getElementById("main-content-area");
    if (!container) return;

    ui.setLoading(container, true); // 顯示 Apple 風格 Spinner
    try {
      const response = await fetch(`${SECTION_PATH}${name}.html`);
      container.innerHTML = await response.text();

      // 根據分頁名稱執行對應的初始化
      this.initSectionLogic(name);
    } catch (e) {
      ui.toast(`加載 ${name} 失敗`, "error");
    }
  },

  /**
   * 分頁業務邏輯注入 (Registry)
   */
  initSectionLogic(name) {
    switch (name) {
      case "packages":
        window.loadMyPackages();
        break;
      case "shipments":
        window.loadMyShipments();
        break;
      case "wallet":
        window.initWalletSection();
        break;
      case "recipients":
        window.loadRecipients();
        break;
      case "news":
        window.loadNewsList();
        break;
      case "faq":
        window.initFaqAccordion();
        break;
    }
  },
};

document.addEventListener("DOMContentLoaded", () =>
  dashboardController.initNavigation()
);
