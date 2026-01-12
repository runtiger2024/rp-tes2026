// backend/src/api/controllers/auth.controller.js
// V18.1 - 旗艦級專業物流身份驗證控制器
// 整合重點：登入/註冊事務、LINE 自動綁定邏輯、密碼安全性管理、ResponseWrapper 統一化

const prisma = require("../../../config/db");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const generateToken = require("../../utils/generateToken");
const { ResponseWrapper } = require("../../utils/response.wrapper");
const lineService = require("../../services/infrastructure/line.service");

/**
 * 內部輔助：獲取下一個遞增的 PiggyID (RP6006888 起)
 * 修正邏輯：系統起始預設值調整為 6006887，確保下一位會員從 RP6006888 開始
 */
const getNextPiggyId = async (tx) => {
  const lastUser = await tx.user.findFirst({
    where: { piggyId: { startsWith: "RP" } },
    orderBy: { piggyId: "desc" },
  });

  let nextNum = 6006888;
  if (lastUser && lastUser.piggyId) {
    const lastNum = parseInt(lastUser.piggyId.replace("RP", ""), 10);
    if (lastNum >= 6006887) nextNum = lastNum + 1;
  }
  return `RP${nextNum}`;
};

/**
 * [POST] 會員註冊
 * 包含 PiggyID 自動生成與錢包/等級初始化
 */
exports.register = async (req, res, next) => {
  try {
    const { email, password, name, phone } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { email: email.toLowerCase() },
      });
      if (existing) throw new Error("此 Email 已被註冊");

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      const piggyId = await getNextPiggyId(tx);

      return await tx.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          name,
          phone,
          piggyId,
          tierId: "default_tier_id", // 預設普通會員
          isActive: true,
        },
      });
    });

    return ResponseWrapper.success(res, result, "註冊成功", 201);
  } catch (error) {
    next(error);
  }
};

/**
 * [POST] 一般登入
 * 對接舊版 V16.4 核心驗證邏輯
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || !user.isActive) {
      return ResponseWrapper.error(res, "帳號不存在或已註銷", 401);
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return ResponseWrapper.error(res, "密碼輸入錯誤", 401);
    }

    const token = generateToken(user.id);
    return ResponseWrapper.success(res, { token, user }, "登入成功");
  } catch (error) {
    next(error);
  }
};

/**
 * [POST] LINE 登入/快速註冊
 * 支援自動綁定現有 Email 與暫時信箱標記邏輯
 */
exports.lineLogin = async (req, res, next) => {
  try {
    const { lineUserId, displayName, pictureUrl, email } = req.body;

    // 1. 優先透過 lineUserId 尋找使用者
    let user = await prisma.user.findUnique({ where: { lineUserId } });

    // 2. 若找不到，嘗試透過 Email 自動綁定 (若有提供 Email)
    if (!user && email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (existingUser) {
        user = await prisma.user.update({
          where: { id: existingUser.id },
          data: { lineUserId },
        });
      }
    }

    // 3. 若仍找不到，則為全新的 LINE 用戶進行註冊
    if (!user) {
      const finalEmail = email || `${lineUserId}@line.temp`;

      user = await prisma.$transaction(async (tx) => {
        const piggyId = await getNextPiggyId(tx);
        return await tx.user.create({
          data: {
            lineUserId,
            name: displayName,
            email: finalEmail,
            piggyId,
            isActive: true,
          },
        });
      });

      // 歡迎新用戶 (LINE 推播)
      await lineService.pushMessage(
        lineUserId,
        `歡迎加入小跑豬！您的專屬編號為 ${user.piggyId}`
      );
    }

    const token = generateToken(user.id);
    const isPlaceholder = user.email.endsWith("@line.temp");

    return ResponseWrapper.success(
      res,
      {
        token,
        user: { ...user, isEmailPlaceholder: isPlaceholder },
      },
      "LINE 登入成功"
    );
  } catch (error) {
    next(error);
  }
};

/**
 * [GET] 取得個人資料
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { tier: true },
    });
    return ResponseWrapper.success(res, user);
  } catch (error) {
    next(error);
  }
};

/**
 * [PUT] 更新個人資料
 * 包含地址、統編、手機等資訊的同步更新
 */
exports.updateMe = async (req, res, next) => {
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

    return ResponseWrapper.success(res, updatedUser, "個人資料更新成功");
  } catch (error) {
    next(error);
  }
};

/**
 * [POST] 修改密碼 (登入狀態)
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user.passwordHash) {
      return ResponseWrapper.error(
        res,
        "此帳號尚未設定密碼，請先使用忘記密碼功能或連動 LINE",
        400
      );
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return ResponseWrapper.error(res, "目前密碼輸入不正確", 400);
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash },
    });

    return ResponseWrapper.success(res, null, "密碼已成功變更");
  } catch (error) {
    next(error);
  }
};

/**
 * [POST] 忘記密碼 - 發送重設郵件
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // 為了安全，若找不到用戶也回覆成功，防止 Email 探測
      return ResponseWrapper.success(
        res,
        null,
        "若此 Email 已註冊，系統將發送重設信件"
      );
    }

    const resetToken = crypto.randomBytes(20).toString("hex");
    const resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    const resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 分鐘有效

    await prisma.user.update({
      where: { id: user.id },
      data: { resetPasswordToken, resetPasswordExpire },
    });

    // 這裡通常會調用 mailService.sendResetPassword(user.email, resetToken);
    return ResponseWrapper.success(
      res,
      { resetToken },
      "重設連結已生成（請檢查郵件）"
    );
  } catch (error) {
    next(error);
  }
};

/**
 * [DELETE] 帳號註銷 (軟刪除)
 */
exports.deleteMe = async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        isActive: false,
        lineUserId: null, // 解除 LINE 綁定
        updatedAt: new Date(),
      },
    });

    return ResponseWrapper.success(res, null, "帳號已成功註銷");
  } catch (error) {
    next(error);
  }
};
