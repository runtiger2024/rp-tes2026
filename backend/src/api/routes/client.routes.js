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

module.exports = router;
