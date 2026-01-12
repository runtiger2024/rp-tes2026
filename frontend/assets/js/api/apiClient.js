// frontend/src/api/apiClient.js
const API_CONFIG = {
  PROD_URL: "https://runpiggy-app-backend.onrender.com/api/v1",
  DEV_URL: "http://localhost:3000/api/v1",
  isDev:
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1",
};

const BASE_URL = API_CONFIG.isDev ? API_CONFIG.DEV_URL : API_CONFIG.PROD_URL;

class ApiClient {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem("token");
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const config = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, config);
      const data = await response.json();

      // 自動處理身份失效
      if (response.status === 401) {
        localStorage.clear();
        if (!window.location.pathname.includes("login.html")) {
          window.location.href = "/login.html?reason=expired";
        }
      }

      if (!response.ok) throw new Error(data.message || "請求失敗");
      return data;
    } catch (error) {
      console.error(`[API Error] ${endpoint}:`, error.message);
      throw error;
    }
  }

  get(endpoint) {
    return this.request(endpoint, { method: "GET" });
  }
  post(endpoint, body) {
    return this.request(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  // 支援檔案上傳 (Multipart)
  async upload(endpoint, formData) {
    const token = localStorage.getItem("token");
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: "POST",
      body: formData,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    return response.json();
  }
}

export const apiClient = new ApiClient();
