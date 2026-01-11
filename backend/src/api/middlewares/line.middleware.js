// backend/src/api/middlewares/line.middleware.js
// 優化自 lineAuth.js V16.2
const crypto = require("crypto");

/**
 * 驗證 LINE Webhook 簽章
 */
exports.verifyLineSignature = (req, res, next) => {
  const signature = req.headers["x-line-signature"];
  const channelSecret = process.env.LINE_CHANNEL_SECRET;

  if (!signature) {
    return res.status(401).send("Unauthorized");
  }

  // 必須使用從 app.js 擷取的 req.rawBody 原始數據
  if (!req.rawBody) {
    console.error(
      "[LINE Auth Error] Missing rawBody. Check express.json configuration."
    );
    return res.status(500).send("Internal Server Error");
  }

  const hash = crypto
    .createHmac("sha256", channelSecret)
    .update(req.rawBody)
    .digest("base64");

  if (hash !== signature) {
    return res.status(401).send("Invalid Signature");
  }

  next();
};
