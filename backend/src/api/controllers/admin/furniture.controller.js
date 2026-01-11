// backend/src/api/controllers/admin/furniture.controller.js
const furnitureService = require("../../../services/logistics/furniture.service");
const prisma = require("../../../../config/db");

exports.getOrders = async (req, res) => {
  const { page = 1, limit = 20, status, search } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = {
    ...(status && { status }),
    ...(search && {
      OR: [
        { factoryName: { contains: search, mode: "insensitive" } },
        { productName: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
      ],
    }),
  };

  const [total, orders] = await prisma.$transaction([
    prisma.furnitureOrder.count({ where }),
    prisma.furnitureOrder.findMany({
      where,
      skip,
      take: parseInt(limit),
      include: { user: { select: { name: true, piggyId: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  res.json({
    success: true,
    orders,
    pagination: { total, page, totalPages: Math.ceil(total / limit) },
  });
};

exports.updateOrder = async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    const updated = await furnitureService.updateStatus(
      req.params.id,
      status,
      adminNote
    );
    res.json({ success: true, order: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.bulkDelete = async (req, res) => {
  const { ids } = req.body;
  await prisma.furnitureOrder.deleteMany({ where: { id: { in: ids } } });
  res.json({ success: true, message: `已刪除 ${ids.length} 筆訂單` });
};
