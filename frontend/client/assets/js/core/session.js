// frontend/client/assets/js/core/session.js
import { apiClient } from "../../../api/apiClient.js";
import { userStore } from "../../../store/userStore.js";

const LIFF_ID = "2008848533-2vczl7ua";

export const sessionManager = {
  /**
   * 一般登入
   */
  async login(email, password) {
    const data = await apiClient.post("/client/auth/login", {
      email,
      password,
    });
    localStorage.setItem("token", data.token);
    userStore.setUser(data.user);
    return data;
  },

  /**
   * LINE 登入初始化 (整合自 auth.js V16.4)
   */
  async initLineAuth() {
    if (typeof liff === "undefined") return;

    await liff.init({ liffId: LIFF_ID });

    if (liff.isLoggedIn()) {
      const profile = await liff.getProfile();
      const userEmail = liff.getDecodedIDToken()?.email;

      const res = await apiClient.post("/client/auth/line-login", {
        lineUserId: profile.userId,
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl,
        email: userEmail,
      });

      localStorage.setItem("token", res.token);
      userStore.setUser(res.user);
      window.location.href = "dashboard.html";
    }
  },

  triggerLineLogin() {
    liff.login();
  },
};
