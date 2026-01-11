// backend/src/api/controllers/member.controller.js
const prisma = require("../../../config/db");

exports.getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        tier: true,
        _count: { select: { packages: true, shipments: true } },
      },
    });

    // 移除敏感資訊
    delete user.passwordHash;

    res.json({ success: true, profile: user });
  } catch (error) {
    res.status(500).json({ success: false, message: "讀取資料失敗" });
  }
};

/**
 * 申報人管理 (EZ WAY 實名制)
 */
exports.getDeclarants = async (req, res) => {
  const declarants = await prisma.declarant.findMany({
    where: { userId: req.user.id },
    orderBy: { isDefault: "desc" },
  });
  res.json({ success: true, declarants });
};

exports.addDeclarant = async (req, res) => {
  const { name, phone, idCardNumber, isDefault } = req.body;

  const declarant = await prisma.declarant.create({
    data: { userId: req.user.id, name, phone, idCardNumber, isDefault },
  });

  res.json({ success: true, declarant });
};
// 專業身分證校驗邏輯 (整合自 recipientController.js)
const validateIdNumber = (id) => {
  const idRegex = /^[A-Z][12]\d{8}$/;
  return idRegex.test(id);
};

exports.addRecipient = async (req, res) => {
  const { name, phone, address, idNumber, isDefault } = req.body;

  if (!validateIdNumber(idNumber)) {
    return res
      .status(400)
      .json({ success: false, message: "身分證格式不正確" });
  }

  const recipient = await prisma.recipient.create({
    data: {
      userId: req.user.id,
      name,
      phone,
      address,
      idNumber,
      isDefault: isDefault || false,
    },
  });
  res.json({ success: true, recipient });
};

exports.getMyRecipients = async (req, res) => {
  const recipients = await prisma.recipient.findMany({
    where: { userId: req.user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  res.json({ success: true, recipients });
};
