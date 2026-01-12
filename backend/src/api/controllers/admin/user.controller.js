/**
 * admin/user.controller.js - V2026.01.Final_Pro_Integrated
 * 管理端會員與財務管理核心控制器 (終極整合版)
 * 整合功能：
 * 1. 會員全域搜尋 (支援姓名、Email、手機、小跑豬 ID)
 * 2. 會員詳情與權限角色管理 (USER, ADMIN, WAREHOUSE, FINANCE)
 * 3. 員工帳號建立 (含加密密碼處理)
 * 4. 安全刪除邏輯 (檢核是否有未完成包裹或訂單)
 * 5. 人工調帳與財務流水 (RECHARGE / ADJUSTMENT)
 * 6. 模擬登入與密碼強制重置 (預設 888888)
 * 7. 儲值申請單 (DepositRequest) 審核流
 */

const prisma = require("../../../../config/db");
const { ResponseWrapper } = require("../../../utils/response.wrapper");
const generateToken = require("../../../utils/generateToken");
const { logger } = require("../../../utils/logger");
const bcrypt = require("bcryptjs");

const userController = {
  /**
   * [GET] 獲取會員清單 (含搜尋與分頁)
   */
  async getUsers(req, res, next) {
    try {
      const { search, role, status, page = 1, limit = 20 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const where = {
        ...(role && role !== "all" && { role }),
        ...(status &&
          status !== "all" && {
            isActive: status === "active" || status === "true",
          }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
            { piggyId: { contains: search, mode: "insensitive" } },
          ],
        }),
      };

      const [total, users] = await prisma.$transaction([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          skip,
          take: parseInt(limit),
          select: {
            id: true,
            piggyId: true,
            email: true,
            name: true,
            phone: true,
            role: true,
            isActive: true,
            balance: true,
            points: true,
            createdAt: true,
            defaultAddress: true,
            defaultTaxId: true,
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      return ResponseWrapper.paginate(res, users, total, page, limit);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [GET] 獲取單一會員詳情 (含統計數據)
   */
  async getUserDetail(req, res, next) {
    try {
      const { id } = req.params;
      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          tier: true,
          _count: {
            select: { packages: true, shipments: true },
          },
        },
      });

      if (!user) return ResponseWrapper.error(res, "找不到該使用者", 404);

      // 移除敏感資訊
      const { passwordHash, ...safeUser } = user;
      return ResponseWrapper.success(res, safeUser);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [POST] 建立員工/管理員帳號 (移植自 V17 核心)
   */
  async createStaff(req, res, next) {
    try {
      const { email, password, name, role } = req.body;

      if (!email || !password || !name) {
        return ResponseWrapper.error(res, "請提供完整的員工資料", 400);
      }

      const exists = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });
      if (exists) return ResponseWrapper.error(res, "此 Email 已被註冊", 400);

      const hash = await bcrypt.hash(password, 10);

      const staff = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash: hash,
          name,
          role: role || "WAREHOUSE",
          isActive: true,
        },
      });

      logger.info(`[Admin] Staff created: ${email} by ${req.user.id}`);
      return ResponseWrapper.success(res, staff, "員工帳號建立成功", 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [PUT] 更新會員資訊、權限與「人工調帳」
   */
  async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const {
        name,
        phone,
        role,
        isActive,
        piggyId,
        walletAdjustment,
        defaultAddress,
        defaultTaxId,
      } = req.body;

      const result = await prisma.$transaction(async (tx) => {
        // 1. 處理人工調帳邏輯
        if (walletAdjustment && walletAdjustment.amount !== 0) {
          const { amount, reason } = walletAdjustment;

          await tx.user.update({
            where: { id },
            data: { balance: { increment: amount } },
          });

          await tx.walletTransaction.create({
            data: {
              userId: id,
              type: amount > 0 ? "ADJUSTMENT" : "PAYMENT",
              amount: Math.abs(amount),
              description: `[人工調帳] ${reason || "管理員手動調整"}`,
              status: "COMPLETED",
              balanceBefore: 0, // V18 欄位補全
              balanceAfter: 0, // 實際運算建議在 Service 層處理，此處留空由後續 Hook 更新
            },
          });
        }

        // 2. 更新基本資料與資信欄位
        return await tx.user.update({
          where: { id },
          data: {
            ...(name && { name }),
            ...(phone && { phone }),
            ...(role && { role }),
            ...(isActive !== undefined && { isActive }),
            ...(piggyId && { piggyId }),
            ...(defaultAddress && { defaultAddress }),
            ...(defaultTaxId && { defaultTaxId }),
          },
        });
      });

      logger.info(`[Admin] User updated: ${id} by Admin ${req.user.id}`);
      return ResponseWrapper.success(res, result, "會員資料已同步更新");
    } catch (error) {
      next(error);
    }
  },

  /**
   * [PUT] 強制重置密碼
   */
  async resetPassword(req, res, next) {
    try {
      const { id } = req.params;
      const hash = await bcrypt.hash("888888", 10); // 系統預設重置密碼

      await prisma.user.update({
        where: { id },
        data: { passwordHash: hash },
      });

      logger.warn(
        `[Security] Admin ${req.user.id} reset password for User ${id}`
      );
      return ResponseWrapper.success(res, null, "密碼已成功重置為 888888");
    } catch (error) {
      next(error);
    }
  },

  /**
   * [DELETE] 永久刪除用戶 (含嚴格安全檢核)
   */
  async deleteUser(req, res, next) {
    try {
      const { id } = req.params;
      if (req.user.id === id)
        return ResponseWrapper.error(res, "不可刪除當前登入之帳號", 400);

      // 安全檢核：是否有未完成的業務 (移植自 V17)
      const activeShipments = await prisma.shipment.count({
        where: { userId: id, status: { notIn: ["ARRIVED", "CANCELLED"] } },
      });

      const activePackages = await prisma.package.count({
        where: { userId: id, status: { notIn: ["ARRIVED", "RETURNED"] } },
      });

      if (activeShipments > 0 || activePackages > 0) {
        return ResponseWrapper.error(
          res,
          `無法刪除！此會員尚有 ${activePackages} 件庫存包裹及 ${activeShipments} 筆未結清單。`,
          400
        );
      }

      await prisma.$transaction([
        prisma.activityLog.deleteMany({ where: { userId: id } }),
        prisma.walletTransaction.deleteMany({ where: { userId: id } }),
        prisma.user.delete({ where: { id } }),
      ]);

      return ResponseWrapper.success(
        res,
        null,
        "會員帳號及其關聯日誌已永久刪除"
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [POST] 管理員模擬登入
   */
  async impersonate(req, res, next) {
    try {
      const { id } = req.params;
      const user = await prisma.user.findUnique({ where: { id } });

      if (!user) return ResponseWrapper.error(res, "找不到使用者", 404);

      const token = generateToken(user.id);

      logger.warn(
        `[Security] Admin ${req.user.id} impersonated User ${user.email}`
      );
      return ResponseWrapper.success(
        res,
        { token, user },
        "已成功模擬該用戶身份"
      );
    } catch (error) {
      next(error);
    }
  },

  /**
   * [GET] 獲取待審核儲值申請
   */
  async getPendingDeposits(req, res, next) {
    try {
      // 假設資料表名為 WalletTransaction，狀態為 PENDING
      const deposits = await prisma.walletTransaction.findMany({
        where: { status: "PENDING", type: "RECHARGE" },
        include: {
          user: { select: { name: true, email: true, piggyId: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      return ResponseWrapper.success(res, deposits);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [POST] 審核儲值申請 (Audit)
   */
  async auditDeposit(req, res, next) {
    try {
      const { id } = req.params;
      const { status, rejectReason } = req.body;

      const deposit = await prisma.walletTransaction.findUnique({
        where: { id },
        include: { user: true },
      });

      if (!deposit || deposit.status !== "PENDING") {
        return ResponseWrapper.error(res, "無效的申請單或已被處理", 400);
      }

      const result = await prisma.$transaction(async (tx) => {
        // 1. 更新交易狀態
        const updatedTx = await tx.walletTransaction.update({
          where: { id },
          data: {
            status,
            description:
              status === "REJECTED"
                ? `[駁回] ${rejectReason}`
                : deposit.description,
          },
        });

        // 2. 若審核通過，增加會員餘額
        if (status === "COMPLETED") {
          await tx.user.update({
            where: { id: deposit.userId },
            data: { balance: { increment: deposit.amount } },
          });
        }

        return updatedTx;
      });

      return ResponseWrapper.success(
        res,
        result,
        status === "COMPLETED" ? "入帳成功" : "已駁回申請"
      );
    } catch (error) {
      next(error);
    }
  },
};

module.exports = userController;
