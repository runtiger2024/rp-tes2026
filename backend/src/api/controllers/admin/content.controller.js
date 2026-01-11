// backend/src/api/controllers/admin/content.controller.js
const contentService = require("../../../services/infrastructure/content.service");
const prisma = require("../../../../config/db");

/**
 * 管理公告 (News)
 */
exports.manageNews = async (req, res) => {
  try {
    const { id } = req.params;
    const news = await contentService.upsertNews(id, req.body);
    res.json({
      success: true,
      news,
      message: id ? "公告已更新" : "公告已建立",
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteNews = async (req, res) => {
  await prisma.news.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: "公告已刪除" });
};

/**
 * 管理常見問題 (FAQ)
 */
exports.manageFaq = async (req, res) => {
  try {
    const { id } = req.params;
    const faq = await contentService.upsertFaq(id, req.body);
    res.json({ success: true, faq, message: id ? "FAQ 已更新" : "FAQ 已建立" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
