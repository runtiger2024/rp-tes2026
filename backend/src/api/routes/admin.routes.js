// backend/src/api/routes/admin.routes.js
const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middlewares/auth.middleware");

const userAdmin = require("../controllers/admin/user.controller");
const opsAdmin = require("../controllers/admin/ops.controller");
const financeAdmin = require("../controllers/admin/finance.controller");
const shipmentAdmin = require("../controllers/admin/shipment.controller");
const contentAdmin = require("../controllers/admin/content.controller");
const furnitureAdmin = require("../controllers/admin/furniture.controller");
const reportAdmin = require("../controllers/admin/report.controller");

// 權限鎖：僅限 ADMIN 或指定角色進入
router.use(protect);
router.use(authorize("ADMIN", "FINANCE", "WAREHOUSE"));

// 1. 會員管理
router.get("/users", userAdmin.getUsers);
router.post("/users/:id/impersonate", userAdmin.impersonate); // 客服模擬登入

// 2. 財務與審核
router.get("/finance/stats", financeAdmin.getFinanceStats);
router.post("/finance/deposits/:id/review", financeAdmin.reviewDeposit);

// 3. 物流營運
router.get("/ops/settings", opsAdmin.getSystemSettings);
router.put("/ops/settings", opsAdmin.updateSettings);
router.get("/ops/service-items", opsAdmin.getServiceItems);
router.post("/ops/service-items", opsAdmin.createServiceItem);

// 4. 代購業務
router.get("/furniture/orders", furnitureAdmin.getOrders);
router.patch("/furniture/orders/:id", furnitureAdmin.updateOrder);
router.post("/furniture/bulk-delete", furnitureAdmin.bulkDelete);

// 5. 數據中心 (Dashboard)
router.get("/reports/dashboard", reportAdmin.getDashboardStats);

module.exports = router;
