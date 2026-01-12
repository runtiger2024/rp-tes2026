/**
 * admin/content.controller.js - V2026.01.Final_Pro
 * 管理端 CMS 控制器
 * 負責：公告管理(CRUD)、FAQ管理(CRUD)、靜態頁面編輯
 */

const { ResponseWrapper } = require("../../../utils/response.wrapper");
const prisma = require("../../../../config/db");

const contentAdminController = {
  // ==========================================
  // 1. 公告管理 (News Management)
  // ==========================================

  /** 獲取所有公告 (含未發布) */
  async getAllNews(req, res, next) {
    try {
      const news = await prisma.news.findMany({
        orderBy: { createdAt: "desc" },
      });
      return ResponseWrapper.success(res, news);
    } catch (error) {
      next(error);
    }
  },

  /** 創建或更新公告 (Upsert) */
  async upsertNews(req, res, next) {
    try {
      const { id, title, content, excerpt, category, isPublished } = req.body;

      const data = {
        title,
        content,
        excerpt: excerpt || content.substring(0, 50),
        category: category || "GENERAL",
        isPublished: isPublished ?? true,
        authorId: req.user.id,
      };

      let result;
      if (id) {
        result = await prisma.news.update({ where: { id }, data });
      } else {
        result = await prisma.news.create({ data });
      }

      return ResponseWrapper.success(res, result, "公告儲存成功");
    } catch (error) {
      next(error);
    }
  },

  /** 刪除公告 */
  async deleteNews(req, res, next) {
    try {
      await prisma.news.delete({ where: { id: req.params.id } });
      return ResponseWrapper.success(res, null, "公告已移除");
    } catch (error) {
      next(error);
    }
  },

  // ==========================================
  // 2. 常見問題管理 (FAQ Management)
  // ==========================================

  /** 獲取所有 FAQ */
  async getAllFaqs(req, res, next) {
    try {
      const faqs = await prisma.faq.findMany({
        orderBy: [{ category: "asc" }, { sortOrder: "desc" }],
      });
      return ResponseWrapper.success(res, faqs);
    } catch (error) {
      next(error);
    }
  },

  /** 儲存 FAQ */
  async upsertFaq(req, res, next) {
    try {
      const { id, question, answer, category, isActive, sortOrder } = req.body;

      const data = {
        question,
        answer,
        category: category || "others",
        isActive: isActive ?? true,
        sortOrder: parseInt(sortOrder) || 0,
      };

      let result;
      if (id) {
        result = await prisma.faq.update({ where: { id }, data });
      } else {
        result = await prisma.faq.create({ data });
      }

      return ResponseWrapper.success(res, result, "FAQ 儲存成功");
    } catch (error) {
      next(error);
    }
  },

  /** 刪除 FAQ */
  async deleteFaq(req, res, next) {
    try {
      await prisma.faq.delete({ where: { id: req.params.id } });
      return ResponseWrapper.success(res, null, "FAQ 已移除");
    } catch (error) {
      next(error);
    }
  },

  // ==========================================
  // 3. 靜態內容編輯 (Static Content)
  // ==========================================

  /** 更新品牌介紹 */
  async updateAbout(req, res, next) {
    try {
      const { title, content } = req.body;
      const value = JSON.stringify({ title, content, updatedAt: new Date() });

      const result = await prisma.systemSetting.upsert({
        where: { key: "ABOUT_CONTENT" },
        update: { value },
        create: { key: "ABOUT_CONTENT", value },
      });

      return ResponseWrapper.success(res, result, "品牌簡介已更新");
    } catch (error) {
      next(error);
    }
  },
};

module.exports = contentAdminController;
