// backend/src/services/logistics/shipment.service.js
const prisma = require("../../../config/db");
const pricingService = require("./pricing.service");

class ShipmentService {
  /**
   * 建立集運單 (旗艦整合支付流水版)
   */
  async createShipment(userId, data) {
    const { packageIds, paymentMethod, ...shippingInfo } = data;

    return await prisma.$transaction(async (tx) => {
      // 1. 驗證包裹狀態 (確保為入庫狀態且屬於該用戶)
      const packages = await tx.package.findMany({
        where: { id: { in: packageIds }, userId, status: "IN_WAREHOUSE" },
      });

      if (packages.length !== packageIds.length) {
        throw new Error("部分包裹狀態異常，請刷新頁面");
      }

      // 2. 調用 V18 定價引擎 (整合 V17 材積計費邏輯)
      const calc = await pricingService.calculateSeaFreight(
        packages,
        shippingInfo.deliveryLocationRate
      );
      const totalCost = calc.summary.finalTotal;

      // 3. 生成自定義編號 (SPG-日期-隨機)
      const shipmentNo = `SPG${Date.now().toString().slice(-8)}`;

      // 4. 餘額支付：執行 User.balance 扣款並寫入 WalletTransaction 流水
      let transactionId = null;
      if (paymentMethod === "WALLET") {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (user.balance < totalCost) throw new Error("錢包餘額不足");

        // 建立財務流水 (TransactionType: PAYMENT)
        const walletTx = await tx.walletTransaction.create({
          data: {
            userId,
            amount: -totalCost,
            type: "PAYMENT",
            status: "COMPLETED",
            description: `支付運單: ${shipmentNo}`,
            referenceId: shipmentNo,
            balanceBefore: user.balance,
            balanceAfter: user.balance - totalCost,
          },
        });

        // 扣除使用者餘額
        await tx.user.update({
          where: { id: userId },
          data: { balance: { decrement: totalCost } },
        });

        transactionId = walletTx.id;
      }

      // 5. 建立運單
      const shipment = await tx.shipment.create({
        data: {
          shipmentNo,
          userId,
          ...shippingInfo,
          totalWeight: calc.summary.totalWeight,
          chargeableWeight: calc.summary.chargeableWeight,
          shippingFee: calc.summary.baseShippingFee,
          finalAmount: totalCost,
          status: paymentMethod === "WALLET" ? "PAID" : "UNPAID",
          paymentMethod,
          paidAt: paymentMethod === "WALLET" ? new Date() : null,
        },
      });

      // 6. 更新包裹狀態為 PROCESSING (打包中)
      await tx.package.updateMany({
        where: { id: { in: packageIds } },
        data: { status: "PROCESSING", shipmentId: shipment.id },
      });

      return shipment;
    });
  }

  /**
   * 狀態流轉控制 (支援 V18.1 詳細狀態)
   */
  async updateShipmentStatus(shipmentId, newStatus, adminNote) {
    return await prisma.shipment.update({
      where: { id: shipmentId },
      data: { status: newStatus, adminNote },
    });
  }
}

module.exports = new ShipmentService();
