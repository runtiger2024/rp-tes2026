// backend/src/services/logistics/pricing.service.js
const ratesHelper = require("../../utils/rates.helper");

class PricingService {
  /**
   * 核心計費引擎：計算海運運費與附加費
   * @param {Array} items - 包裹清單 [{ length, width, height, weight, category }]
   * @param {Number} remoteAreaRate - 該地區的加收費率
   * @param {Number} userDiscountRate - 會員等級折扣 (例如 0.95 代表 95 折)
   */
  async calculateSeaFreight(items, remoteAreaRate = 0, userDiscountRate = 1.0) {
    const config = await ratesHelper.getRates();
    const { constants } = config;

    let totalShipmentVolume = 0;
    let totalShipmentWeight = 0;
    let initialSeaFreightCost = 0;
    let totalOverweightFee = 0;
    let totalOversizedFee = 0;

    let hasAnyOverweight = false;
    let hasAnyOversized = false;

    // 1. 逐件計算基礎費用與附加費
    const itemDetails = items.map((item) => {
      const { length, width, height, weight, category } = item;

      // 計算才數 (Cai)
      const volumeCai = (length * width * height) / constants.VOLUME_DIVISOR;
      const rateInfo = ratesHelper.getCategoryRate(config, category);

      // 擇大計費邏輯 (才數 vs 重量)
      const freightByVolume = volumeCai * rateInfo.volumeRate;
      const freightByWeight = weight * rateInfo.weightRate;
      const baseFreight = Math.max(freightByVolume, freightByWeight);

      // 檢查超重與超長
      const isOverweight = weight > constants.OVERWEIGHT_LIMIT;
      const isOversized =
        Math.max(length, width, height) > constants.OVERSIZED_LIMIT;

      if (isOverweight) hasAnyOverweight = true;
      if (isOversized) hasAnyOversized = true;

      totalShipmentVolume += volumeCai;
      totalShipmentWeight += weight;
      initialSeaFreightCost += baseFreight;

      return {
        ...item,
        volumeCai: parseFloat(volumeCai.toFixed(2)),
        baseFreight: Math.round(baseFreight),
        isOverweight,
        isOversized,
      };
    });

    // 2. 處理全單附加費
    if (hasAnyOverweight) totalOverweightFee = constants.OVERWEIGHT_FEE || 0;
    if (hasAnyOversized) totalOversizedFee = constants.OVERSIZED_FEE || 0;

    // 3. 計算偏遠地區費 (依 CBM)
    const totalCbm = totalShipmentVolume / constants.CBM_TO_CAI_FACTOR;
    const remoteFee = Math.round(totalCbm * remoteAreaRate);

    // 4. 計算總金額與會員折扣
    const subTotal =
      initialSeaFreightCost +
      totalOverweightFee +
      totalOversizedFee +
      remoteFee;
    const finalTotal = Math.round(subTotal * userDiscountRate);
    const discountAmount = subTotal - finalTotal;

    return {
      success: true,
      summary: {
        totalCai: parseFloat(totalShipmentVolume.toFixed(2)),
        totalCbm: parseFloat(totalCbm.toFixed(4)),
        totalWeight: totalShipmentWeight,
        baseFreight: Math.round(initialSeaFreightCost),
        remoteFee,
        totalOverweightFee,
        totalOversizedFee,
        discountAmount,
        finalTotal,
      },
      itemDetails,
      configSnapshot: constants, // 保留當時計費標準快照
    };
  }
}

module.exports = new PricingService();
