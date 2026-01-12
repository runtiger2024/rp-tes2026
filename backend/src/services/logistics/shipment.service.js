/**
 * shipment.service.js - V2026.01.Final_Pro_Integrated
 * 集運單核心業務邏輯服務 (旗艦整合版)
 * 整合功能：
 * 1. 支援 V18.1 材積/重量定價引擎與錢包支付流水。
 * 2. 實作人工改價 (adjustPrice) 邏輯，支援增減項與管理員備註。
 * 3. 實作運單審核 (approveShipment) 流程，確保從待審核到正式出單的狀態流轉。
 * 4. 嚴格的狀態檢查與數據一致性事務 (Prisma Transaction)。
 */

const prisma = require("../../../config/db");
const pricingService = require("./pricing.service");

class ShipmentService {
  /**
   * 建立集運單 (旗艦整合支付流水版)
   * 支援：包裹狀態檢核、V18 定價試算、錢包扣款、財務流水紀錄
   */
  async createShipment(userId, data) {
    const { packageIds, paymentMethod, ...shippingInfo } = data;

    return await prisma.$transaction(async (tx) => {
      // 1. 驗證包裹狀態 (確保為入庫狀態且屬於該用戶)
      const packages = await tx.package.findMany({
        where: { id: { in: packageIds }, userId, status: "IN_WAREHOUSE" },
      });

      if (packages.length !== packageIds.length) {
        throw new Error("部分包裹狀態異常或已申請過集運，請刷新頁面");
      }

      // 2. 調用定價引擎 (整合 V17 材積計費與 V18 附加服務)
      const calc = await pricingService.calculateSeaFreight(
        packages,
        shippingInfo.deliveryLocationRate
      );
      const totalCost = calc.summary.finalTotal;

      // 3. 生成自定義編號 (SPG-日期戳)
      const shipmentNo = `SPG${Date.now().toString().slice(-8)}`;

      // 4. 餘額支付處理
      let transactionId = null;
      if (paymentMethod === "WALLET") {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (user.balance < totalCost) throw new Error("錢包餘額不足，請先儲值");

        // 建立財務流水 (TransactionType: PAYMENT)
        const walletTx = await tx.walletTransaction.create({
          data: {
            userId,
            amount: totalCost,
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

      // 5. 建立正式運單
      // 預設狀態調整：若已支付則為 PAID，未支付則為 UNPAID (若系統強制審核則設為 AWAITING_REVIEW)
      const shipment = await tx.shipment.create({
        data: {
          shipmentNo,
          userId,
          ...shippingInfo,
          totalWeight: calc.summary.totalWeight,
          chargeableWeight: calc.summary.chargeableWeight,
          shippingFee: calc.summary.baseShippingFee,
          serviceFee: calc.summary.serviceFeeTotal || 0,
          finalAmount: totalCost,
          status: paymentMethod === "WALLET" ? "PAID" : "UNPAID",
          paymentMethod,
          paidAt: paymentMethod === "WALLET" ? new Date() : null,
        },
      });

      // 6. 更新包裹狀態為 PROCESSING (打包中) 並關聯運單 ID
      await tx.package.updateMany({
        where: { id: { in: packageIds } },
        data: { status: "PROCESSING", shipmentId: shipment.id },
      });

      return shipment;
    });
  }

  /**
   * [人工改價] adjustPrice (管理員專用)
   * 功能：手動調整運費、手續費，並自動更新最終應付金額
   */
  async adjustPrice(shipmentId, updateData, adminNote) {
    return await prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({
        where: { id: shipmentId },
        include: { user: true },
      });

      if (!shipment) throw new Error("找不到該運單");
      if (shipment.status === "PAID" || shipment.status === "SHIPPED") {
        throw new Error("運單已支付或已出貨，無法調整價格");
      }

      // 計算新的總金額
      const newShippingFee = updateData.shippingFee ?? shipment.shippingFee;
      const newServiceFee = updateData.serviceFee ?? shipment.serviceFee;
      const newFinalAmount = newShippingFee + newServiceFee;

      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          shippingFee: newShippingFee,
          serviceFee: newServiceFee,
          finalAmount: newFinalAmount,
          adminNote:
            adminNote ||
            `[價格調整] 原始金額 ${shipment.finalAmount} -> 新金額 ${newFinalAmount}`,
        },
      });

      return updated;
    });
  }

  /**
   * [運單審核] approveShipment (管理員專用)
   * 功能：核定運單詳情、核准價格、轉換狀態至待支付或已支付
   */
  async approveShipment(shipmentId, approvalData, adminNote) {
    return await prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({
        where: { id: shipmentId },
      });

      if (!shipment) throw new Error("運單不存在");

      // 更新狀態流轉：從 AWAITING_REVIEW (待審核) 轉向後續狀態
      // 若已支付(錢包先扣)則維持 PAID，未支付則轉為 UNPAID
      const nextStatus = shipment.paidAt ? "PAID" : "UNPAID";

      const updated = await tx.shipment.update({
        where: { id: shipmentId },
        data: {
          status: nextStatus,
          adminNote: adminNote || "運單審核通過",
          ...(approvalData.localCarrier && {
            localCarrier: approvalData.localCarrier,
          }),
          ...(approvalData.localTrackingNo && {
            localTrackingNo: approvalData.localTrackingNo,
          }),
          updatedAt: new Date(),
        },
      });

      // 同步更新關聯包裹的狀態
      if (nextStatus === "PAID") {
        await tx.package.updateMany({
          where: { shipmentId },
          data: { status: "PROCESSING" },
        });
      }

      return updated;
    });
  }

  /**
   * 狀態流轉控制 (支援 V18.1 詳細狀態)
   * 用於手動切換出貨、清關、抵達等狀態
   */
  async updateShipmentStatus(shipmentId, newStatus, adminNote) {
    return await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status: newStatus,
        adminNote,
        ...(newStatus === "ARRIVED" && { updatedAt: new Date() }),
      },
    });
  }
}

module.exports = new ShipmentService();
