// backend/src/api/controllers/furniture.controller.js
// V18.1 - 家具代購用戶端核心 (終極完善版)

const prisma = require("../../../config/db");
const { ResponseWrapper } = require("../../utils/response.wrapper");
const { logger } = require("../../utils/logger");

const furnitureController = {
  /**
   * [POST] 提交代購申請 (整合 V17 高精密計算與防錯)
   */
  async apply(req, res, next) {
    try {
      const { factoryName, productName, quantity, priceRMB, note, productUrl } =
        req.body;
      const userId = req.user.id;

      // 1. 基礎驗證與數值防錯 (移植自 V17 旗艦版)
      if (!factoryName || !productName || !quantity || !priceRMB) {
        return ResponseWrapper.error(res, "請填寫完整代購資訊", 400);
      }
      const pQty = parseInt(quantity);
      const pPrice = parseFloat(priceRMB);
      if (isNaN(pQty) || isNaN(pPrice) || pQty <= 0) {
        return ResponseWrapper.error(res, "數量或金額格式錯誤", 400);
      }

      // 2. 獲取系統費率設定 (抓取 furniture_config)
      const configSetting = await prisma.systemSetting.findUnique({
        where: { key: "furniture_config" },
      });
      let cfg = {
        exchangeRate: 4.65,
        serviceFeeRate: 0.05,
        minServiceFee: 500,
      };
      if (configSetting) {
        const dbVal =
          typeof configSetting.value === "string"
            ? JSON.parse(configSetting.value)
            : configSetting.value;
        cfg = { ...cfg, ...dbVal };
      }

      // 3. 核心費用精密試算
      const totalRMB = pPrice * pQty;
      const productTWD = totalRMB * cfg.exchangeRate;
      const rawFeeTWD = productTWD * cfg.serviceFeeRate;
      const finalFeeTWD = Math.max(rawFeeTWD, cfg.minServiceFee); // 執行最低服務費檢核
      const finalTotalTWD = Math.ceil(productTWD + finalFeeTWD);

      // 4. 處理圖片路徑 (整合 Cloudinary 安全網址)
      const refImageUrl = req.file ? req.file.path : null;

      const order = await prisma.furnitureOrder.create({
        data: {
          userId,
          factoryName,
          productName,
          productUrl,
          quantity: pQty,
          priceRMB: pPrice,
          exchangeRate: cfg.exchangeRate,
          serviceFeeRate: cfg.serviceFeeRate,
          serviceFeeRMB: finalFeeTWD / cfg.exchangeRate,
          totalAmountTWD: finalTotalTWD,
          note,
          refImageUrl,
          status: "PENDING",
        },
      });

      logger.info(
        `[Furniture] User ${userId} applied for ${productName} - TWD ${finalTotalTWD}`
      );
      return ResponseWrapper.success(
        res,
        order,
        "代購申請已送出，請等待客服確認",
        201
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [GET] 獲取我的訂單清單
   */
  async getMyOrders(req, res, next) {
    try {
      const orders = await prisma.furnitureOrder.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: "desc" },
      });
      return ResponseWrapper.success(res, orders);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [DELETE] 撤回申請 (僅限 PENDING)
   */
  async cancelMyOrder(req, res, next) {
    try {
      const { id } = req.params;
      const order = await prisma.furnitureOrder.findFirst({
        where: { id, userId: req.user.id },
      });

      if (!order || order.status !== "PENDING") {
        return ResponseWrapper.error(
          res,
          "訂單已在處理中或不存在，無法撤回",
          400
        );
      }

      await prisma.furnitureOrder.delete({ where: { id } });
      return ResponseWrapper.success(res, null, "申請已成功撤回");
    } catch (error) {
      next(error);
    }
  },
};

module.exports = furnitureController;
