// backend/src/api/routes/client.routes.js
const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const { verifyLineSignature } = require("../middlewares/line.middleware");

const authController = require("../controllers/auth.controller");
const packageController = require("../controllers/package.controller");
const shipmentController = require("../controllers/shipment.controller");
const walletController = require("../controllers/wallet.controller");
const furnitureController = require("../controllers/furniture.controller");
const contentController = require("../controllers/content.controller");
const lineController = require("../controllers/line.controller");

// 公開路由
router.post("/auth/register", authController.register);
router.post("/auth/login", authController.login);
router.get("/content/news", contentController.getNews);
router.get("/content/faq", contentController.getFaqs);

// LINE Webhook (需獨立驗證簽章)
router.post("/line/webhook", verifyLineSignature, lineController.handleWebhook);

// 需要登入的路由 (JWT 保護)
router.use(protect);
router.get("/user/profile", authController.getProfile);
router.get("/packages", packageController.getMyPackages);
router.post("/shipments/create", shipmentController.create);
router.get("/wallet/balance", walletController.getMyWallet);
router.post("/furniture/apply", furnitureController.apply);

// 收件人管理 (完整 CRUD)
router.get("/recipients", memberController.getMyRecipients);
router.post("/recipients", memberController.addRecipient);
router.put("/recipients/:id", memberController.updateRecipient); // 補回
router.delete("/recipients/:id", memberController.deleteRecipient); // 補回

// 集運單進階操作
router.get("/shipments", shipmentController.getMyShipments); // 補回清單
router.get("/shipments/:id", shipmentController.getDetails); // 補回詳情
router.post("/shipments/preview", shipmentController.preview); // 補回預估
router.post("/shipments/:id/proof", shipmentController.uploadProof); // 補回憑證上傳
router.delete("/shipments/:id", shipmentController.cancel); // 補回取消

// 家具代購清單
router.get("/furniture/my", furnitureController.getMyOrders); // 補回清單

// 靜態內容
router.get("/content/about", contentController.getAbout); // 補回品牌介紹

// --- 補全後的路由清單 ---
router.get("/user/recipients", memberController.getMyRecipients);
router.put("/user/recipients/:id", memberController.updateRecipient); // 遺漏
router.delete("/user/recipients/:id", memberController.deleteRecipient); // 遺漏

router.post("/shipments/preview", shipmentController.preview); // 遺漏
router.post("/shipments/:id/proof", shipmentController.uploadProof); // 遺漏
router.get("/shipments/:id", shipmentController.getDetails); // 遺漏

router.get("/furniture/my", furnitureController.getMyOrders); // 遺漏

module.exports = router;
