// frontend/assets/js/utils/ui-tweaks.js

/**
 * FAQ 手風琴邏輯 (對接 faq.html)
 */
window.initFaqAccordion = function () {
  document.querySelectorAll(".faq-question").forEach((q) => {
    q.onclick = () => {
      const item = q.parentElement;
      item.classList.toggle("active"); // 觸發 CSS cubic-bezier 動畫
    };
  });
};

/**
 * 最新消息過濾 (對接 news.html)
 */
window.filterNews = function (category, btn) {
  document
    .querySelectorAll(".news-filter-chip")
    .forEach((c) => c.classList.remove("active"));
  btn.classList.add("active");
  // 執行 API 過濾...
};
