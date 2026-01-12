/**
 * admin/furniture.controller.js - V2026.01.Final_Pro_Integrated
 * 管理端家具代購核心控制器 (終極整合版)
 * 整合重點：
 * 1. 完整保留 V2026 分頁、搜尋、批次刪除功能。
 * 2. 引入 V18.1 核心配置抓取邏輯，報價時強制執行「最低服務費 (Min Fee 500)」校驗。
 * 3. 完美修復 Cloudinary 憑證/發票圖片 HTTPS 轉換邏輯，解決前端破圖。
 * 4. 強化數值健壯性，防止 NaN 寫入資料庫。
 */

const { ResponseWrapper } = require("../../../utils/response.wrapper");
const furnitureService = require("../../../services/logistics/furniture.service");
const prisma = require("../../../../config/db");
const { logger } = require("../../../utils/logger");

const furnitureAdminController = {
  /**
   * [GET] 獲取家具訂單清單 (對接 adminFurnitureModule.fetchOrders)
   */
  async getOrders(req, res, next) {
    try {
      const { page = 1, limit = 20, status, search } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const where = {
        ...(status && status !== "all" && { status }),
        ...(search && {
          OR: [
            { factoryName: { contains: search, mode: "insensitive" } },
            { productName: { contains: search, mode: "insensitive" } },
            { user: { name: { contains: search, mode: "insensitive" } } },
            { user: { piggyId: { contains: search, mode: "insensitive" } } },
          ],
        }),
      };

      const [total, orders] = await prisma.$transaction([
        prisma.furnitureOrder.count({ where }),
        prisma.furnitureOrder.findMany({
          where,
          skip,
          take: parseInt(limit),
          include: {
            user: { select: { name: true, email: true, piggyId: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      return ResponseWrapper.paginate(res, orders, total, page, limit);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [GET] 獲取單一訂單詳情
   */
  async getOrderDetail(req, res, next) {
    try {
      const { id } = req.params;
      const order = await prisma.furnitureOrder.findUnique({
        where: { id },
        include: { user: true },
      });

      if (!order) return ResponseWrapper.error(res, "找不到該家具訂單", 404);
      return ResponseWrapper.success(res, order);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [PUT] 核心報價邏輯 (Quoting)
   * 整合功能：自動抓取系統設定，強制執行服務費最低標準
   */
  async quoteOrder(req, res, next) {
    try {
      const { id } = req.params;
      const { quotedPriceRMB, exchangeRate, adminNote } = req.body;

      // 1. 查找訂單並校驗
      const order = await prisma.furnitureOrder.findUnique({ where: { id } });
      if (!order) return ResponseWrapper.error(res, "訂單不存在", 404);

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

      // 3. 數值預處理
      const rmb = parseFloat(quotedPriceRMB) || order.priceRMB;
      const rate = parseFloat(exchangeRate) || cfg.exchangeRate;

      // 4. 精密計算 (整合 V17 最低服務費邏輯)
      const productTWD = rmb * order.quantity * rate;
      const rawFeeTWD = productTWD * cfg.serviceFeeRate;
      const finalFeeTWD = Math.max(rawFeeTWD, cfg.minServiceFee); // 核心優化：守住最低服務費
      const totalAmountTWD = Math.ceil(productTWD + finalFeeTWD);

      // 5. 處理附件或發票圖片 (解決破圖，強制 HTTPS)
      let invoiceUrl = req.file ? req.file.path : req.body.invoiceUrl;
      if (invoiceUrl && typeof invoiceUrl === "string") {
        invoiceUrl = invoiceUrl.replace("http://", "https://");
      }

      // 6. 更新資料庫
      const updated = await prisma.furnitureOrder.update({
        where: { id },
        data: {
          priceRMB: rmb,
          exchangeRate: rate,
          serviceFeeRMB: finalFeeTWD / rate, // 換算回人民幣存檔
          totalAmountTWD: totalAmountTWD, // 對齊 schema 欄位
          status: "PAID", // 管理員報價並確認後通常改為已處理或待付款
          adminRemark: adminNote || "報價已核定",
          invoiceUrl: invoiceUrl || order.invoiceUrl,
          updatedAt: new Date(),
        },
      });

      logger.info(
        `[Furniture] Admin ${req.user.id} quoted Order ${id} - Total: TWD ${totalAmountTWD}`
      );
      return ResponseWrapper.success(
        res,
        updated,
        "訂單報價成功，已更新金額與狀態"
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [PUT] 更新狀態與日誌備註
   */
  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, adminNote } = req.body;

      // 處理可能的發票上傳
      let invoiceUrl = req.file ? req.file.path : undefined;
      if (invoiceUrl) {
        invoiceUrl = invoiceUrl.replace("http://", "https://");
      }

      const updated = await prisma.furnitureOrder.update({
        where: { id },
        data: {
          status,
          adminRemark: adminNote,
          ...(invoiceUrl && { invoiceUrl }),
          updatedAt: new Date(),
        },
      });

      // 調用 Service 處理後續通知 (若有封裝)
      try {
        await furnitureService.updateStatus(id, status, adminNote);
      } catch (e) {
        logger.error(`[Furniture Service Notification Failed] ${e.message}`);
      }

      return ResponseWrapper.success(
        res,
        updated,
        `訂單狀態已更新為: ${status}`
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [DELETE] 批次刪除
   */
  async bulkDelete(req, res, next) {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids)) {
        return ResponseWrapper.error(res, "請提供有效的 ID 陣列", 400);
      }

      const result = await prisma.furnitureOrder.deleteMany({
        where: { id: { in: ids } },
      });

      logger.warn(
        `[Furniture] Admin ${req.user.id} bulk deleted ${result.count} orders`
      );
      return ResponseWrapper.success(
        res,
        null,
        `成功刪除 ${result.count} 筆家具代購紀錄`
      );
    } catch (error) {
      next(error);
    }
  },
};

module.exports = furnitureAdminController;
