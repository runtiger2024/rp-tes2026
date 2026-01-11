// backend/src/api/controllers/line.controller.js
// 優化自 lineController.js
const prisma = require("../../../config/db");
const lineService = require("../../services/infrastructure/line.service");

exports.handleWebhook = async (req, res) => {
  const { events } = req.body;

  try {
    for (const event of events) {
      const lineUserId = event.source.userId;

      if (event.type === "follow") {
        await handleFollow(lineUserId);
      } else if (event.type === "message" && event.message.type === "text") {
        await handleMessage(lineUserId, event.message.text, event.replyToken);
      }
    }
    res.status(200).send("OK");
  } catch (error) {
    console.error("[LINE Webhook Error]", error.message);
    res.status(500).end();
  }
};

async function handleFollow(lineUserId) {
  const user = await prisma.user.findUnique({ where: { lineUserId } });
  if (user) {
    await lineService.pushMessage(
      lineUserId,
      `歡迎回來，${user.name || "會員"}！您的編號是 ${user.piggyId}`
    );
  }
}

async function handleMessage(lineUserId, text, replyToken) {
  // 簡易查詢邏輯整合：根據 piggyId 或手機查詢
  if (text.includes("查詢")) {
    const user = await prisma.user.findUnique({
      where: { lineUserId },
      include: { _count: { select: { packages: true } } },
    });

    const replyText = user
      ? `您的編號：${user.piggyId}\n目前庫存包裹：${user._count.packages} 件`
      : "尚未綁定帳號，請至官網登入並連結 LINE。";

    await lineService.pushMessage(lineUserId, replyText);
  }
}
