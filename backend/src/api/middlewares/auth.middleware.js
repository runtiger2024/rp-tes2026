// backend/src/api/middlewares/auth.middleware.js
const jwt = require("jsonwebtoken");
const prisma = require("../../../config/db");

/**
 * 通用身份驗證中間件
 */
exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "未經授權，請先登入" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 獲取使用者並包含等級資訊
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { tier: true },
    });

    if (!user || !user.isActive) {
      return res
        .status(401)
        .json({ success: false, message: "帳號無效或已被停用" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res
      .status(401)
      .json({ success: false, message: "憑證無效或已過期" });
  }
};

/**
 * 角色權限檢查中間件
 * @param  {...string} roles - 允許的角色 (如: 'ADMIN', 'WAREHOUSE')
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `您的角色 (${req.user.role}) 無權執行此操作`,
      });
    }
    next();
  };
};
