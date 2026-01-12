/**
 * admin/content.controller.js - V2026.01.Final_Pro_Integrated
 * 管理端 CMS 控制器 (終極整合優化版)
 * 整合功能：
 * 1. 公告管理 (支援重要標記、分類過濾與分頁)
 * 2. 常見問題 FAQ 管理 (支援排序與啟用狀態控制)
 * 3. 靜態頁面 CMS (支援多鍵值如 ABOUT_US, TERMS_OF_SERVICE 等)
 */

const { ResponseWrapper } = require("../../../utils/response.wrapper");
const prisma = require("../../../../config/db");

const contentAdminController = {
  // ==========================================
  // 1. 公告管理 (News Management)
  // ==========================================

  /**
   * [GET] getNews - 獲取公告清單
   * 優化：新增分類過濾與排序邏輯
   */
  async getNews(req, res, next) {
    try {
      const { category, isPublished } = req.query;

      const where = {
        ...(category && { category }),
        ...(isPublished !== undefined && {
          isPublished: isPublished === "true",
        }),
      };

      const news = await prisma.news.findMany({
        where,
        orderBy: [
          { isImportant: "desc" }, // 重要公告置頂
          { createdAt: "desc" },
        ],
      });

      return ResponseWrapper.success(res, news);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [POST/PUT] createOrUpdateNews - 創建或更新公告 (Upsert)
   * 優化：對接 isImportant 欄位並強化摘要生成
   */
  async createOrUpdateNews(req, res, next) {
    try {
      const {
        id,
        title,
        content,
        excerpt,
        category,
        isPublished,
        isImportant,
      } = req.body;

      if (!title || !content) {
        return ResponseWrapper.error(res, "標題與內容為必填項目", 400);
      }

      const data = {
        title,
        content,
        excerpt: excerpt || content.replace(/<[^>]+>/g, "").substring(0, 100), // 自動生成純文本摘要
        category: category || "GENERAL",
        isPublished: isPublished ?? true,
        isImportant: isImportant ?? false,
        // 若 Schema 支援作者關聯，可保留此行：authorId: req.user.id,
      };

      let result;
      if (id) {
        result = await prisma.news.update({
          where: { id },
          data: { ...data, updatedAt: new Date() },
        });
      } else {
        result = await prisma.news.create({ data });
      }

      return ResponseWrapper.success(
        res,
        result,
        id ? "公告更新成功" : "公告創建成功"
      );
    } catch (error) {
      next(error);
    }
  },

  /** 刪除公告 */
  async deleteNews(req, res, next) {
    try {
      const { id } = req.params;
      await prisma.news.delete({ where: { id } });
      return ResponseWrapper.success(res, null, "公告已永久移除");
    } catch (error) {
      next(error);
    }
  },

  // ==========================================
  // 2. 常見問題管理 (FAQ Management)
  // ==========================================

  /** 獲取所有 FAQ (含管理端排序) */
  async getAllFaqs(req, res, next) {
    try {
      const faqs = await prisma.faq.findMany({
        orderBy: [
          { category: "asc" },
          { order: "asc" }, // V18 Schema 使用 order 欄位進行排序
        ],
      });
      return ResponseWrapper.success(res, faqs);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [POST/PUT] updateFaq - 儲存或更新 FAQ
   * 優化：統一參數處理與數值轉型
   */
  async updateFaq(req, res, next) {
    try {
      const { id, question, answer, category, isActive, order } = req.body;

      if (!question || !answer) {
        return ResponseWrapper.error(res, "問題與答案不可為空", 400);
      }

      const data = {
        question,
        answer,
        category: category || "LOGISTICS",
        isActive: isActive ?? true,
        order: parseInt(order) || 0,
      };

      let result;
      if (id) {
        result = await prisma.faq.update({ where: { id }, data });
      } else {
        result = await prisma.faq.create({ data });
      }

      return ResponseWrapper.success(res, result, "FAQ 資訊已同步");
    } catch (error) {
      next(error);
    }
  },

  /** 刪除 FAQ */
  async deleteFaq(req, res, next) {
    try {
      await prisma.faq.delete({ where: { id: req.params.id } });
      return ResponseWrapper.success(res, null, "常見問題已移除");
    } catch (error) {
      next(error);
    }
  },

  // ==========================================
  // 3. 靜態內容編輯 (Static Content)
  // ==========================================

  /**
   * [PUT] updateStatic - 更新靜態頁面內容 (品牌介紹/協議等)
   * 優化：支援多鍵值更新，對接 StaticContent 模型而非 SystemSetting
   */
  async updateStatic(req, res, next) {
    try {
      const { key, title, content, isActive } = req.body;

      if (!key || !title || !content) {
        return ResponseWrapper.error(
          res,
          "缺少必要參數 (key, title, content)",
          400
        );
      }

      // 使用 StaticContent 模型進行 Upsert，這比 SystemSetting 更符合 CMS 邏輯
      const result = await prisma.staticContent.upsert({
        where: { key },
        update: {
          title,
          content,
          isActive: isActive ?? true,
          updatedAt: new Date(),
        },
        create: {
          key,
          title,
          content,
          isActive: isActive ?? true,
        },
      });

      return ResponseWrapper.success(res, result, `靜態內容 [${key}] 已更新`);
    } catch (error) {
      next(error);
    }
  },

  /** * [GET] 獲取單筆靜態內容詳情 (供後台編輯器初始化)
   */
  async getStaticDetail(req, res, next) {
    try {
      const { key } = req.params;
      const content = await prisma.staticContent.findUnique({
        where: { key },
      });

      if (!content) {
        return ResponseWrapper.error(res, "找不到對應的靜態內容", 404);
      }
      return ResponseWrapper.success(res, content);
    } catch (error) {
      next(error);
    }
  },
};

module.exports = contentAdminController;
