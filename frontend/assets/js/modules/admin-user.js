/**
 * admin-user.js - 管理端會員與財務稽核核心模組 (V2026 旗艦版)
 * 負責：會員名單管理、人工手動調帳、儲值憑證稽核(Finance Audit)
 */
import { apiClient } from "../api/apiClient.js";

export const adminUserModule = {
  state: {
    allUsers: [],
    allDeposits: [],
    currentUser: null,
    currentDeposit: null,
    searchQuery: "",
    filterRole: "all",
  },

  /**
   * 初始化：加載用戶名單與待審核儲值
   */
  async init() {
    console.log("👥 Admin User & Finance Module Initializing...");
    this.fetchUsers();
    this.fetchDeposits(); // 若在財務分頁則執行
  },

  // ==========================================
  // 1. 會員管理邏輯 (Member Management)
  // ==========================================

  async fetchUsers() {
    const tbody = document.getElementById("admin-members-table-body");
    if (!tbody) return;

    try {
      const res = await apiClient.get("/api/admin/users", {
        params: { search: this.state.searchQuery, role: this.state.filterRole },
      });
      this.state.allUsers = res.data || [];

      tbody.innerHTML = this.state.allUsers
        .map(
          (u) => `
        <tr>
          <td>
            <div style="font-weight:800; color:#1e293b;">${
              u.name || "未填寫"
            }</div>
            <div style="font-size:11px; color:#94a3b8;">${u.email}</div>
          </td>
          <td><code style="color:#4f46e5; font-weight:700;">${
            u.piggyId || "---"
          }</code></td>
          <td><span class="badge-${u.role.toLowerCase()}">${u.role}</span></td>
          <td><div style="font-weight:700; color:#22c55e;">$${u.balance?.toLocaleString()}</div></td>
          <td>${u.status === "ACTIVE" ? "✅ 正常" : "🔒 鎖定"}</td>
          <td class="text-right">
            <button class="btn-admin-sm" onclick="window.adminUserModule.openMemberModal('${
              u.id
            }')">
              <i class="fas fa-user-edit"></i> 管理
            </button>
          </td>
        </tr>
      `
        )
        .join("");
    } catch (err) {
      console.error("載入會員名單失敗:", err);
    }
  },

  /**
   * 開啟會員編輯與調帳彈窗 (對接 member-edit-modal.html)
   */
  async openMemberModal(id) {
    try {
      const res = await apiClient.get(`/api/admin/users/${id}`);
      const u = res.data;
      this.state.currentUser = u;

      window.modalManager.open("member-edit-modal");

      setTimeout(() => {
        document.getElementById("m-id").value = u.id;
        document.getElementById("m-display-name").innerText = u.name || u.email;
        document.getElementById("m-display-piggyId").innerText = u.piggyId;
        document.getElementById("m-name").value = u.name || "";
        document.getElementById("m-phone").value = u.phone || "";
        document.getElementById("m-email").value = u.email;
        document.getElementById("m-balance").innerText =
          u.balance?.toLocaleString();
        document.getElementById("m-role").value = u.role;
        document.getElementById("m-status").value = u.status;

        // 重置調帳欄位
        document.getElementById("m-adj-amount").value = "";
        document.getElementById("m-adj-reason").value = "";

        // 渲染角色標籤
        const badgeBox = document.getElementById("m-role-badge");
        badgeBox.innerHTML = `<span class="badge-${u.role.toLowerCase()}">${
          u.role
        }</span>`;
      }, 150);
    } catch (err) {
      alert("讀取會員詳情失敗");
    }
  },

  /**
   * 提交更新：含基本資料修改與「人工手動調帳」
   */
  async updateMember() {
    const id = document.getElementById("m-id").value;
    const adjAmount = parseFloat(
      document.getElementById("m-adj-amount").value || 0
    );
    const adjReason = document.getElementById("m-adj-reason").value.trim();

    const body = {
      name: document.getElementById("m-name").value,
      phone: document.getElementById("m-phone").value,
      role: document.getElementById("m-role").value,
      status: document.getElementById("m-status").value,
      walletAdjustment:
        adjAmount !== 0 ? { amount: adjAmount, reason: adjReason } : null,
    };

    try {
      await apiClient.put(`/api/admin/users/${id}`, body);
      alert("會員資料與財務數據已成功更新！");
      window.modalManager.close();
      this.fetchUsers();
    } catch (err) {
      alert("更新失敗：" + err.message);
    }
  },

  // ==========================================
  // 2. 財務稽核邏輯 (Finance / Deposit Audit)
  // ==========================================

  async fetchDeposits() {
    const tbody = document.getElementById("admin-deposits-table-body");
    if (!tbody) return;

    try {
      const res = await apiClient.get("/api/admin/deposits/pending");
      this.state.allDeposits = res.data || [];

      tbody.innerHTML = this.state.allDeposits
        .map(
          (d) => `
        <tr>
          <td>${new Date(d.createdAt).toLocaleDateString()}</td>
          <td>${d.user?.name} (${d.user?.piggyId})</td>
          <td style="font-weight:800; color:#d32f2f;">$${d.amount.toLocaleString()}</td>
          <td><code>${d.note || "---"}</code></td>
          <td class="text-right">
            <button class="btn-admin-sm success" onclick="window.adminUserModule.openAuditModal('${
              d.id
            }')">
              <i class="fas fa-file-invoice-dollar"></i> 審核入帳
            </button>
          </td>
        </tr>
      `
        )
        .join("");
    } catch (err) {
      console.error("載入儲值申請失敗:", err);
    }
  },

  /**
   * 開啟財務稽核彈窗 (對接 deposit-audit-modal.html)
   */
  async openAuditModal(id) {
    try {
      const res = await apiClient.get(`/api/admin/deposits/${id}`);
      const d = res.data;
      this.state.currentDeposit = d;

      window.modalManager.open("deposit-audit-modal");

      setTimeout(() => {
        document.getElementById("da-id").value = d.id;
        document.getElementById("da-user-info").innerText = d.user?.name;
        document.getElementById("da-piggy-id").innerText = d.user?.piggyId;
        document.getElementById("da-created-at").innerText = new Date(
          d.createdAt
        ).toLocaleString();
        document.getElementById("da-amount").innerText =
          d.amount.toLocaleString();
        document.getElementById("da-note").innerText = d.note || "無備註";

        // B2B 邏輯
        if (d.taxId) {
          document.getElementById("da-b2b-section").style.display = "block";
          document.getElementById("da-taxId").innerText = d.taxId;
          document.getElementById("da-invoiceTitle").innerText = d.invoiceTitle;
        } else {
          document.getElementById("da-b2b-section").style.display = "none";
        }

        // 圖片憑證
        const img = document.getElementById("da-proof-img");
        const noImg = document.getElementById("da-no-proof");
        if (d.proofImage) {
          img.src = d.proofImage;
          img.style.display = "block";
          noImg.style.display = "none";
        } else {
          img.style.display = "none";
          noImg.style.display = "block";
        }
      }, 150);
    } catch (err) {
      alert("讀取憑證詳情失敗");
    }
  },

  /**
   * 執行審核動作 (通過/駁回)
   */
  async auditDeposit(status, rejectReason = "") {
    const id = document.getElementById("da-id").value;

    try {
      await apiClient.post(`/api/admin/deposits/${id}/audit`, {
        status,
        rejectReason,
      });

      alert(
        status === "COMPLETED"
          ? "入帳審核成功！款項已撥入用戶錢包。"
          : "申請已駁回。"
      );
      window.modalManager.close();
      this.fetchDeposits();
      this.fetchUsers(); // 更新會員分頁的餘額顯示
    } catch (err) {
      alert("審核操作失敗：" + err.message);
    }
  },
};

// 曝露給全域
window.adminUserModule = adminUserModule;
// 為了相容財務彈窗內的直接呼叫
window.adminFinanceModule = {
  auditDeposit: adminUserModule.auditDeposit.bind(adminUserModule),
};
