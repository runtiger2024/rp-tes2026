// backend/src/utils/generateToken.js
const jwt = require("jsonwebtoken");

/**
 * 簽發 JWT Token
 * @param {string} id - 用戶的資料庫 ID
 */
const generateToken = (id) => {
  // 從環境變數讀取密鑰，若無則使用預設值（正式環境務必設置 JWT_SECRET）
  const secret = process.env.JWT_SECRET || "runtiger_secret_2026";

  return jwt.sign({ id }, secret, {
    expiresIn: "30d", // 登入有效期限為 30 天
  });
};

module.exports = generateToken;
