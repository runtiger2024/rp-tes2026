// backend/src/api/controllers/admin/report.controller.js
// 優化自 admin/reportController.js
const prisma = require("../../../../config/db");

exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 並行執行所有統計，提升後台加載速度
    const [totalUser, newUserToday, pendingShipments, pendingFurniture] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { createdAt: { gte: today } } }),
        prisma.shipment.count({ where: { status: "UNPAID" } }),
        prisma.furnitureOrder.count({ where: { status: "PENDING" } }), // 整合代購統計
      ]);

    res.json({
      success: true,
      stats: { totalUser, newUserToday, pendingShipments, pendingFurniture },
    });
  } catch (error) {
    res.status(500).json({ message: "統計讀取失敗" });
  }
};
