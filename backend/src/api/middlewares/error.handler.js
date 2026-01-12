import { ResponseWrapper } from "../../utils/response.wrapper.js";
import { logger } from "../../utils/logger.js";

export const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || "伺服器內部錯誤";

  // 記錄錯誤日誌
  logger.error(`[API Error] ${req.method} ${req.url} - ${message}`, {
    stack: err.stack,
  });

  // 針對 Prisma 的特殊錯誤處理 (例如找不到資料)
  if (err.code === "P2025") {
    return ResponseWrapper.error(res, "找不到該筆資料", 404, "NOT_FOUND");
  }

  // 針對 JWT 驗證錯誤
  if (err.name === "UnauthorizedError" || status === 401) {
    return ResponseWrapper.error(
      res,
      "憑證失效，請重新登入",
      401,
      "AUTH_EXPIRED"
    );
  }

  return ResponseWrapper.error(
    res,
    message,
    status,
    err.errorCode || "SYSTEM_ERROR"
  );
};
