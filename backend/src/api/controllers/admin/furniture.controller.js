/**
 * admin/furniture.controller.js - V2026.01.Final_Pro
 * 管理端家具代購核心控制器
 * 整合功能：
 * 1. 訂單清單獲取 (含全域搜尋、分頁、狀態篩選)
 * 2. 訂單詳情查詢 (含用戶資訊與附件圖片)
 * 3. 核心報價邏輯 (核定 RMB 單價、匯率、手續費、產出 TWD 總價)
 * 4. 採購狀態維護 (待報價 -> 已報價 -> 採購中 -> 已到貨)
 * 5. 批次刪除與日誌備註
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
   * 當管理員在後台輸入核定單價與匯率時觸發
   */
  async quoteOrder(req, res, next) {
    try {
      const { id } = req.params;
      const { quotedPriceRMB, exchangeRate, serviceFeeTWD, adminNote } =
        req.body;

      // 1. 基本數值校驗
      const rmb = parseFloat(quotedPriceRMB) || 0;
      const rate = parseFloat(exchangeRate) || 4.65;

      // 2. 獲取原訂單計算件數
      const order = await prisma.furnitureOrder.findUnique({ where: { id } });
      if (!order) return ResponseWrapper.error(res, "訂單不存在", 404);

      // 3. 重新精算 TWD 金額 (確保後端邏輯與前端 UI 計算一致)
      const productTWD = Math.round(rmb * order.quantity * rate);
      const finalFee = parseFloat(serviceFeeTWD) || 0; // 通常由管理員核定，或帶入最低 500
      const totalTWD = productTWD + finalFee;

      // 4. 更新資料庫並變更狀態為 'QUOTED' (已報價)
      const updated = await prisma.furnitureOrder.update({
        where: { id },
        data: {
          priceRMB: rmb, // 更新為核定價
          exchangeRate: rate,
          serviceFee: finalFee,
          priceTWD: productTWD,
          totalPriceTWD: totalTWD,
          status: "QUOTED",
          adminNote: adminNote || "報價已完成",
          quotedAt: new Date(),
        },
      });

      logger.info(
        `[Furniture] Admin ${req.user.id} quoted Order ${id} for TWD ${totalTWD}`
      );
      return ResponseWrapper.success(res, updated, "報價成功，已通知客戶查看");
    } catch (error) {
      next(error);
    }
  },

  /**
   * [PUT] 更新狀態 (Status Management)
   * 用於報價後的流程跟進：採購中 -> 運輸中 -> 已完結
   */
  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, adminNote } = req.body;

      const updated = await furnitureService.updateStatus(
        id,
        status,
        adminNote
      );

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
      if (!ids || !Array.isArray(ids))
        return ResponseWrapper.error(res, "參數錯誤", 400);

      const result = await prisma.furnitureOrder.deleteMany({
        where: { id: { in: ids } },
      });

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
