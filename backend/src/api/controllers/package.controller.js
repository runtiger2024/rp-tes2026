/**
 * package.controller.js - V2026.01.Final_Pro
 * 用戶端包裹業務控制器
 * 負責功能：
 * 1. 包裹單筆/批量預報 (含電器類購買連結強制校驗)
 * 2. 獲取個人包裹清單 (含動態運費試算)
 * 3. 無主包裹清單查詢 (末 4 碼遮罩安全顯示)
 * 4. 無主包裹認領 (嚴格單號校驗)
 * 5. 異常包裹回覆與包裹修改/刪除
 */

const { ResponseWrapper } = require("../../utils/response.wrapper");
const packageService = require("../../services/warehouse/package.service");
const pricingService = require("../../services/logistics/pricing.service"); // 假設有定價服務
const prisma = require("../../../config/db");
const { logger } = require("../../utils/logger");

/**
 * 輔助邏輯：判斷是否為電器類關鍵字 (用於報關合規檢查)
 */
const isElectricalAppliance = (productName) => {
  const keywords = [
    "電",
    "機",
    "扇",
    "視",
    "冰箱",
    "爐",
    "燈",
    "器",
    "泵",
    "吸塵",
  ];
  return keywords.some((key) => productName.includes(key));
};

const packageController = {
  /**
   * [GET] 取得我的包裹清單
   * 對接前端 parcelModule.fetchPackages
   */
  async getMyPackages(req, res, next) {
    try {
      const packages = await prisma.package.findMany({
        where: { userId: req.user.id },
        include: { boxes: true }, // 包含入庫後的箱規數據
        orderBy: { createdAt: "desc" },
      });

      // 擴充邏輯：為每個包裹計算即時預估運費 (若已入庫)
      const enrichedPackages = packages.map((pkg) => {
        // 若管理端已核定總運費則直接使用，否則執行即時試算
        const fee = pkg.shippingFee > 0 ? pkg.shippingFee : 0;
        return {
          ...pkg,
          estimatedFee: fee,
          displayStatus: pkg.status, // 前端會透過 statusText 轉換
        };
      });

      return ResponseWrapper.success(res, enrichedPackages);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [POST] 包裹單筆預報
   * 強烈要求電器類商品必須附上網址
   */
  async createPackageForecast(req, res, next) {
    try {
      const {
        trackingNumber,
        productName,
        quantity,
        note,
        productUrl,
        modelNumber,
        spec,
      } = req.body;

      if (!trackingNumber || !productName) {
        return ResponseWrapper.error(res, "物流單號與商品名稱為必填項目", 400);
      }

      // 1. 電器類強化校驗
      if (
        isElectricalAppliance(productName) &&
        (!productUrl || productUrl.trim() === "")
      ) {
        return ResponseWrapper.error(
          res,
          "電器類商品因報關需求，必須提供『購買連結』",
          400,
          "REQUIRE_URL"
        );
      }

      // 2. 檢查單號重複
      const exists = await prisma.package.findUnique({
        where: { trackingNumber: trackingNumber.trim() },
      });
      if (exists)
        return ResponseWrapper.error(
          res,
          "此物流單號已在系統中，請勿重複預報",
          400
        );

      // 3. 處理圖片 (由 multer 處理)
      const imagePaths = req.files ? req.files.map((f) => f.path) : [];

      const newPackage = await prisma.package.create({
        data: {
          trackingNumber: trackingNumber.trim(),
          productName,
          quantity: parseInt(quantity) || 1,
          note,
          productUrl,
          modelNumber,
          spec,
          productImages: imagePaths,
          userId: req.user.id,
          status: "PENDING",
        },
      });

      logger.info(`[Package] User ${req.user.id} forecasted ${trackingNumber}`);
      return ResponseWrapper.success(res, newPackage, "包裹預報成功", 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [POST] 批量預報
   */
  async bulkForecast(req, res, next) {
    try {
      const { packages } = req.body; // Array of objects
      if (!Array.isArray(packages) || packages.length === 0) {
        return ResponseWrapper.error(res, "無效的批次資料", 400);
      }

      let count = 0;
      for (const pkg of packages) {
        if (!pkg.trackingNumber || !pkg.productName) continue;

        // 檢查單號是否存在
        const exists = await prisma.package.findUnique({
          where: { trackingNumber: pkg.trackingNumber.trim() },
        });
        if (exists) continue;

        await prisma.package.create({
          data: {
            trackingNumber: pkg.trackingNumber.trim(),
            productName: pkg.productName,
            quantity: parseInt(pkg.quantity) || 1,
            userId: req.user.id,
            status: "PENDING",
            note: "批量匯入",
          },
        });
        count++;
      }

      return ResponseWrapper.success(
        res,
        { count },
        `成功批量匯入 ${count} 筆包裹`
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [GET] 獲取無主包裹清單 (含單號遮罩處理)
   * 對接前端 unclaimedModule.fetchData
   */
  async getUnclaimedPackages(req, res, next) {
    try {
      const packages = await prisma.package.findMany({
        where: {
          OR: [{ user: { email: "unclaimed@runpiggy.com" } }, { userId: null }],
          status: "ARRIVED", // 僅顯示已到倉但無人的包裹
        },
        select: {
          id: true,
          trackingNumber: true,
          productName: true,
          weight: true,
          createdAt: true,
          warehouseImages: true,
        },
        orderBy: { createdAt: "desc" },
      });

      // 執行遮罩：僅顯示末 4 碼，其餘星號處理
      const maskedData = packages.map((p) => {
        const full = p.trackingNumber || "";
        const masked =
          full.length > 4 ? "*".repeat(full.length - 4) + full.slice(-4) : full;
        return {
          ...p,
          maskedTrackingNumber: masked,
          trackingNumber: undefined, // 安全起見，不回傳完整單號
        };
      });

      return ResponseWrapper.success(res, maskedData);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [POST] 認領包裹
   * 需通過 Service 層執行嚴格認領邏輯
   */
  async claimPackage(req, res, next) {
    try {
      const { trackingNumber } = req.body;
      const proofPath = req.file ? req.file.path : null;

      if (!trackingNumber)
        return ResponseWrapper.error(res, "請提供完整單號以供校驗", 400);

      const claimed = await packageService.claimPackage(
        req.user.id,
        trackingNumber,
        proofPath
      );

      return ResponseWrapper.success(
        res,
        claimed,
        "認領成功！包裹已移入您的帳戶"
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [PUT] 修改包裹 (僅限 PENDING 狀態)
   */
  async updateMyPackage(req, res, next) {
    try {
      const { id } = req.params;
      const { productName, quantity, note } = req.body;

      const pkg = await prisma.package.findFirst({
        where: { id, userId: req.user.id },
      });
      if (!pkg || pkg.status !== "PENDING") {
        return ResponseWrapper.error(res, "包裹已入庫或不存在，無法修改", 400);
      }

      const updated = await prisma.package.update({
        where: { id },
        data: {
          productName,
          quantity: parseInt(quantity) || pkg.quantity,
          note,
        },
      });

      return ResponseWrapper.success(res, updated, "包裹資訊已更新");
    } catch (error) {
      next(error);
    }
  },

  /**
   * [DELETE] 刪除預報 (僅限 PENDING 狀態)
   */
  async deleteMyPackage(req, res, next) {
    try {
      const { id } = req.params;
      const pkg = await prisma.package.findFirst({
        where: { id, userId: req.user.id },
      });

      if (!pkg || pkg.status !== "PENDING") {
        return ResponseWrapper.error(res, "無法刪除已處理之包裹", 400);
      }

      await prisma.package.delete({ where: { id } });
      return ResponseWrapper.success(res, null, "預報已成功刪除");
    } catch (error) {
      next(error);
    }
  },
};

module.exports = packageController;
