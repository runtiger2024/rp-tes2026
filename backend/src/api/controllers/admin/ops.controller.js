/**
 * ops.controller.js - V2026.01.Final_Pro
 * 管理端營運核心控制器
 * 整合功能：
 * 1. 系統全域設定 (匯率、手續費、公告)
 * 2. 附加服務項目 (加固、拍照等) CRUD
 * 3. 倉庫實務操作 (包裹列表、詳情、分箱入庫、實拍照上傳)
 */

const { ResponseWrapper } = require("../../../utils/response.wrapper");
const configService = require("../../../services/infrastructure/config.service");
const packageService = require("../../../services/warehouse/package.service");
const prisma = require("../../../../config/db");
const { sendNewShipmentNotification } = require("../../../utils/sendEmail");

const opsController = {
  // ==========================================
  // 1. 系統設定管理 (System Settings)
  // ==========================================

  /** 獲取系統全域設定 */
  async getSystemSettings(req, res, next) {
    try {
      const settings = await configService.getSettings(true);
      return ResponseWrapper.success(res, settings);
    } catch (error) {
      next(error);
    }
  },

  /** 更新系統設定 */
  async updateSettings(req, res, next) {
    try {
      // 傳入 req.body 與執行者 ID (req.user.id)
      const updated = await configService.updateSettings(req.body, req.user.id);
      return ResponseWrapper.success(res, updated, "系統設定儲存成功");
    } catch (error) {
      next(error);
    }
  },

  /** 測試 Email 發送功能 */
  async sendTestEmail(req, res, next) {
    try {
      const mockShipment = {
        id: "TEST-" + Date.now().toString().slice(-6),
        recipientName: req.user.name || "測試管理員",
        totalCost: 1000,
      };
      await sendNewShipmentNotification(mockShipment, req.user);
      return ResponseWrapper.success(res, null, "測試郵件已成功發送至您的信箱");
    } catch (error) {
      next(error);
    }
  },

  // ==========================================
  // 2. 附加服務項目 (Service Items)
  // ==========================================

  /** 獲取所有附加服務 */
  async getServiceItems(req, res, next) {
    try {
      const items = await prisma.shipmentServiceItem.findMany({
        orderBy: { createdAt: "desc" },
      });
      return ResponseWrapper.success(res, items);
    } catch (error) {
      next(error);
    }
  },

  /** 創建新的服務項目 */
  async createServiceItem(req, res, next) {
    try {
      const { name, price, unit, isActive } = req.body;
      const newItem = await prisma.shipmentServiceItem.create({
        data: {
          name,
          price: parseFloat(price) || 0,
          unit: unit || "PIECE",
          isActive: isActive ?? true,
        },
      });
      return ResponseWrapper.success(res, newItem, "服務項目已建立", 201);
    } catch (error) {
      next(error);
    }
  },

  /** 刪除服務項目 */
  async deleteServiceItem(req, res, next) {
    try {
      const { id } = req.params;
      await prisma.shipmentServiceItem.delete({ where: { id } });
      return ResponseWrapper.success(res, null, "服務項目已移除");
    } catch (error) {
      next(error);
    }
  },

  // ==========================================
  // 3. 倉庫實務操作 (Warehouse Operations)
  // ==========================================

  /** * 獲取包裹列表 (對接前端 adminOpsModule.fetchParcels)
   * 支援狀態過濾與關鍵字搜尋
   */
  async getParcels(req, res, next) {
    try {
      const { status, search } = req.query;

      const query = {
        include: {
          user: { select: { name: true, email: true, piggyId: true } },
          boxes: true, // 包含分箱數據
        },
        orderBy: { updatedAt: "desc" },
      };

      // 構建過濾條件
      const where = {};
      if (status && status !== "all") where.status = status;
      if (search) {
        where.OR = [
          { trackingNumber: { contains: search } },
          { user: { name: { contains: search } } },
          { user: { piggyId: { contains: search } } },
        ];
      }
      query.where = where;

      const parcels = await prisma.package.findMany(query);
      return ResponseWrapper.success(res, parcels);
    } catch (error) {
      next(error);
    }
  },

  /** 獲取單一包裹詳情 (對接前端 openEditModal) */
  async getParcelDetail(req, res, next) {
    try {
      const { id } = req.params;
      const parcel = await prisma.package.findUnique({
        where: { id },
        include: {
          user: { select: { name: true, email: true, piggyId: true } },
          boxes: true,
        },
      });

      if (!parcel) return ResponseWrapper.error(res, "找不到包裹資訊", 404);
      return ResponseWrapper.success(res, parcel);
    } catch (error) {
      next(error);
    }
  },

  /** * 執行入庫更新 (對接前端 saveParcelDetails)
   * 處理：狀態變更、產品名更新、分箱 JSON 解析、圖片上傳、運費重新核算
   */
  async updateParcelInbound(req, res, next) {
    try {
      const { id } = req.params;
      const { status, productName, boxes } = req.body;

      // ❗ 關鍵對位：解析前端傳來的 JSON 分箱數據
      let parsedBoxes = [];
      if (typeof boxes === "string") {
        parsedBoxes = JSON.parse(boxes);
      } else {
        parsedBoxes = boxes || [];
      }

      // 呼叫 Service 執行複雜的事務處理 (含資料庫寫入、圖片移動、運費計算)
      const updatedParcel = await packageService.updateInbound(id, {
        status,
        productName,
        boxes: parsedBoxes,
        files: req.files, // 由 multer 中間件處理的上傳檔案
      });

      return ResponseWrapper.success(res, updatedParcel, "包裹入庫資訊已更新");
    } catch (error) {
      // 針對解析 JSON 失敗的錯誤處理
      if (error instanceof SyntaxError) {
        return ResponseWrapper.error(res, "分箱數據格式錯誤", 400);
      }
      next(error);
    }
  },
};

module.exports = opsController;
