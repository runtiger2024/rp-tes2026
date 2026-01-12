/**
 * auth.js - 身份驗證與個人中心核心模組 (V2026 旗艦版)
 * 深度還原：LINE LIFF 整合、JWT Token 生命週期、個人資料同步、密碼修改邏輯
 */
import { apiClient } from "../api/apiClient.js";

export const authModule = {
  state: {
    user: null,
    isAuthenticated: !!localStorage.getItem("token"),
    // 精確還原舊版 LINE LIFF ID
    liffId: "2008848533-2vczl7ua",
    redirectUrl: "dashboard.html",
  },

  /**
   * 核心啟動入口
   */
  async init() {
    console.log("🔐 [Auth] 身份驗證模組啟動中...");

    // 1. 判斷頁面類型，執行對應初始化
    const path = window.location.pathname;

    if (
      path.includes("login.html") ||
      path.includes("register.html") ||
      path === "/" ||
      path.includes("index.html")
    ) {
      this.initLineLogin();
      this.bindAuthFormEvents();
    }

    if (path.includes("dashboard.html")) {
      await this.checkAccess();
      await this.loadUserProfile();
    }

    if (path.includes("reset-password.html")) {
      this.bindResetEvents();
    }
  },

  /**
   * 權限檢查：若未登入則強制跳回登入頁
   */
  async checkAccess() {
    if (!this.state.isAuthenticated) {
      console.warn("[Auth] 未偵測到憑證，跳轉至登入頁...");
      window.location.href = "login.html";
    }
  },

  /**
   * 綁定登入與註冊表單事件
   */
  bindAuthFormEvents() {
    // 登入表單
    const loginForm = document.getElementById("login-form");
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("login-password").value;
        const remember = document.getElementById("remember-me")?.checked;
        await this.handleLogin(email, password, remember);
      });
    }

    // 註冊表單
    const registerForm = document.getElementById("register-form");
    if (registerForm) {
      registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const data = {
          name: document.getElementById("reg-name").value.trim(),
          email: document.getElementById("reg-email").value.trim(),
          password: document.getElementById("reg-password").value,
          confirmPassword: document.getElementById("reg-password-confirm")
            .value,
        };

        // 深度還原：舊版安全驗證
        if (data.password.length < 6)
          return alert("安全起見，密碼長度至少需要 6 個字元");
        if (data.password !== data.confirmPassword)
          return alert("密碼與確認密碼不符");

        await this.handleRegister(data);
      });
    }
  },

  /**
   * LINE Login (LIFF) 初始化與自動授權邏輯
   */
  async initLineLogin() {
    const lineBtn = document.getElementById("lineLoginBtn");
    if (!lineBtn || typeof liff === "undefined") return;

    try {
      await liff.init({ liffId: this.state.liffId });

      // 處理來自 LINE 授權後的跳轉回傳
      const urlParams = new URLSearchParams(window.location.search);
      if (
        liff.isLoggedIn() &&
        (urlParams.has("code") || urlParams.has("state"))
      ) {
        const idToken = liff.getIDToken();
        const res = await apiClient.post("/api/auth/line", { idToken });
        if (res.token) {
          this.saveSession(res.token, res.user);
          window.location.href = this.state.redirectUrl;
        }
      }

      lineBtn.onclick = () => {
        liff.login({ redirectUri: window.location.href });
      };
    } catch (err) {
      console.error("LIFF 初始化失敗:", err);
    }
  },

  /**
   * 處理登入 API 調用
   */
  async handleLogin(email, password, remember) {
    try {
      const res = await apiClient.post("/api/auth/login", { email, password });
      if (res.token) {
        this.saveSession(res.token, res.user, remember);
        window.location.href = this.state.redirectUrl;
      }
    } catch (err) {
      alert(err.message || "登入失敗，請檢查帳號密碼");
    }
  },

  /**
   * 處理註冊 API 調用
   */
  async handleRegister(userData) {
    try {
      const res = await apiClient.post("/api/auth/register", userData);
      if (res.token) {
        this.saveSession(res.token, res.user);
        alert("恭喜！註冊成功，即將為您跳轉至儀表板。");
        window.location.href = this.state.redirectUrl;
      }
    } catch (err) {
      alert(err.message || "註冊失敗，該 Email 可能已被使用");
    }
  },

  /**
   * 載入個人資料並同步 UI
   */
  async loadUserProfile() {
    try {
      const res = await apiClient.get("/api/member/profile");
      this.state.user = res.data;
      this.syncProfileUI();
    } catch (err) {
      if (err.status === 401) this.logout();
    }
  },

  /**
   * 深度對位 UI 顯示元件 (完全還原 dashboard.html 中的 ID)
   */
  syncProfileUI() {
    if (!this.state.user) return;
    const { name, email, piggyId, balance } = this.state.user;

    // 更新各處顯示名稱
    document
      .querySelectorAll("#dashboard-user-name, .user-name-display")
      .forEach((el) => {
        el.innerText = name || email.split("@")[0];
      });

    // 更新 Email 與 專屬 Piggy ID
    const emailEl = document.getElementById("dashboard-user-email");
    if (emailEl) emailEl.innerText = email;

    const idEl = document.getElementById("dashboard-piggy-id");
    if (idEl) idEl.innerText = piggyId || "--";

    // 如果頁面有餘額顯示，同步更新 (備援邏輯)
    const balanceEl = document.getElementById("dashboard-user-balance");
    if (balanceEl && balance !== undefined) {
      balanceEl.innerText = balance.toLocaleString();
    }
  },

  /**
   * 修改密碼邏輯 (對接 password-change 彈窗)
   */
  async changePassword(oldPassword, newPassword) {
    try {
      await apiClient.put("/api/member/password", { oldPassword, newPassword });
      alert("密碼修改成功，下次請使用新密碼登入。");
      window.modalManager.close();
    } catch (err) {
      alert("密碼修改失敗：" + err.message);
    }
  },

  /**
   * 儲存 Session 資料
   */
  saveSession(token, user, remember = false) {
    const storage = remember ? localStorage : sessionStorage;
    localStorage.setItem("token", token); // API Client 預設抓 localStorage
    localStorage.setItem("userName", user.name || "");
    this.state.isAuthenticated = true;
    this.state.user = user;
  },

  /**
   * 登出並清理緩存
   */
  logout() {
    localStorage.clear();
    sessionStorage.clear();
    if (typeof liff !== "undefined" && liff.isLoggedIn()) {
      liff.logout();
    }
    window.location.href = "login.html";
  },
};

// 曝露給全域，支援 HTML 內的 onclick 呼叫 (如：logout)
window.authModule = authModule;
