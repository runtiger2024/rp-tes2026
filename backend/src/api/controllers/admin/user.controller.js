// backend/src/api/controllers/admin/user.controller.js
// 優化自 admin/userController.js
const prisma = require("../../../../config/db");
const generateToken = require("../../../utils/generateToken");

exports.getUsers = async (req, res) => {
  const { search, role, page = 1 } = req.query;
  const limit = 20;
  const skip = (page - 1) * limit;

  const where = {
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { piggyId: { contains: search, mode: "insensitive" } }, // 支援 RP 編號搜尋
      ],
    }),
  };

  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  res.json({
    success: true,
    users,
    pagination: { total, page, totalPages: Math.ceil(total / limit) },
  });
};

exports.impersonate = async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ message: "找不到使用者" });

  const token = generateToken(user.id); // 模擬登入功能
  res.json({ success: true, token, user });
};
