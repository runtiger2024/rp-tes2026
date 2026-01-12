/**
 * member.controller.js - V2026.01.Final_Pro_Integrated
 * 用戶端會員與地址簿核心控制器 (終極整合版)
 * 負責功能：
 * 1. 個人資料獲取與更新 (包含 Tier 會員等級)
 * 2. 申報人管理 (EZ WAY 實名制資訊)
 * 3. 收件人地址簿管理 (含預設值切換事務處理)
 * 4. 專業身分證格式 (台灣規則) 校驗
 */

const prisma = require("../../../config/db");
const { ResponseWrapper } = require("../../utils/response.wrapper");

/**
 * 內部輔助：專業身分證格式校驗 (台灣身分證規則)
 */
const validateIdNumber = (id) => {
  const idRegex = /^[A-Z][12]\d{8}$/;
  return idRegex.test(id);
};

const memberController = {
  /**
   * [GET] 獲取個人資料
   */
  async getProfile(req, res, next) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          tier: true,
          _count: { select: { packages: true, shipments: true } },
        },
      });

      if (!user) return ResponseWrapper.error(res, "找不到使用者資料", 404);

      // 移除敏感資訊
      const { passwordHash, ...profile } = user;
      return ResponseWrapper.success(res, profile);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [PUT] 更新個人預設發票與基本資料
   */
  async updateProfile(req, res, next) {
    try {
      const { name, phone, defaultAddress, defaultTaxId, defaultInvoiceTitle } =
        req.body;

      const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: {
          name,
          phone,
          defaultAddress,
          defaultTaxId,
          defaultInvoiceTitle,
        },
      });

      return ResponseWrapper.success(res, updatedUser, "個人資料已更新");
    } catch (error) {
      next(error);
    }
  },

  // ==========================================
  // --- 申報人管理 (EZ WAY) ---
  // ==========================================

  async getDeclarants(req, res, next) {
    try {
      const declarants = await prisma.declarant.findMany({
        where: { userId: req.user.id },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      });
      return ResponseWrapper.success(res, declarants);
    } catch (error) {
      next(error);
    }
  },

  async addDeclarant(req, res, next) {
    try {
      const { name, phone, idCardNumber, isDefault } = req.body;

      if (!validateIdNumber(idCardNumber)) {
        return ResponseWrapper.error(res, "申報人身分證格式錯誤", 400);
      }

      const result = await prisma.$transaction(async (tx) => {
        // 若設為預設，先將其他的取消
        if (isDefault) {
          await tx.declarant.updateMany({
            where: { userId: req.user.id },
            data: { isDefault: false },
          });
        }

        return await tx.declarant.create({
          data: {
            userId: req.user.id,
            name,
            phone,
            idCardNumber: idCardNumber.toUpperCase(),
            isDefault: isDefault || false,
          },
        });
      });

      return ResponseWrapper.success(res, result, "申報人已新增", 201);
    } catch (error) {
      next(error);
    }
  },

  async deleteDeclarant(req, res, next) {
    try {
      const { id } = req.params;
      await prisma.declarant.delete({
        where: { id, userId: req.user.id },
      });
      return ResponseWrapper.success(res, null, "申報人已刪除");
    } catch (error) {
      next(error);
    }
  },

  // ==========================================
  // --- 收件人地址簿管理 ---
  // ==========================================

  /**
   * [GET] 獲取我的常用收件人
   */
  async getMyRecipients(req, res, next) {
    try {
      const recipients = await prisma.recipient.findMany({
        where: { userId: req.user.id },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      });
      return ResponseWrapper.success(res, recipients);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [POST] 新增收件人 (含事務邏輯)
   */
  async addRecipient(req, res, next) {
    try {
      const { name, phone, address, idNumber, isDefault } = req.body;

      if (idNumber && !validateIdNumber(idNumber)) {
        return ResponseWrapper.error(res, "收件人身分證格式錯誤", 400);
      }

      const recipient = await prisma.$transaction(async (tx) => {
        if (isDefault) {
          await tx.recipient.updateMany({
            where: { userId: req.user.id },
            data: { isDefault: false },
          });
        }

        return await tx.recipient.create({
          data: {
            userId: req.user.id,
            name,
            phone,
            address,
            idNumber: idNumber ? idNumber.toUpperCase() : null,
            isDefault: isDefault || false,
          },
        });
      });

      return ResponseWrapper.success(res, recipient, "收件資訊已儲存", 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [PUT] 修改收件人
   */
  async updateRecipient(req, res, next) {
    try {
      const { id } = req.params;
      const { name, phone, address, idNumber, isDefault } = req.body;

      if (idNumber && !validateIdNumber(idNumber)) {
        return ResponseWrapper.error(res, "身分證格式不正確", 400);
      }

      const result = await prisma.$transaction(async (tx) => {
        if (isDefault) {
          await tx.recipient.updateMany({
            where: { userId: req.user.id },
            data: { isDefault: false },
          });
        }

        return await tx.recipient.update({
          where: { id, userId: req.user.id },
          data: {
            name,
            phone,
            address,
            idNumber: idNumber ? idNumber.toUpperCase() : undefined,
            isDefault,
          },
        });
      });

      return ResponseWrapper.success(res, result, "收件資訊已更新");
    } catch (error) {
      next(error);
    }
  },

  /**
   * [DELETE] 刪除收件人
   */
  async deleteRecipient(req, res, next) {
    try {
      const { id } = req.params;
      await prisma.recipient.delete({
        where: { id, userId: req.user.id },
      });
      return ResponseWrapper.success(res, null, "收件資訊已刪除");
    } catch (error) {
      next(error);
    }
  },
};

module.exports = memberController;
