// backend/src/app.js
// 專業物流架構 V2026 最終集成版
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const errorHandler = require("./api/middlewares/error.handler");
require("dotenv").config();

const app = express();

// 1. [核心優化]：自定義 Body Parser 以擷取 Raw Body (LINE Webhook 驗證必需)
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf; // 將原始 Buffer 存入 req.rawBody
    },
  })
);
app.use(express.urlencoded({ extended: true }));

// 2. 安全性與跨域配置
app.use(helmet()); // 增加安全性標頭
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
    credentials: true,
  })
);

// 3. 靜態資源 (本地上傳備援)
app.use("/uploads", express.static(path.join(__dirname, "../public/uploads")));

// 4. 註冊模組化路由
const clientRoutes = require("./api/routes/client.routes");
const adminRoutes = require("./api/routes/admin.routes");

app.use("/api/v1/client", clientRoutes);
app.use("/api/v1/admin", adminRoutes);

// 5. 系統狀態檢查
app.get("/health", (req, res) =>
  res.json({ status: "OK", version: "V18.0-Pro" })
);

// 6. 全域錯誤攔截 (放在所有路由之後)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 小跑豬專業物流伺服器已啟動：http://localhost:${PORT}`);
});
