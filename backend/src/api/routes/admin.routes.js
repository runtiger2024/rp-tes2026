/**
 * admin.routes.js - V2026.01.Final_Pro_Full_Integrated
 * 管理端核心路由集：整合物流 ERP、CMS、財務審計與代購模組
 * * 整合重點：
 * 1. 保留 V17 所有功能：改價、發票控制、會員模擬、CMS (News/FAQ/About)
 * 2. 新增 V2026 功能：Dashboard 紅點同步 (Badges)、分箱入庫邏輯、家具代購最低服務費報價
 * 3. 強化安全性：統一使用 protect 與 authorize 中介軟體
 */

const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/auth.middleware");

// 引入各模組控制器
const userAdmin = require("../controllers/admin/user.controller");
const opsAdmin = require("../controllers/admin/ops.controller");
const financeAdmin = require("../controllers/admin/finance.controller");
const shipmentAdmin = require("../controllers/admin/shipment.controller");
const contentAdmin = require("../controllers/admin/content.controller");
const furnitureAdmin = require("../controllers/admin/furniture.controller");
const reportAdmin = require("../controllers/admin/report.controller");

// 全域權限鎖：必須登入且具備 ADMIN, FINANCE 或 WAREHOUSE 角色
router.use(protect);
router.use(authorize("ADMIN", "FINANCE", "WAREHOUSE"));

// ==========================================
// 1. 數據中心與報表 (Dashboard & Reports)
// ==========================================
// 獲取儀表板統計數據
router.get("/reports/dashboard", reportAdmin.getDashboardStats);
// 同步側邊欄紅點標籤 (對接 admin-layout.js)
router.get("/reports/badges", reportAdmin.getBadgeStats);
// 獲取近七日營運趨勢
router.get("/reports/weekly-trend", reportAdmin.getWeeklyTrend);

// ==========================================
// 2. 會員與權限管理 (User Management)
// ==========================================
// 會員清單與搜尋
router.get("/users", userAdmin.getUsers);
// 獲取單一會員詳情與資信狀況
router.get("/users/:id", userAdmin.getUserDetail);
// 建立員工/管理員帳號 (移植自 V17 核心)
router.post("/users/staff", userAdmin.createStaff);
// 更新會員資料、調整角色或人工調帳
router.put("/users/:id", userAdmin.updateUser);
// 強制重置會員密碼 (預設 888888)
router.put("/users/:id/reset-password", userAdmin.resetPassword);
// 刪除會員 (含業務未結清檢查)
router.delete("/users/:id", userAdmin.deleteUser);
// 管理員模擬登入 (客服協助功能)
router.post("/users/:id/impersonate", userAdmin.impersonate);

// ==========================================
// 3. 財務審計與儲值管理 (Finance & Audit)
// ==========================================
// 獲取財務統計數據
router.get("/finance/stats", financeAdmin.getFinanceStats);
// 獲取待審核儲值申請清單
router.get("/finance/deposits", userAdmin.getPendingDeposits);
// 審核儲值申請 (通過/駁回)
router.post("/finance/deposits/:id/audit", userAdmin.auditDeposit);

// ==========================================
// 4. 物流營運 - 包裹與入庫 (Logistics - Parcels)
// ==========================================
// 獲取包裹清單 (含狀態過濾)
router.get("/ops/parcels", opsAdmin.getParcels);
// 獲特包裹詳細內容與分箱數據
router.get("/ops/parcels/:id", opsAdmin.getParcelDetail);
// 執行入庫：更新狀態、分箱邏輯、上傳實拍照
router.put("/ops/parcels/:id/inbound", opsAdmin.updateParcelInbound);

// ==========================================
// 5. 物流營運 - 集運單管理 (Logistics - Shipments)
// ==========================================
// 獲取所有集運單清單
router.get("/shipments", shipmentAdmin.getAllShipments);
// 獲取集運單詳情 (含物品清單與費用細項)
router.get("/shipments/:id", shipmentAdmin.getDetail);
// 財務修正：人工調整運費與附加費
router.put("/shipments/:id/price", shipmentAdmin.adjustPrice);
// 審核集運單：核定重量與材積
router.post("/shipments/:id/approve", shipmentAdmin.approve);
// 批次更新運單狀態 (出庫、運輸中、送達)
router.put("/shipments/bulk-status", shipmentAdmin.bulkUpdateStatus);

// ==========================================
// 6. 家具代購業務 (Furniture Procurement)
// ==========================================
// 獲取家具訂單清單
router.get("/furniture/orders", furnitureAdmin.getOrders);
// 獲取單一家具訂單詳情
router.get("/furniture/orders/:id", furnitureAdmin.getOrderDetail);
// 家具報價：整合最低服務費與匯率計算
router.put("/furniture/orders/:id/quote", furnitureAdmin.quoteOrder);
// 更新代購狀態與上傳採購憑證
router.patch("/furniture/orders/:id/status", furnitureAdmin.updateStatus);
// 批次刪除家具訂單紀錄
router.post("/furniture/bulk-delete", furnitureAdmin.bulkDelete);

// ==========================================
// 7. 系統設定與附加服務 (System Settings)
// ==========================================
// 獲取系統全域設定 (匯率、公告等)
router.get("/ops/settings", opsAdmin.getSystemSettings);
// 更新系統設定
router.put("/ops/settings", opsAdmin.updateSettings);
// 測試 Email 發送功能
router.post("/ops/settings/test-email", opsAdmin.sendTestEmail);

// 附加服務清單管理 (加固、釘木架等)
router
  .route("/ops/service-items")
  .get(opsAdmin.getServiceItems)
  .post(opsAdmin.createServiceItem);
router.delete("/ops/service-items/:id", opsAdmin.deleteServiceItem);

// ==========================================
// 8. CMS 內容管理系統 (Content Management)
// ==========================================
// 最新消息管理 (CRUD & Upsert)
router
  .route("/content/news")
  .get(contentAdmin.getAllNews)
  .post(contentAdmin.upsertNews);
router.delete("/content/news/:id", contentAdmin.deleteNews);

// 常見問題管理 (CRUD & Upsert)
router
  .route("/content/faq")
  .get(contentAdmin.getAllFaqs)
  .post(contentAdmin.upsertFaq);
router.delete("/content/faq/:id", contentAdmin.deleteFaq);

// 靜態頁面內容編輯 (關於我們/服務協議)
router.put("/content/about", contentAdmin.updateAbout);

module.exports = router;
