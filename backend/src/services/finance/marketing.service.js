// backend/src/services/finance/marketing.service.js
const prisma = require("../../../config/db");

class MarketingService {
  /**
   * 計算並發放運費返利點數 (例如：每 100 元贈送 1 點)
   */
  async rewardPointsForShipment(userId, shipmentAmount) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { tier: true },
    });
    const multiplier = user.tier?.pointMultiplier || 1.0;
    const pointsToAdd = Math.floor((shipmentAmount / 100) * multiplier);

    if (pointsToAdd <= 0) return null;

    return await prisma.pointLog.create({
      data: {
        userId,
        points: pointsToAdd,
        reason: `集運單返利 (加權倍率: ${multiplier})`,
      },
    });
  }

  /**
   * 校驗優惠券可用性
   */
  async validateCoupon(code, userId, shipmentAmount) {
    const userCoupon = await prisma.userCoupon.findFirst({
      where: { code, userId, isUsed: false, expireAt: { gte: new Date() } },
    });

    if (!userCoupon) throw new Error("優惠券無效或已過期");

    // 如果有最低消費限制
    if (userCoupon.minThreshold && shipmentAmount < userCoupon.minThreshold) {
      throw new Error(`未達最低消費金額 NT$${userCoupon.minThreshold}`);
    }

    return userCoupon;
  }
}

module.exports = new MarketingService();
