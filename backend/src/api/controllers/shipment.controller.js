/**
 * shipment.controller.js - V2026.01.Final_Pro
 * 用戶端集運訂單控制器
 * 負責功能：
 * 1. 創建集運單 (含身分證格式專業校驗)
 * 2. 獲取個人訂單列表 (含狀態過濾)
 * 3. 獲取訂單明細 (含包裹與物流軌跡)
 * 4. 上傳付款憑證 (匯款截圖處理)
 * 5. 取消未處理訂單
 */

const { ResponseWrapper } = require("../../utils/response.wrapper");
const shipmentService = require("../../services/logistics/shipment.service");
const { logger } = require("../../utils/logger");

const shipmentController = {
  /**
   * [POST] 創建新集運單
   * 包含嚴格的身分證邏輯檢查
   */
  async create(req, res, next) {
    try {
      const { idCardNumber, packageIds, recipientId } = req.body;

      // 1. 專業身分證格式校驗 (台灣身分證規則)
      const idRegex = /^[A-Z][12]\d{8}$/;
      if (!idCardNumber || !idRegex.test(idCardNumber)) {
        return ResponseWrapper.error(
          res,
          "身分證格式錯誤，請輸入正確的 10 碼編號",
          400,
          "INVALID_ID_FORMAT"
        );
      }

      // 2. 檢查包裹選擇
      if (
        !packageIds ||
        !Array.isArray(packageIds) ||
        packageIds.length === 0
      ) {
        return ResponseWrapper.error(res, "請至少選擇一個包裹進行集運", 400);
      }

      // 3. 呼叫 Service 執行事務 (建立訂單、凍結包裹、計算初始運費)
      const shipment = await shipmentService.createShipment(req.user.id, {
        ...req.body,
        idCardNumber: idCardNumber.toUpperCase(), // 確保首字母大寫
      });

      logger.info(
        `[Shipment] User ${req.user.id} created shipment ${shipment.id}`
      );
      return ResponseWrapper.success(
        res,
        shipment,
        "集運單已成功建立，請等待管理員核價",
        201
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [GET] 獲取用戶所有訂單列表
   */
  async list(req, res, next) {
    try {
      const { status } = req.query; // 支援按狀態過濾
      const shipments = await shipmentService.getUserShipments(
        req.user.id,
        status
      );

      return ResponseWrapper.success(res, shipments);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [GET] 獲取單一訂單詳細資訊
   */
  async detail(req, res, next) {
    try {
      const { id } = req.params;
      const shipment = await shipmentService.getShipmentDetail(id, req.user.id);

      if (!shipment) {
        return ResponseWrapper.error(res, "找不到該筆訂單或您無權查看", 404);
      }

      return ResponseWrapper.success(res, shipment);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [POST] 上傳付款憑證 (匯款截圖)
   * 對接前端 shipmentModule.payNow
   */
  async uploadProof(req, res, next) {
    try {
      const { id } = req.params;

      // req.file 由 multer 中間件處理
      if (!req.file) {
        return ResponseWrapper.error(res, "請上傳有效的匯款截圖檔案", 400);
      }

      const updated = await shipmentService.updatePaymentProof(
        id,
        req.user.id,
        req.file
      );

      return ResponseWrapper.success(
        res,
        updated,
        "憑證已提交，財務將儘速完成對帳"
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [DELETE/POST] 取消訂單
   * 僅限狀態為 UNPAID (待付款) 且管理員尚未處理前
   */
  async cancel(req, res, next) {
    try {
      const { id } = req.params;
      await shipmentService.cancelShipment(id, req.user.id);

      return ResponseWrapper.success(res, null, "訂單已取消，包裹已釋放回庫存");
    } catch (error) {
      next(error);
    }
  },

  /**
   * [GET] 獲取最新物流動態 (Tracking)
   */
  async getTracking(req, res, next) {
    try {
      const { id } = req.params;
      const logs = await shipmentService.getLogisticsLogs(id, req.user.id);
      return ResponseWrapper.success(res, logs);
    } catch (error) {
      next(error);
    }
  },
};

// 補回預估運費 API (讓使用者在下單前看到計算明細)
exports.preview = async (req, res) => {
  const { packageIds, deliveryLocationRate } = req.body;
  const packages = await prisma.package.findMany({
    where: { id: { in: packageIds }, userId: req.user.id },
  });
  const calc = await pricingService.calculateSeaFreight(
    packages,
    deliveryLocationRate
  );
  res.json({ success: true, preview: calc });
};

// 補回線下支付憑證上傳 (WALLET 以外的支付方式)
exports.uploadProof = async (req, res) => {
  if (!req.file)
    return res.status(400).json({ success: false, message: "請選擇圖片" });

  const shipment = await prisma.shipment.update({
    where: { id: req.params.id, userId: req.user.id },
    data: {
      paymentProof: req.file.path,
      status: "PAID", // 或等待審核狀態
    },
  });
  res.json({ success: true, shipment });
};

module.exports = shipmentController;
