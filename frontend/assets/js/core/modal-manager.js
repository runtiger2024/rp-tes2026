// frontend/assets/js/core/modal-manager.js
export const modalManager = {
  // 緩存已加載的彈窗 HTML
  cache: {},

  /**
   * 打開指定彈窗
   * @param {string} name 彈窗名稱 (如 'deposit', 'shipment-create')
   * @param {Function} initCallback 彈窗載入後的初始化邏輯
   */
  async open(name, initCallback = null) {
    let modalEl = document.getElementById(`${name}-modal`);

    // 1. 如果 DOM 中還沒有這個彈窗，先從 components 加載
    if (!modalEl) {
      const response = await fetch(`/components/modals/${name}.html`);
      const html = await response.text();
      const wrapper = document.createElement("div");
      wrapper.innerHTML = html;
      modalEl = wrapper.firstElementChild;
      document.body.appendChild(modalEl);

      // 自動綁定關閉按鈕 (對接您原本的 .modal-close)
      modalEl
        .querySelectorAll(".modal-close, .modal-close-btn")
        .forEach((btn) => {
          btn.onclick = () => this.close(name);
        });
    }

    // 2. 顯示彈窗 (維持您原本的 display 風格)
    modalEl.style.display = "flex";

    // 3. 執行該彈窗專屬的初始化 (如填充收件人列表)
    if (initCallback) initCallback(modalEl);
  },

  close(name) {
    const modalEl = document.getElementById(`${name}-modal`);
    if (modalEl) modalEl.style.display = "none";
  },
};
