/**
 * admin-layout.js
 * V2026.01.Final_Pro - 專業佈局與權限導航引擎
 * 負責：側邊欄生成、權限檢查、即時數據標籤同步、安全登出
 */

document.addEventListener("DOMContentLoaded", () => {
  // 1. 讀取管理員資訊 (從 localStorage 獲取)
  const adminToken = localStorage.getItem("admin_token");
  const adminName = localStorage.getItem("admin_name") || "管理員";
  const adminRole = localStorage.getItem("admin_role") || "STAFF";
  const adminPermissions = JSON.parse(
    localStorage.getItem("admin_permissions") || "[]"
  );

  // 2. 初始安全攔截 (Auth Guard)
  const currentPath = window.location.pathname;
  if (!adminToken && !currentPath.includes("admin-login.html")) {
    window.location.href = "admin-login.html?reason=unauthorized";
    return;
  }
  if (currentPath.includes("admin-login.html")) return;

  /**
   * 3. 定義導航選單配置 (含權限過濾)
   * 每個項目定義了對應的權限標籤，若管理員不具備該權限則不會顯示
   */
  const menuItems = [
    {
      label: "營運儀表板",
      icon: "fas fa-tachometer-alt",
      href: "admin-dashboard.html",
      permission: "DASHBOARD_VIEW",
    },
    {
      label: "包裹管理",
      icon: "fas fa-boxes",
      href: "admin-parcels.html",
      permission: "PACKAGE_VIEW",
      badgeId: "badge-packages", // 對應即時統計數據
    },
    {
      label: "集運單管理",
      icon: "fas fa-truck-loading",
      href: "admin-shipments.html",
      permission: "SHIPMENT_VIEW",
      badgeId: "badge-shipments",
    },
    {
      label: "無主包裹認領",
      icon: "fas fa-question-circle",
      href: "admin-unclaimed.html",
      permission: "PACKAGE_VIEW",
    },
    {
      label: "財務審核",
      icon: "fas fa-money-check-alt",
      href: "admin-finance.html",
      permission: "FINANCE_VIEW",
      badgeId: "badge-finance",
    },
    {
      label: "會員資料管理",
      icon: "fas fa-users",
      href: "admin-members.html",
      permission: "USER_VIEW",
    },
    {
      label: "家具代購訂單",
      icon: "fas fa-couch",
      href: "admin-furniture.html",
      permission: "FURNITURE_VIEW",
      badgeId: "badge-furniture",
    },
    {
      label: "系統操作日誌",
      icon: "fas fa-history",
      href: "admin-logs.html",
      permission: "LOGS_VIEW",
    },
    {
      label: "全站營運設定",
      icon: "fas fa-cogs",
      href: "admin-settings.html",
      permission: "SYSTEM_CONFIG",
    },
  ];

  /**
   * 4. 執行佈局注入 (Sidebar & Topbar)
   */
  injectLayout();

  function injectLayout() {
    // A. 側邊欄注入
    const sidebarPlaceholder = document.getElementById("sidebar-placeholder");
    if (sidebarPlaceholder) {
      const activeItem = menuItems.find((item) =>
        currentPath.includes(item.href)
      );

      const filteredMenu = menuItems
        .filter(
          (item) =>
            !item.permission || adminPermissions.includes(item.permission)
        )
        .map(
          (item) => `
          <li class="nav-item ${
            currentPath.includes(item.href) ? "active" : ""
          }">
            <a class="nav-link" href="${item.href}">
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
          ${filteredMenu}
          <hr class="sidebar-divider d-none d-md-block">
          <div class="text-center d-none d-md-inline">
            <button class="rounded-circle border-0" id="sidebarToggle"></button>
          </div>
        </ul>
        <div id="mobile-overlay" class="sidebar-overlay"></div>
      `;
    }

    // B. 頂欄注入 (Topbar)
    const topbarPlaceholder = document.getElementById("topbar-placeholder");
    if (topbarPlaceholder) {
      topbarPlaceholder.innerHTML = `
        <button id="sidebarToggleTop" class="btn btn-link d-md-none rounded-circle mr-3">
          <i class="fa fa-bars"></i>
        </button>
        <div class="topbar-breadcrumb d-none d-sm-block">小跑豬專業物流中心 / <strong>${
          document.title.split("-")[0]
        }</strong></div>
        <ul class="navbar-nav ml-auto">
          <div class="topbar-divider d-none d-sm-block"></div>
          <li class="nav-item dropdown no-arrow">
            <a class="nav-link dropdown-toggle" href="#" id="userDropdown">
              <span class="mr-2 d-none d-lg-inline text-gray-600 small">${adminName} (${adminRole})</span>
              <div class="img-profile-circle"><i class="fas fa-user-shield"></i></div>
            </a>
            <div class="dropdown-menu dropdown-menu-right shadow animated--grow-in">
              <a class="dropdown-item" href="admin-settings.html"><i class="fas fa-cogs fa-sm fa-fw mr-2 text-gray-400"></i>個人設定</a>
              <div class="dropdown-divider"></div>
              <a class="dropdown-item" href="#" id="layoutLogoutBtn"><i class="fas fa-sign-out-alt fa-sm fa-fw mr-2 text-gray-400"></i>安全登出</a>
            </div>
          </li>
        </ul>
      `;
    }
  }

  /**
   * 5. 同步通知標籤 (Badge Syncing)
   * 透過後端 report/stats 介面獲取待處理事項數量
   */
  const syncBadges = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/reports/stats`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      if (data.stats?.badges) {
        const { packages, shipments, furniture, finance } = data.stats.badges;
        updateBadgeUI("badge-packages", packages);
        updateBadgeUI("badge-shipments", shipments);
        updateBadgeUI("badge-furniture", furniture);
        updateBadgeUI("badge-finance", finance);
      }
    } catch (error) {
      console.warn("[Badge Sync] 通知同步失敗:", error.message);
    }
  };

  function updateBadgeUI(id, count) {
    const el = document.getElementById(id);
    if (!el) return;
    const num = parseInt(count) || 0;
    if (num > 0) {
      el.innerText = num > 99 ? "99+" : num;
      el.style.display = "inline-block";
    } else {
      el.style.display = "none";
    }
  }

  // 每 2 分鐘自動同步一次通知數量
  syncBadges();
  setInterval(syncBadges, 120000);

  /**
   * 6. 事件監聽 (側邊欄切換、登出)
   */
  document.addEventListener("click", (e) => {
    // 側邊欄開關 (Mobile)
    if (
      e.target.closest("#sidebarToggleTop") ||
      e.target.closest("#sidebarToggle")
    ) {
      document.querySelector(".sidebar").classList.toggle("toggled");
      document.getElementById("mobile-overlay")?.classList.toggle("show");
    }

    // 遮罩關閉
    if (e.target.id === "mobile-overlay") {
      document.querySelector(".sidebar").classList.remove("toggled");
      e.target.classList.remove("show");
    }

    // 安全登出邏輯
    if (e.target.closest("#layoutLogoutBtn")) {
      e.preventDefault();
      if (confirm("您確定要退出管理系統嗎？")) {
        localStorage.clear();
        window.location.href = "admin-login.html";
      }
    }

    // 用戶下拉選單切換
    if (e.target.closest("#userDropdown")) {
      e.preventDefault();
      document.querySelector(".dropdown-menu").classList.toggle("show");
    } else {
      document.querySelector(".dropdown-menu")?.classList.remove("show");
    }
  });
});
