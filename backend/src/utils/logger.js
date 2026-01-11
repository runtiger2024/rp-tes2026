// backend/src/utils/logger.js
const prisma = require("../../config/db");

/**
 * 專業審計日誌系統 (Audit Logger)
 */
const logger = {
  info: async (userId, action, details = {}, target = null) => {
    console.log(`[INFO] ${action}:`, details);
    try {
      await prisma.activityLog.create({
        data: {
          userId,
          action,
          target,
          details: typeof details === "object" ? details : { message: details },
        },
      });
    } catch (e) {
      console.error("日誌寫入失敗", e.message);
    }
  },

  error: async (userId, action, error, target = null) => {
    console.error(`[ERROR] ${action}:`, error);
    // 錯誤日誌通常會寫入更嚴格的追蹤系統
  },
};

module.exports = logger;
