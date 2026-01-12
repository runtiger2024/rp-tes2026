/**
 * admin-layout.js - V2026.01.ULTIMATE
 * 2026 旗艦版管理端核心調度引擎
 * * 整合功能：
 * 1. Auth Guard (安全攔截與權限檢查)
 * 2. Sidebar/Topbar 動態注入
 * 3. SPA Section 加載 (動態載入 components/sections/admin/ 下的碎片)
 * 4. Module Bridge (自動初始化對應業務模組 .init())
 * 5. Badge Syncing (即時待處理數據同步)
 */

import { apiClient } from "../api/apiClient.js";

export const adminLayout = {
  state: {
    adminName: localStorage.getItem("admin_name") || "管理員",
    adminRole: localStorage.getItem("admin_role") || "STAFF",
    adminPermissions: JSON.parse(
      localStorage.getItem("admin_permissions") || "[]"
    ),
    currentSection: null,
    sectionPath: "components/sections/admin/",
    // 模組映射表：載入分頁後自動呼叫對應的模組初始化
    moduleMap: {
      "admin-parcels": "adminOpsModule", // 包裹入庫
      "admin-shipments": "adminShipmentModule", // 訂單核價
      "admin-unclaimed": "unclaimedModule", // 無主認領(管理端版)
      "admin-finance": "adminUserModule", // 財務審核
      "admin-members": "adminUserModule", // 會員管理
      "admin-furniture": "adminFurnitureModule", // 家具報價
      "admin-settings": "adminContentModule", // 公告/FAQ 編輯
    },
  },

  /**
   * 核心配置：導航選單清單
   */
  menuConfig: [
    {
      label: "營運儀表板",
      icon: "fas fa-tachometer-alt",
      view: "admin-dashboard",
      permission: "DASHBOARD_VIEW",
    },
    {
      label: "包裹管理",
      icon: "fas fa-boxes",
      view: "admin-parcels",
      permission: "PACKAGE_VIEW",
      badgeId: "badge-packages",
    },
    {
      label: "集運單管理",
      icon: "fas fa-truck-loading",
      view: "admin-shipments",
      permission: "SHIPMENT_VIEW",
      badgeId: "badge-shipments",
    },
    {
      label: "無主包裹認領",
      icon: "fas fa-question-circle",
      view: "admin-unclaimed",
      permission: "PACKAGE_VIEW",
    },
    {
      label: "財務審核",
      icon: "fas fa-money-check-alt",
      view: "admin-finance",
      permission: "FINANCE_VIEW",
      badgeId: "badge-finance",
    },
    {
      label: "會員資料管理",
      icon: "fas fa-users",
      view: "admin-members",
      permission: "USER_VIEW",
    },
    {
      label: "家具代購訂單",
      icon: "fas fa-couch",
      view: "admin-furniture",
      permission: "FURNITURE_VIEW",
      badgeId: "badge-furniture",
    },
    {
      label: "系統操作日誌",
      icon: "fas fa-history",
      view: "admin-logs",
      permission: "LOGS_VIEW",
    },
    {
      label: "內容管理設定",
      icon: "fas fa-edit",
      view: "admin-settings",
      permission: "SYSTEM_CONFIG",
    },
  ],

  /**
   * 引擎啟動
   */
  async init() {
    console.log("🛠️ [Admin Engine] 旗艦調度引擎啟動...");

    // 1. 安全攔截
    if (!this.checkAuth()) return;

    // 2. 注入固定佈局 (側邊欄與頂欄)
    this.injectBaseLayout();

    // 3. 處理導航點擊 (SPA 模式)
    this.bindEvents();

    // 4. 初始化加載 (讀取 URL 參數，預設進入 dashboard)
    const urlParams = new URLSearchParams(window.location.search);
    const initialView = urlParams.get("view") || "admin-dashboard";
    await this.loadSection(initialView);

    // 5. 啟動通知標籤同步
    this.syncBadges();
    setInterval(() => this.syncBadges(), 60000); // 每一分鐘同步一次
  },

  checkAuth() {
    const token = localStorage.getItem("admin_token");
    if (!token && !window.location.pathname.includes("admin-login.html")) {
      window.location.href = "admin-login.html?reason=unauthorized";
      return false;
    }
    return true;
  },

  injectBaseLayout() {
    // 側邊欄注入
    const sidebarPlaceholder = document.getElementById("sidebar-placeholder");
    if (sidebarPlaceholder) {
      const menuHtml = this.menuConfig
        .filter(
          (item) =>
            !item.permission ||
            this.state.adminPermissions.includes(item.permission)
        )
        .map(
          (item) => `
          <li class="nav-item" data-nav-view="${item.view}">
            <a class="nav-link" href="#" onclick="layoutEngine.loadSection('${
              item.view
            }')">
              <i class="${item.icon}"></i>
              <span>${item.label}</span>
              ${
                item.badgeId
                  ? `<span id="${item.badgeId}" class="badge-notify" style="display:none">0</span>`
                  : ""
              }
            </a>
          </li>
        `
        )
        .join("");

      sidebarPlaceholder.innerHTML = `
        <ul class="navbar-nav bg-gradient-primary sidebar sidebar-dark accordion" id="accordionSidebar">
          <a class="sidebar-brand d-flex align-items-center justify-content-center" href="admin-dashboard.html">
            <div class="sidebar-brand-icon rotate-n-15"><i class="fas fa-piggy-bank"></i></div>
            <div class="sidebar-brand-text mx-3">小跑豬管理<sup>2026</sup></div>
          </a>
          <hr class="sidebar-divider my-0">
          ${menuHtml}
          <hr class="sidebar-divider">
          <div class="text-center d-none d-md-inline">
            <button class="rounded-circle border-0" id="sidebarToggle"></button>
          </div>
        </ul>
        <div id="mobile-overlay" class="sidebar-overlay"></div>
      `;
    }

    // 頂欄注入 (Topbar)
    const topbarPlaceholder = document.getElementById("topbar-placeholder");
    if (topbarPlaceholder) {
      topbarPlaceholder.innerHTML = `
        <nav class="navbar navbar-expand navbar-light bg-white topbar mb-4 static-top shadow">
          <button id="sidebarToggleTop" class="btn btn-link d-md-none rounded-circle mr-3"><i class="fa fa-bars"></i></button>
          <div class="topbar-breadcrumb d-none d-sm-block">系統管理中心 / <strong id="current-view-title">載入中</strong></div>
          <ul class="navbar-nav ml-auto">
            <li class="nav-item dropdown no-arrow">
              <a class="nav-link dropdown-toggle" href="#" id="userDropdown">
                <span class="mr-2 d-none d-lg-inline text-gray-600 small">${this.state.adminName} (${this.state.adminRole})</span>
                <div class="img-profile-circle"><i class="fas fa-user-shield"></i></div>
              </a>
              <div class="dropdown-menu dropdown-menu-right shadow animated--grow-in">
                <a class="dropdown-item" href="#" id="layoutLogoutBtn"><i class="fas fa-sign-out-alt fa-sm fa-fw mr-2 text-gray-400"></i>安全登出</a>
              </div>
            </li>
          </ul>
        </nav>
      `;
    }
  },

  /**
   * SPA 核心：加載 HTML 碎片並初始化 JS 模組
   */
  async loadSection(viewName) {
    if (this.state.currentSection === viewName) return;

    const container = document.getElementById("admin-main-content");
    if (!container) return;

    // 顯示 Loading
    container.innerHTML = `<div class="admin-loading-spinner"><i class="fas fa-circle-notch fa-spin"></i> 同步數據中...</div>`;

    try {
      const response = await fetch(`${this.state.sectionPath}${viewName}.html`);
      if (!response.ok) throw new Error("分頁載入失敗");
      const html = await response.text();

      container.innerHTML = html;
      this.state.currentSection = viewName;

      // 更新介面狀態
      this.updateActiveUI(viewName);

      // ❗【啟動業務邏輯】❗
      this.initBusinessModule(viewName);

      // 更新 URL
      const newUrl = `${window.location.pathname}?view=${viewName}`;
      window.history.pushState({ view: viewName }, "", newUrl);
    } catch (err) {
      container.innerHTML = `<div class="alert alert-danger">加載失敗：${err.message}</div>`;
    }
  },

  initBusinessModule(viewName) {
    const moduleName = this.state.moduleMap[viewName];
    if (
      moduleName &&
      window[moduleName] &&
      typeof window[moduleName].init === "function"
    ) {
      console.log(`📦 [Bridge] 啟動業務模組: ${moduleName}`);
      window[moduleName].init();
    }
  },

  updateActiveUI(viewName) {
    // 側邊欄高亮
    document
      .querySelectorAll("[data-nav-view]")
      .forEach((el) => el.classList.remove("active"));
    document
      .querySelector(`[data-nav-view="${viewName}"]`)
      ?.classList.add("active");

    // 標題更新
    const item = this.menuConfig.find((m) => m.view === viewName);
    const titleEl = document.getElementById("current-view-title");
    if (titleEl && item) titleEl.innerText = item.label;
  },

  /**
   * 通知標籤即時同步
   */
  async syncBadges() {
    try {
      const res = await apiClient.get("/api/admin/reports/stats");
      if (res.stats?.badges) {
        const { packages, shipments, furniture, finance } = res.stats.badges;
        this.updateBadgeUI("badge-packages", packages);
        this.updateBadgeUI("badge-shipments", shipments);
        this.updateBadgeUI("badge-furniture", furniture);
        this.updateBadgeUI("badge-finance", finance);
      }
    } catch (error) {
      console.warn("[Badge] 同步跳過");
    }
  },

  updateBadgeUI(id, count) {
    const el = document.getElementById(id);
    if (!el) return;
    const num = parseInt(count) || 0;
    if (num > 0) {
      el.innerText = num > 99 ? "99+" : num;
      el.style.display = "inline-block";
    } else {
      el.style.display = "none";
    }
  },

  bindEvents() {
    // 監聽登出
    document.addEventListener("click", (e) => {
      if (e.target.closest("#layoutLogoutBtn")) {
        if (confirm("確定登出？")) {
          localStorage.clear();
          window.location.href = "admin-login.html";
        }
      }

      // 側邊欄開關 (Mobile)
      if (
        e.target.closest("#sidebarToggleTop") ||
        e.target.closest("#sidebarToggle")
      ) {
        document.querySelector(".sidebar").classList.toggle("toggled");
      }
    });
  },
};

// 曝露給全域並啟動
window.layoutEngine = adminLayout;
document.addEventListener("DOMContentLoaded", () => adminLayout.init());
