// frontend/assets/js/pages/client/dashboard.js
import { userStore } from "../../store/userStore.js";
import { ui } from "../../utils/ui-helper.js";
import { parcelModule } from "../../modules/parcel.js";

document.addEventListener("DOMContentLoaded", async () => {
  // 1. 初始化資料與 UI 同步
  if (!userStore.state.isLoggedIn) {
    window.location.href = "login.html";
    return;
  }

  // 2. 保持原本的 Tab 切換風格
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      // 這裡保留您原本 dashboard.html 尾部的滾動優化邏輯
      const wrapper = document.querySelector(".dashboard-tabs-wrapper");
      if (wrapper) {
        window.scrollTo({
          top: wrapper.getBoundingClientRect().top + window.pageYOffset - 80,
          behavior: "smooth",
        });
      }
    });
  });

  // 3. 自動偵測 Email 是否需要補填 (對接原本的 @line.temp 提醒)
  if (userStore.needsEmailUpdate()) {
    ui.toast("提醒：您的帳號尚未設定正式 Email，將影響發票開立。", "warning");
  }
});
