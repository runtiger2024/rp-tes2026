// backend/src/api/controllers/content.controller.js
const contentService = require("../../services/infrastructure/content.service");
const prisma = require("../../../config/db");

/**
 * 取得公告列表
 */
exports.getNews = async (req, res) => {
  try {
    const news = await contentService.getNewsList(req.query);
    res.json({ success: true, count: news.length, news });
  } catch (error) {
    res.status(500).json({ success: false, message: "讀取消息失敗" });
  }
};

/**
 * 取得公告詳情
 */
exports.getNewsDetail = async (req, res) => {
  const news = await prisma.news.findUnique({ where: { id: req.params.id } });
  if (!news || !news.isPublished)
    return res.status(404).json({ message: "內容不存在" });
  res.json({ success: true, news });
};

/**
 * 取得 FAQ 列表
 */
exports.getFaqs = async (req, res) => {
  try {
    const faqs = await contentService.getFaqList(req.query);
    res.json({ success: true, count: faqs.length, faqs });
  } catch (error) {
    res.status(500).json({ success: false, message: "讀取 FAQ 失敗" });
  }
};
