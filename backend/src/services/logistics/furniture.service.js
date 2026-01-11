// backend/src/services/logistics/furniture.service.js
const prisma = require("../../../config/db");
const configService = require("../infrastructure/config.service");

class FurnitureService {
  /**
   * 建立家具代購訂單 (含金額換算邏輯)
   */
  async createOrder(userId, data, refImageUrl) {
    const { factoryName, productName, quantity, priceRMB, note, productUrl } =
      data;

    // 1. 獲取系統當前家具設定 (匯率與手續費)
    const settings = await configService.getMaskedSettings();
    const config = settings.furniture_config || {
      exchangeRate: 4.65,
      serviceFeeRate: 0.05,
      minServiceFee: 500,
    };

    // 2. 數值強健性校驗 (整合自 V2026.1.11)
    const parsedQty = parseInt(quantity) || 1;
    const parsedPriceRMB = parseFloat(priceRMB) || 0;

    // 計算初步金額 (RMB -> TWD)
    const subtotalTWD = Math.round(
      parsedPriceRMB * parsedQty * config.exchangeRate
    );
    const serviceFee = Math.max(
      Math.round(subtotalTWD * config.serviceFeeRate),
      config.minServiceFee
    );
    const totalAmountTWD = subtotalTWD + serviceFee;

    return await prisma.furnitureOrder.create({
      data: {
        userId,
        factoryName,
        productName,
        quantity: parsedQty,
        priceRMB: parsedPriceRMB,
        exchangeRate: config.exchangeRate,
        subtotalTWD,
        serviceFee,
        totalAmountTWD,
        productUrl,
        refImage: refImageUrl, // 支援 Cloudinary HTTPS 完整網址
        note,
        status: "PENDING",
      },
    });
  }

  /**
   * 狀態更新校驗 (防止非法跳轉)
   */
  async updateStatus(orderId, newStatus, adminNote) {
    const order = await prisma.furnitureOrder.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new Error("找不到該訂單");

    // 如果訂單已結案，禁止修改
    if (order.status === "COMPLETED" || order.status === "CANCELLED") {
      throw new Error("已結案之訂單無法修改狀態");
    }

    return await prisma.furnitureOrder.update({
      where: { id: orderId },
      data: { status: newStatus, adminNote },
    });
  }
}

module.exports = new FurnitureService();
