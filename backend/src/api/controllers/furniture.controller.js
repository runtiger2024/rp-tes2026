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

    res
      .status(201)
      .json({
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
