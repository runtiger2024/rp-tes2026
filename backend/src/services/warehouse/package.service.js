// backend/src/services/warehouse/package.service.js
const prisma = require("../../../config/db");

class PackageService {
  /**
   * 認領無主包裹
   */
  async claimPackage(userId, trackingNumber, proofPath) {
    const pkg = await prisma.package.findUnique({
      where: { trackingNumber: trackingNumber.trim() },
    });

    if (!pkg) throw new Error("找不到該單號，請確認單號正確或已入庫");

    // 檢查是否已被他人預報
    if (pkg.userId && pkg.status === "PENDING") {
      throw new Error("此包裹已被其他會員預報");
    }

    return await prisma.package.update({
      where: { id: pkg.id },
      data: { userId, claimProof: proofPath },
    });
  }

  /**
   * 倉庫入庫操作 (量測尺寸與重量)
   */
  async warehouseInbound(packageId, boxData) {
    // boxData: [{length, width, height, weight, type}]
    return await prisma.$transaction(async (tx) => {
      const pkg = await tx.package.update({
        where: { id: packageId },
        data: {
          status: "IN_WAREHOUSE",
          arrivedAt: new Date(),
          // 儲存詳細箱規資料於 JSON 欄位
          warehouseNote: JSON.stringify(boxData),
        },
      });

      // 此處可觸發 LINE 通知
      return pkg;
    });
  }
}

module.exports = new PackageService();
