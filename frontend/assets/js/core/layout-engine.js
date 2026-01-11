// frontend/assets/js/core/layout-engine.js
export const layoutEngine = {
  /**
   * 自動加載側邊欄與頁首
   */
  async loadCommonComponents() {
    const components = [
      { id: "sidebar-container", url: "/admin/components/layout/sidebar.html" },
      { id: "header-container", url: "/admin/components/layout/header.html" },
    ];

    for (const comp of components) {
      const el = document.getElementById(comp.id);
      if (!el) continue;

      try {
        const response = await fetch(comp.url);
        el.innerHTML = await response.text();
        this.initActiveLinks(); // 載入後自動標記當前頁面
      } catch (e) {
        console.error(`加載組件失敗: ${comp.url}`);
      }
    }
  },

  initActiveLinks() {
    const currentPath = window.location.pathname;
    document.querySelectorAll(".nav-link").forEach((link) => {
      if (link.getAttribute("href") === currentPath) {
        link.classList.add("active");
      }
    });
  },
};
