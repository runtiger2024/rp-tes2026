/**
 * admin/user.controller.js - V2026.01.Final_Pro
 * 管理端會員與財務管理核心控制器
 * 整合功能：
 * 1. 會員全域搜尋 (支援姓名、Email、小跑豬 ID)
 * 2. 會員詳情與權限變更 (角色、鎖定狀態)
 * 3. 人工手動調帳邏輯 (增加/減少餘額)
 * 4. 管理員模擬登入 (Impersonate)
 * 5. 財務憑證 (儲值申請) 審核流程
 */

const prisma = require("../../../../config/db");
const { ResponseWrapper } = require("../../../utils/response.wrapper");
const generateToken = require("../../../utils/generateToken");
const { logger } = require("../../../utils/logger");

const userController = {
  /**
   * [GET] 獲取會員清單 (含搜尋與分頁)
   * 對接前端 adminUserModule.fetchUsers
   */
  async getUsers(req, res, next) {
    try {
      const { search, role, status, page = 1, limit = 20 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const where = {
        ...(role && role !== "all" && { role }),
        ...(status && status !== "all" && { status }),
        ...(search && {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
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
   * 對接前端 openMemberModal
   */
  async getUserDetail(req, res, next) {
    try {
      const { id } = req.params;
      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          _count: {
            select: { packages: true, shipments: true },
          },
        },
      });

      if (!user) return ResponseWrapper.error(res, "找不到該使用者", 404);
      return ResponseWrapper.success(res, user);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [PUT] 更新會員資訊與「人工調帳」
   * 這是管理端最重要的金流操作點
   */
  async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const { name, phone, role, status, walletAdjustment } = req.body;

      // 執行資料庫事務處理
      const result = await prisma.$transaction(async (tx) => {
        // 1. 如果有調帳需求
        if (walletAdjustment && walletAdjustment.amount !== 0) {
          const { amount, reason } = walletAdjustment;

          // 更新餘額
          await tx.user.update({
            where: { id },
            data: { balance: { increment: amount } },
          });

          // 建立交易日誌 (Transaction Log)
          await tx.transaction.create({
            data: {
              userId: id,
              type: amount > 0 ? "DEPOSIT" : "PAYMENT",
              amount: Math.abs(amount),
              description: `[人工調帳] ${reason || "管理員手動調整"}`,
              status: "COMPLETED",
              adminId: req.user.id, // 記錄是哪位管理員操作
            },
          });
        }

        // 2. 更新基本資料
        return await tx.user.update({
          where: { id },
          data: {
            ...(name && { name }),
            ...(phone && { phone }),
            ...(role && { role }),
            ...(status && { status }),
          },
        });
      });

      logger.info(`[Admin] Admin ${req.user.id} updated user ${id}`);
      return ResponseWrapper.success(res, result, "會員資料已同步更新");
    } catch (error) {
      next(error);
    }
  },

  /**
   * [POST] 管理員模擬登入
   * 用於協助客戶排查問題
   */
  async impersonate(req, res, next) {
    try {
      const { id } = req.params;
      const user = await prisma.user.findUnique({ where: { id } });

      if (!user) return ResponseWrapper.error(res, "找不到使用者", 404);

      // 生成該用戶的 Token
      const token = generateToken(user.id);

      logger.warn(`[Security] Admin ${req.user.id} impersonated User ${id}`);
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
   * [GET] 獲取待審核儲值申請 (財務專用)
   */
  async getPendingDeposits(req, res, next) {
    try {
      const deposits = await prisma.depositRequest.findMany({
        where: { status: "PENDING" },
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
   * [POST] 審核儲值申請
   * 對接前端 adminUserModule.auditDeposit
   */
  async auditDeposit(req, res, next) {
    try {
      const { id } = req.params;
      const { status, rejectReason } = req.body; // COMPLETED or REJECTED

      const deposit = await prisma.depositRequest.findUnique({
        where: { id },
        include: { user: true },
      });

      if (!deposit || deposit.status !== "PENDING") {
        return ResponseWrapper.error(res, "無效的申請單", 400);
      }

      const result = await prisma.$transaction(async (tx) => {
        // 更新申請狀態
        const updatedRequest = await tx.depositRequest.update({
          where: { id },
          data: {
            status,
            adminNote: rejectReason,
            processedAt: new Date(),
          },
        });

        // 若通過，增加餘額並記錄交易
        if (status === "COMPLETED") {
          await tx.user.update({
            where: { id: deposit.userId },
            data: { balance: { increment: deposit.amount } },
          });

          await tx.transaction.create({
            data: {
              userId: deposit.userId,
              type: "DEPOSIT",
              amount: deposit.amount,
              description: `儲值入帳 - 單號: ${id.slice(-6)}`,
              status: "COMPLETED",
            },
          });
        }

        return updatedRequest;
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
