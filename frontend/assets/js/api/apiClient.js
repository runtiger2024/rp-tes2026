/**
 * apiClient.js - V2026.01.ULTIMATE
 * 2026 旗艦版核心網路通訊模組
 * 整合功能：
 * 1. 自動切換開發/生產環境
 * 2. 用戶/管理員 Token 雙軌辨識
 * 3. 自動處理 Multipart/FormData (圖片上傳)
 * 4. 身份失效 (401) 自動引導跳轉
 */

const API_CONFIG = {
  // 後端正式環境網址
  PROD_URL: "https://runpiggy-app-backend.onrender.com/api/v1",
  // 本地開發網址
  DEV_URL: "http://localhost:3000/api/v1",
  // 判斷是否為本地環境
  get isDev() {
    return (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    );
  },
};

const BASE_URL = API_CONFIG.isDev ? API_CONFIG.DEV_URL : API_CONFIG.PROD_URL;

class ApiClient {
  /**
   * 內部輔助：取得正確的 Authorization Header
   */
  getAuthHeader() {
    // 檢查是否處於管理員路徑
    const isAdminPath = window.location.pathname.includes("/admin");
    const tokenKey = isAdminPath ? "admin_token" : "token";
    const token = localStorage.getItem(tokenKey);

    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * 核心請求發送器
   */
  async request(endpoint, options = {}) {
    // 1. 初始化標頭
    const headers = {
      ...this.getAuthHeader(),
      ...options.headers,
    };

    // 2. ❗【關鍵修復】自動判定內容類型 ❗
    // 如果 body 是 FormData (上傳圖片)，不應手動設置 Content-Type，讓瀏覽器自動處理 Boundary
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    const config = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, config);

      // 3. 處理身份失效 (401)
      if (response.status === 401) {
        console.warn("[API] 授權失效，正在清理憑證並引導跳轉...");
        const isAdmin = window.location.pathname.includes("/admin");

        localStorage.removeItem(isAdmin ? "admin_token" : "token");

        // 防止重複跳轉
        if (!window.location.pathname.includes("login.html")) {
          window.location.href = isAdmin
            ? "/admin-login.html?reason=expired"
            : "/login.html?reason=expired";
        }
        return;
      }

      const data = await response.json();

      // 4. 處理伺服器端錯誤
      if (!response.ok) {
        throw new Error(data.message || "請求伺服器失敗");
      }

      return data;
    } catch (error) {
      console.error(`🔴 [API Error] ${endpoint}:`, error.message);
      throw error;
    }
  }

  // --- [ 標準 RESTful 請求函式 ] ---

  /**
   * GET 請求：用於讀取資料 (包裹、訂單、餘額)
   */
  get(endpoint) {
    return this.request(endpoint, { method: "GET" });
  }

  /**
   * POST 請求：用於創建、登入、提交認領
   */
  post(endpoint, body) {
    // 若傳入的是普通 Object 則 JSON 化，若是 FormData 則直接傳入
    const processedBody =
      body instanceof FormData ? body : JSON.stringify(body);
    return this.request(endpoint, {
      method: "POST",
      body: processedBody,
    });
  }

  /**
   * PUT 請求：用於更新數據 (修改會員、核價、入庫編輯)
   */
  put(endpoint, body) {
    const processedBody =
      body instanceof FormData ? body : JSON.stringify(body);
    return this.request(endpoint, {
      method: "PUT",
      body: processedBody,
    });
  }

  /**
   * DELETE 請求：用於刪除數據 (移除收件人、取消預報)
   */
  delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  }

  /**
   * 快捷上傳功能 (對接舊版習慣)
   */
  async upload(endpoint, formData) {
    if (!(formData instanceof FormData)) {
      throw new Error("上傳功能僅支援 FormData 對象");
    }
    return this.post(endpoint, formData);
  }
}

// 實例化並導出
export const apiClient = new ApiClient();

// 供傳統非模組化頁面使用的全域變數 (相容性支援)
window.apiClient = apiClient;
