/**
 * backend/src/api/middlewares/error.handler.js
 * 專業物流架構 V2026.01 全域錯誤攔截器 (終極優化版)
 * 整合功能：
 * 1. 分類處理 Prisma 數據庫異常 (P2002, P2003, P2025)
 * 2. 處理 Multer 檔案上傳容量與類型異常
 * 3. 處理 JWT / 權限校驗失敗
 * 4. 環境感知：開發模式回傳 Stack Trace，生產模式隱藏敏感資訊
 * 5. 確保與 ResponseWrapper 響應規範 100% 對接
 */

const { ResponseWrapper } = require("../../utils/response.wrapper");
const { logger } = require("../../utils/logger");

const errorHandler = (err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || "伺服器內部錯誤";
  let errorCode = err.errorCode || "SYSTEM_ERROR";

  // 1. [核心記錄]：詳細記錄錯誤日誌至外部檔案或 Console
  logger.error(`[API Error] ${req.method} ${req.originalUrl} - ${message}`, {
    stack: err.stack,
    ip: req.ip,
    userId: req.user ? req.user.id : "GUEST",
  });

  // 2. [Prisma 特殊錯誤處理]：將數據庫底層錯誤轉化為商業語義
  if (err.code) {
    switch (err.code) {
      case "P2002": // Unique constraint failed (例如 Email 已存在)
        status = 409;
        const target = err.meta?.target ? `[${err.meta.target}] ` : "";
        message = `資料重複衝突：${target}該紀錄已存在於系統中`;
        errorCode = "DUPLICATE_ENTRY";
        break;
      case "P2003": // Foreign key constraint failed (例如刪除尚有包裹的會員)
        status = 400;
        message =
          "資料關聯保護：無法執行此操作，請先檢查相關聯的業務數據 (如包裹、運單)";
        errorCode = "FOREIGN_KEY_CONFLICT";
        break;
      case "P2025": // Record to update/delete not found
        status = 404;
        message = "找不到該筆資料，或該資料已被移除";
        errorCode = "NOT_FOUND";
        break;
      default:
        // 其他 Prisma 錯誤統一處理
        if (err.code.startsWith("P")) {
          status = 400;
          message = `數據庫操作異常 (${err.code})`;
          errorCode = "DATABASE_ERROR";
        }
        break;
    }
  }

  // 3. [認證與權限錯誤處理]
  if (err.name === "UnauthorizedError" || status === 401) {
    status = 401;
    message = "憑證失效或無權訪問，請重新登入";
    errorCode = "AUTH_EXPIRED";
  } else if (status === 403) {
    message = "權限不足：您不具備執行此操作的管理權限";
    errorCode = "FORBIDDEN_ACCESS";
  }

  // 4. [檔案上傳錯誤處理 - Multer]
  if (err.code === "LIMIT_FILE_SIZE") {
    status = 400;
    message = "上傳檔案過大，請勿超過系統限制 (建議 5MB 以內)";
    errorCode = "FILE_TOO_LARGE";
  }

  // 5. [環境感知響應]
  // 若在生產環境 (Production)，隱藏堆疊追蹤以確保安全性
  const isDev = process.env.NODE_ENV === "development";

  return ResponseWrapper.error(
    res,
    message,
    status,
    errorCode,
    isDev ? { stack: err.stack, details: err.meta } : null
  );
};

module.exports = errorHandler;
