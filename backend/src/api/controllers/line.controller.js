// backend/src/api/controllers/line.controller.js
// V18.1 - 旗艦級專業物流 LINE Webhook 控制器
// 整合重點：比對 V17 舊版餘額查詢功能，完美對接 V18.1 新版 Prisma 6 架構與一單多箱邏輯

const prisma = require("../../../config/db");
const lineService = require("../../services/infrastructure/line.service");

/**
 * [POST] 處理 LINE Webhook 事件
 */
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

/**
 * 處理加入好友事件 (整合自 V18.1 初始邏輯)
 */
async function handleFollow(lineUserId) {
  const user = await prisma.user.findUnique({ where: { lineUserId } });
  if (user) {
    await lineService.pushMessage(
      lineUserId,
      `歡迎回來，${user.name || "會員"}！您的編號是 ${
        user.piggyId
      }\n您可以輸入「查詢」或點擊選單來獲取最新動態。`
    );
  }
}

/**
 * 處理文字訊息事件 (深度整合 V17 錢包功能與 V18.1 倉儲動態)
 */
async function handleMessage(lineUserId, text, replyToken) {
  // 1. 查找使用者並包含包裹計數與等級資訊
  const user = await prisma.user.findUnique({
    where: { lineUserId },
    include: {
      _count: { select: { packages: true } },
      tier: true,
    },
  });

  if (!user) {
    return await lineService.pushMessage(
      lineUserId,
      "您的 LINE 帳號尚未與小跑豬官網綁定。\n請先至官網登入，並在個人中心點擊「連結 LINE」。"
    );
  }

  // 2. 判斷指令
  let replyText = "";

  // 查詢餘額與點數 (整合移植自 V17 舊版邏輯)
  if (text === "查詢餘額" || text === "錢包" || text.includes("餘額")) {
    replyText = `【小跑豬帳務查詢】\n會員：${user.name}\n編號：${
      user.piggyId
    }\n當前等級：${
      user.tier?.name || "普通會員"
    }\n當前餘額：$${user.balance.toLocaleString()} TWD\n剩餘點數：${
      user.points
    } P`;
  }

  // 查詢庫存包裹 (V18.1 強化版邏輯)
  else if (text.includes("查詢") || text.includes("包裹") || text === "進度") {
    replyText = `【小跑豬庫存快報】\n您的編號：${user.piggyId}\n目前庫存包裹：${user._count.packages} 件\n\n您可以前往官網「集運中心」進行打包申請。\n連結：https://runpiggy.shop/dashboard`;
  }

  // 預設引導訊息
  else {
    replyText = `您好！我是小跑豬助手。\n\n目前支援的關鍵字查詢：\n1. 輸入「查詢」：查看庫存包裹數量。\n2. 輸入「餘額」：查看您的錢包餘額與點數。\n\n如有其他問題，請點擊下方選單與真人客服聯絡。`;
  }

  // 3. 發送訊息 (支援回覆 Token 或主動推播)
  await lineService.pushMessage(lineUserId, replyText);
}
