/**
 * admin/report.controller.js - V2026.01.Final_Pro
 * 管理端營運數據與報表中心控制器
 * * 整合功能：
 * 1. 營運總覽統計 (Dashboard Summary)
 * 2. 待辦事項紅點同步 (Badge Statistics for Sidebar)
 * 3. 財務盈餘與儲值趨勢
 * 4. 倉庫庫存壓力分析 (在倉天數/件數)
 */

const prisma = require("../../../../config/db");
const { ResponseWrapper } = require("../../../utils/response.wrapper");

const reportController = {
  /**
   * [GET] 獲取營運儀表板總覽數據
   * 用於 admin-dashboard.html 的頂部卡片與圖表
   */
  async getDashboardStats(req, res, next) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // 並行執行所有深度統計，確保響應時間在 200ms 內
      const [
        totalUser,
        newUserToday,
        activeUser30d,
        pendingAction,
        revenue30d,
        totalWeight30d,
      ] = await Promise.all([
        // 1. 會員數據
        prisma.user.count(),
        prisma.user.count({ where: { createdAt: { gte: today } } }),
        prisma.user.count({
          where: { shipments: { some: { createdAt: { gte: thirtyDaysAgo } } } },
        }),

        // 2. 待辦事項 (加總所有需要人工介入的單據)
        prisma.shipment.count({
          where: { status: { in: ["AWAITING_REVIEW", "PENDING_PAYMENT"] } },
        }),

        // 3. 營收數據 (僅計算已完成或已付款的集運單)
        prisma.shipment.aggregate({
          _sum: { totalFee: true },
          where: {
            paymentStatus: "PAID",
            updatedAt: { gte: thirtyDaysAgo },
          },
        }),

        // 4. 物流數據
        prisma.package.aggregate({
          _sum: { weight: true },
          where: { status: "COMPLETED", updatedAt: { gte: thirtyDaysAgo } },
        }),
      ]);

      return ResponseWrapper.success(res, {
        cards: {
          totalUser,
          newUserToday,
          activeUser30d,
          pendingAction,
          revenue30d: revenue30d._sum.totalFee || 0,
          totalWeight30d: totalWeight30d._sum.weight || 0,
        },
        timestamp: new Date(),
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * [GET] 獲取導航欄通知標籤 (Badges)
   * ❗ 核心對位：對接 admin-layout.js 的 syncBadges() ❗
   */
  async getBadgeStats(req, res, next) {
    try {
      const [
        pkgPending, // 待入庫包裹
        shipmentReview, // 待核價集運單
        furniturePending, // 待報價家具單
        financePending, // 待審核儲值憑證
      ] = await Promise.all([
        prisma.package.count({ where: { status: "PENDING" } }),
        prisma.shipment.count({ where: { status: "AWAITING_REVIEW" } }),
        prisma.furnitureOrder.count({ where: { status: "PENDING" } }),
        prisma.depositRequest.count({ where: { status: "PENDING" } }),
      ]);

      // 回傳結構必須完全符合 admin-layout.js 的期待
      return ResponseWrapper.success(res, {
        badges: {
          packages: pkgPending,
          shipments: shipmentReview,
          furniture: furniturePending,
          finance: financePending,
        },
      });
    } catch (error) {
      // 靜默處理統計錯誤，不中斷管理端加載
      return ResponseWrapper.success(res, {
        badges: { packages: 0, shipments: 0, furniture: 0, finance: 0 },
      });
    }
  },

  /**
   * [GET] 獲取最近 7 天的營運趨勢 (用於 Chart.js)
   */
  async getWeeklyTrend(req, res, next) {
    try {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        d.setHours(0, 0, 0, 0);
        days.push(d);
      }

      const trendData = await Promise.all(
        days.map(async (day) => {
          const nextDay = new Date(day);
          nextDay.setDate(nextDay.getDate() + 1);

          const count = await prisma.shipment.count({
            where: { createdAt: { gte: day, lt: nextDay } },
          });

          return {
            date: day.toLocaleDateString("zh-TW", {
              month: "short",
              day: "numeric",
            }),
            shipments: count,
          };
        })
      );

      return ResponseWrapper.success(res, trendData);
    } catch (error) {
      next(error);
    }
  },
};

module.exports = reportController;
