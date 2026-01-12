// frontend/src/store/userStore.js
export const userStore = {
  state: {
    user: null,
    token: localStorage.getItem("token"),
    isLoggedIn: !!localStorage.getItem("token"),
  },

  setUser(userData) {
    this.state.user = userData;
    this.state.isLoggedIn = true;
    if (userData.name) localStorage.setItem("userName", userData.name);
  },

  clear() {
    this.state.user = null;
    this.state.token = null;
    this.state.isLoggedIn = false;
    localStorage.clear();
  },

  // 檢查是否需要補填 Email (整合自 dashboard-core.js V2026.1.15)
  needsEmailUpdate() {
    return this.state.user?.email?.includes("@line.temp");
  },
};
