// backend/config/db.js
// 用於全域資料庫連接實例
const { PrismaClient } = require("@prisma/client");

// 初始化 Prisma Client
const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development"
      ? ["query", "info", "warn", "error"]
      : ["error"],
});

/**
 * 確保資料庫連線正常
 */
async function connectDB() {
  try {
    await prisma.$connect();
    console.log("✅ 資料庫連線成功 (Prisma Engine)");
  } catch (err) {
    console.error("❌ 資料庫連線失敗:", err.message);
    process.exit(1);
  }
}

connectDB();

module.exports = prisma;
