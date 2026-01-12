/**
 * shipment.controller.js - V2026.01.Final_Pro_Integrated
 * 用戶端集運訂單控制器 (終極整合版)
 * 負責功能：
 * 1. 創建集運單 (含嚴格身分證校驗與包裹凍結)
 * 2. 獲取訂單清單與詳情 (整合精密費用明細、銀行轉帳資訊)
 * 3. 運費預估預覽 (下單前透明化試算)
 * 4. 支付憑證上傳 (支援 HTTPS 路徑修正，防止破圖)
 * 5. 物流軌跡查詢與訂單取消
 */

const { ResponseWrapper } = require("../../utils/response.wrapper");
const shipmentService = require("../../services/logistics/shipment.service");
const pricingService = require("../../services/logistics/pricing.service");
const prisma = require("../../../config/db");
const { logger } = require("../../utils/logger");

const shipmentController = {
  /**
   * [POST] 創建新集運單
   */
  async create(req, res, next) {
    try {
      const { idCardNumber, packageIds } = req.body;

      // 1. 專業身分證格式校驗 (整合自 V17 嚴格校驗)
      const idRegex = /^[A-Z][12]\d{8}$/;
      if (!idCardNumber || !idRegex.test(idCardNumber)) {
        return ResponseWrapper.error(
          res,
          "收件人身分證格式錯誤 (須為大寫英文開頭，第一位數字為 1 或 2)",
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

      // 3. 呼叫 Service 執行事務
      const shipment = await shipmentService.createShipment(req.user.id, {
        ...req.body,
        idCardNumber: idCardNumber.toUpperCase(),
      });

      logger.info(
        `[Shipment] User ${req.user.id} created shipment ${shipment.shipmentNo}`
      );
      return ResponseWrapper.success(
        res,
        shipment,
        "集運單已成功建立，請等待管理員核價或執行付款",
        201
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [POST] 運費試算預覽 (下單前透明化明細)
   */
  async preview(req, res, next) {
    try {
      const { packageIds, deliveryLocationRate } = req.body;

      if (
        !packageIds ||
        !Array.isArray(packageIds) ||
        packageIds.length === 0
      ) {
        return ResponseWrapper.error(res, "請選擇包裹以進行試算", 400);
      }

      const packages = await prisma.package.findMany({
        where: { id: { in: packageIds }, userId: req.user.id },
        include: { boxes: true },
      });

      // 調用定價服務進行精密試算 (整合材積、重量、最低消費邏輯)
      const calcResult = await pricingService.calculateSeaFreight(
        packages,
        parseFloat(deliveryLocationRate) || 0
      );

      return ResponseWrapper.success(res, { preview: calcResult });
    } catch (error) {
      next(error);
    }
  },

  /**
   * [GET] 獲取單一訂單詳細資訊 (整合 V17 深度檢閱明細與銀行資訊)
   */
  async detail(req, res, next) {
    try {
      const { id } = req.params;
      const shipment = await shipmentService.getShipmentDetail(id, req.user.id);

      if (!shipment) {
        return ResponseWrapper.error(res, "找不到該筆訂單或您無權查看", 404);
      }

      // 1. 付款憑證路徑 HTTPS 安全修正 (解決破圖)
      if (shipment.paymentProof && shipment.paymentProof.startsWith("http")) {
        shipment.paymentProof = shipment.paymentProof.replace(
          "http://",
          "https://"
        );
      }

      // 2. 獲取銀行帳務轉帳資訊 (整合自 V17 銀行模組)
      const bankSetting = await prisma.systemSetting.findUnique({
        where: { key: "bank_info" },
      });

      // 3. 整合最終呈現物件 (對接前端詳情 Modal)
      const enrichedShipment = {
        ...shipment,
        reportTitle: "訂單詳細內容", // 優化標題文字
        bankInfo: bankSetting ? bankSetting.value : null,
      };

      return ResponseWrapper.success(res, enrichedShipment);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [POST] 上傳付款憑證 (匯款截圖處理)
   */
  async uploadProof(req, res, next) {
    try {
      const { id } = req.params;

      if (!req.file) {
        return ResponseWrapper.error(res, "請上傳有效的匯款截圖圖片", 400);
      }

      const updated = await shipmentService.updatePaymentProof(
        id,
        req.user.id,
        req.file
      );

      // 同樣對回傳路徑執行 HTTPS 修正
      if (updated.paymentProof && updated.paymentProof.startsWith("http")) {
        updated.paymentProof = updated.paymentProof.replace(
          "http://",
          "https://"
        );
      }

      return ResponseWrapper.success(
        res,
        updated,
        "憑證已提交，財務人員將儘速完成核帳"
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
      const { status } = req.query;
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
   * [POST/DELETE] 取消訂單 (僅限 UNPAID)
   */
  async cancel(req, res, next) {
    try {
      const { id } = req.params;
      await shipmentService.cancelShipment(id, req.user.id);
      return ResponseWrapper.success(
        res,
        null,
        "訂單已成功取消，包裹已釋放回庫存"
      );
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

module.exports = shipmentController;
