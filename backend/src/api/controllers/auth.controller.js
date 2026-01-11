// backend/src/api/controllers/auth.controller.js
// 優化自 authController.js V16.4
const prisma = require("../../../config/db");
const bcrypt = require("bcryptjs");
const generateToken = require("../../utils/generateToken");
const lineService = require("../../services/infrastructure/line.service");

/**
 * 內部輔助：獲取下一個遞增的 PiggyID (RP6006888 起)
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

exports.register = async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email } });
      if (existing) throw new Error("此 Email 已被註冊");

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      const piggyId = await getNextPiggyId(tx);

      return await tx.user.create({
        data: {
          email,
          passwordHash,
          name,
          phone,
          piggyId,
          tierId: "default_tier_id", // 預設普通會員
        },
      });
    });

    res.status(201).json({ success: true, user: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.lineLogin = async (req, res) => {
  try {
    const { lineUserId, displayName, pictureUrl, email } = req.body;

    let user = await prisma.user.findUnique({ where: { lineUserId } });

    if (!user) {
      // 處理 LINE 無 Email 時的暫時信箱邏輯
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

      // 歡迎新用戶
      await lineService.pushMessage(
        lineUserId,
        `歡迎加入小跑豬！您的專屬編號為 ${user.piggyId}`
      );
    }

    const token = generateToken(user.id);
    res.json({ success: true, token, user });
  } catch (error) {
    res.status(500).json({ success: false, message: "LINE 登入失敗" });
  }
};
