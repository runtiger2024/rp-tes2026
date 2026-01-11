// backend/src/api/controllers/admin/ops.controller.js
const configService = require("../../../services/infrastructure/config.service");
const prisma = require("../../../../config/db");
const { sendNewShipmentNotification } = require("../../../utils/sendEmail");

/**
 * 系統設定管理 (整合 V16.1 & V2026.1.1)
 */
exports.getSystemSettings = async (req, res) => {
  const settings = await configService.getSettings(true);
  res.json({ success: true, settings });
};

exports.updateSettings = async (req, res) => {
  try {
    await configService.updateSettings(req.body, req.user.id);
    res.json({ success: true, message: "設定儲存成功" });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * 測試 Email 功能
 */
exports.sendTestEmail = async (req, res) => {
  try {
    const mockShipment = {
      id: "TEST-001",
      recipientName: "測試管理員",
      totalCost: 1000,
    };
    await sendNewShipmentNotification(mockShipment, req.user);
    res.json({ success: true, message: "測試郵件已發送至您的信箱" });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

/**
 * 附加服務項目 CRUD
 */
exports.getServiceItems = async (req, res) => {
  const items = await prisma.shipmentServiceItem.findMany({
    orderBy: { createdAt: "desc" },
  });
  res.json({ success: true, items });
};

exports.createServiceItem = async (req, res) => {
  const { name, price, unit, isActive } = req.body;
  const newItem = await prisma.shipmentServiceItem.create({
    data: {
      name,
      price: parseFloat(price) || 0,
      unit: unit || "PIECE",
      isActive: isActive ?? true,
    },
  });
  res.status(201).json({ success: true, item: newItem });
};

exports.deleteServiceItem = async (req, res) => {
  const { id } = req.params;
  await prisma.shipmentServiceItem.delete({ where: { id } });
  res.json({ success: true, message: "服務項目已刪除" });
};
