// backend/src/services/infrastructure/content.service.js
const prisma = require("../../../config/db");

class ContentService {
  // ==========================
  // --- 最新消息 (News) 邏輯 ---
  // ==========================

  async getNewsList({ category, search, isPublished = true, take = 50 }) {
    const where = {
      ...(isPublished !== null && { isPublished }),
      ...(category && category !== "ALL" && { category }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { content: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    return await prisma.news.findMany({
      where,
      orderBy: [
        { isImportant: "desc" }, // 重要公告優先置頂
        { createdAt: "desc" },
      ],
      take,
    });
  }

  async upsertNews(id, data) {
    if (id) {
      return await prisma.news.update({ where: { id }, data });
    }
    return await prisma.news.create({ data });
  }

  // ==========================
  // --- 常見問題 (FAQ) 邏輯 ---
  // ==========================

  async getFaqList({ category, search, isActive = true }) {
    const where = {
      ...(isActive !== null && { isActive }),
      ...(category && category !== "ALL" && { category }),
      ...(search && {
        OR: [
          { question: { contains: search, mode: "insensitive" } },
          { answer: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    return await prisma.fAQ.findMany({
      where,
      orderBy: { order: "asc" }, // 依管理員定義順序
    });
  }

  async upsertFaq(id, data) {
    if (id) {
      return await prisma.fAQ.update({ where: { id }, data });
    }
    return await prisma.fAQ.create({ data });
  }
}

module.exports = new ContentService();
