// backend/src/services/logistics/shipment.service.js
const prisma = require("../../../config/db");
const pricingService = require("./pricing.service");
const walletService = require("../finance/wallet.service");

class ShipmentService {
  /**
   * 建立集運單 (含支付邏輯)
   */
  async createShipment(userId, data) {
    const { packageIds, paymentMethod, ...shippingInfo } = data;

    return await prisma.$transaction(async (tx) => {
      // 1. 鎖定並驗證包裹狀態
      const packages = await tx.package.findMany({
        where: { id: { in: packageIds }, userId, status: "IN_WAREHOUSE" },
      });

      if (packages.length !== packageIds.length) {
        throw new Error("部分包裹狀態異常或不屬於該用戶");
      }

      // 2. 調用定價引擎計算最終費用
      const calc = await pricingService.calculateSeaFreight(
        packages,
        shippingInfo.deliveryLocationRate
      );
      const totalCost = calc.summary.finalTotal;

      // 3. 生成專業編號 (RP-USER-DATE-RAND)
      const shipmentNo = `SPG${Date.now().toString().slice(-8)}`;

      // 4. 處理錢包扣款 (若選擇餘額支付)
      let transactionId = null;
      if (paymentMethod === "WALLET") {
        const walletTx = await walletService.adjustBalance(tx, {
          userId,
          amount: -totalCost,
          type: "PAYMENT",
          description: `支付運單: ${shipmentNo}`,
          referenceId: shipmentNo,
        });
        transactionId = walletTx.id;
      }

      // 5. 建立運單紀錄
      const shipment = await tx.shipment.create({
        data: {
          shipmentNo,
          userId,
          ...shippingInfo,
          totalWeight: calc.summary.totalWeight,
          finalAmount: totalCost,
          status: paymentMethod === "WALLET" ? "PAID" : "UNPAID",
          // 關聯已支付的事務 ID
        },
      });

      // 6. 批次更新包裹狀態
      await tx.package.updateMany({
        where: { id: { in: packageIds } },
        data: { status: "PROCESSING", shipmentId: shipment.id },
      });

      return shipment;
    });
  }

  /**
   * 管理員調價 (含自動補扣款/退款)
   */
  async adjustPrice(shipmentId, newAmount, reason) {
    return await prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({
        where: { id: shipmentId },
      });
      const diff = shipment.finalAmount - newAmount;

      if (shipment.paymentMethod === "WALLET") {
        await walletService.adjustBalance(tx, {
          userId: shipment.userId,
          amount: diff, // 正值代表退回，負值代表補扣
          type: diff > 0 ? "REFUND" : "ADJUSTMENT",
          description: `運單改價${diff > 0 ? "退回" : "補扣"}: ${reason}`,
          referenceId: shipment.shipmentNo,
        });
      }

      return await tx.shipment.update({
        where: { id: shipmentId },
        data: { finalAmount: newAmount },
      });
    });
  }
}

module.exports = new ShipmentService();
