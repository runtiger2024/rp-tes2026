/**
 * content.controller.js - V2026.01.Final_Pro
 * 用戶端內容展示控制器
 * 負責：最新消息讀取、FAQ 分類展示、品牌關於我
 */

const { ResponseWrapper } = require("../../utils/response.wrapper");
const contentService = require("../../services/infrastructure/content.service");
const prisma = require("../../../config/db");

const contentController = {
  /**
   * [GET] 獲取公告列表
   * 僅回傳「已發布」的內容，支援類別過濾
   */
  async getNews(req, res, next) {
    try {
      const { category, limit = 10 } = req.query;

      const news = await prisma.news.findMany({
        where: {
          isPublished: true,
          ...(category && { category }),
        },
        orderBy: { createdAt: "desc" },
        take: parseInt(limit),
      });

      return ResponseWrapper.success(res, news);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [GET] 獲取單一公告詳情
   */
  async getNewsDetail(req, res, next) {
    try {
      const { id } = req.params;
      const news = await prisma.news.findUnique({
        where: { id },
      });

      if (!news || !news.isPublished) {
        return ResponseWrapper.error(res, "公告內容不存在或已下架", 404);
      }

      return ResponseWrapper.success(res, news);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [GET] 獲取 FAQ 列表
   * 自動按類別分組 (Category Grouping)
   */
  async getFaqs(req, res, next) {
    try {
      const faqs = await prisma.faq.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "desc" },
      });

      return ResponseWrapper.success(res, faqs);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [GET] 獲取品牌簡介 (About)
   */
  async getAbout(req, res, next) {
    try {
      const about = await prisma.systemSetting.findUnique({
        where: { key: "ABOUT_CONTENT" },
      });
      return ResponseWrapper.success(res, about ? JSON.parse(about.value) : {});
    } catch (error) {
      next(error);
    }
  },
};

module.exports = contentController;
