// backend/src/api/controllers/furniture.controller.js
const furnitureService = require("../../services/logistics/furniture.service");
const prisma = require("../../../config/db");

exports.apply = async (req, res) => {
  try {
    const refImageUrl = req.file ? req.file.path : null;
    const order = await furnitureService.createOrder(
      req.user.id,
      req.body,
      refImageUrl
    );

    res.status(201).json({
      success: true,
      message: "代購申請已送出，請等待客服報價",
      order,
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getMyOrders = async (req, res) => {
  const orders = await prisma.furnitureOrder.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
  });
  res.json({ success: true, orders });
};

exports.cancelMyOrder = async (req, res) => {
  const { id } = req.params;
  const order = await prisma.furnitureOrder.findFirst({
    where: { id, userId: req.user.id },
  });

  if (!order || order.status !== "PENDING") {
    return res.status(400).json({ message: "訂單處理中或已不存在，無法撤回" });
  }

  await prisma.furnitureOrder.delete({ where: { id } });
  res.json({ success: true, message: "申請已撤回" });
};

// 使用者獲取自己的代購清單 (舊版已有的核心功能)
exports.getMyOrders = async (req, res) => {
  const orders = await prisma.furnitureOrder.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
  });
  res.json({ success: true, orders });
};

// 管理員審核與上傳 Cloudinary 發票圖片 (整合 V17 修正邏輯)
exports.adminUpdateOrder = async (req, res) => {
  const { id } = req.params;
  const { status, adminRemark } = req.body;

  // 處理來自 Cloudinary 的 HTTPS 網址，防止破圖
  const invoiceUrl = req.file ? req.file.path : req.body.invoiceUrl;

  const order = await prisma.furnitureOrder.update({
    where: { id },
    data: {
      status,
      adminRemark,
      invoiceUrl: invoiceUrl ? invoiceUrl.replace("http://", "https://") : null,
      updatedAt: new Date(),
    },
  });

  // 發送 LINE/系統通知 (整合自 V17)
  res.json({ success: true, order });
};
