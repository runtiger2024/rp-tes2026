// backend/src/api/controllers/calculator.controller.js
const pricingService = require("../../services/logistics/pricing.service");
const prisma = require("../../../config/db");

exports.estimateFreight = async (req, res) => {
  try {
    const { items, locationRate } = req.body;
    const userId = req.user?.id;

    // 獲取該用戶的等級折扣 (專業版新增)
    let discountRate = 1.0;
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { tier: true },
      });
      discountRate = user?.tier?.discountRate || 1.0;
    }

    const result = await pricingService.calculateSeaFreight(
      items,
      parseFloat(locationRate) || 0,
      discountRate
    );

    return res.status(200).json(result);
  } catch (error) {
    console.error("[Calculator] Error:", error);
    res
      .status(500)
      .json({ success: false, message: "計算失敗，請檢查輸入參數內容" });
  }
};
