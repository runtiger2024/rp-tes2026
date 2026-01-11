// backend/src/api/middlewares/error.handler.js
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  console.error(`[Error Log] ${err.name}: ${err.message}`);

  // Prisma 唯一限制錯誤 (如: Email 已存在)
  if (err.code === "P2002") {
    const field = err.meta?.target?.[0] || "欄位";
    error.message = `該 ${field} 已經被使用，請更換後再試`;
    error.statusCode = 400;
  }

  // JWT 錯誤
  if (err.name === "JsonWebTokenError") {
    error.message = "無效的登入憑證";
    error.statusCode = 401;
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "伺服器內部錯誤",
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};

module.exports = errorHandler;
