// backend/prisma/seed.js
// V18.0 - 旗艦整合優化版：支援分級折扣、財務權限與全模組內容初始化
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const prisma = new PrismaClient();

async function main() {
  console.log(
    "🌱 正在啟動專業物流系統種子數據初始化 (RunPiggy Professional Seeding)..."
  );

  // ==========================================
  // 1. 會員等級與折扣體系 (Tiers)
  // ==========================================
  const tiers = [
    {
      name: "普通會員",
      level: 0,
      thresholdAmount: 0,
      discountRate: 1.0,
      pointMultiplier: 1.0,
      priority: 0,
    },
    {
      name: "黃金會員",
      level: 1,
      thresholdAmount: 50000,
      discountRate: 0.95,
      pointMultiplier: 1.2,
      priority: 1,
    },
    {
      name: "鑽石會員",
      level: 2,
      thresholdAmount: 200000,
      discountRate: 0.9,
      pointMultiplier: 1.5,
      priority: 2,
    },
  ];

  console.log("-> 建立會員等級...");
  for (const t of tiers) {
    await prisma.tier.upsert({
      where: { name: t.name },
      update: t,
      create: t,
    });
  }

  const defaultTier = await prisma.tier.findUnique({
    where: { name: "普通會員" },
  });

  // ==========================================
  // 2. 超級管理員與特殊帳號 (Users & Roles)
  // ==========================================
  const salt = await bcrypt.genSalt(10);
  const adminPassword = process.env.ADMIN_PASSWORD || "randy1007";
  const adminHash = await bcrypt.hash(adminPassword, salt);

  const users = [
    {
      email: process.env.ADMIN_EMAIL || "randyhuang1007@gmail.com",
      name: "超級管理員 Randy",
      piggyId: "RP6000001",
      passwordHash: adminHash,
      role: "ADMIN",
      isActive: true,
      tierId: defaultTier.id,
    },
    {
      email: "unclaimed@runpiggy.com",
      name: "無主包裹庫存箱",
      piggyId: "RP9999999",
      passwordHash: await bcrypt.hash("UnclaimedStorage2026!", salt),
      role: "WAREHOUSE",
      isActive: true,
      tierId: defaultTier.id,
    },
  ];

  console.log("-> 建立核心管理帳號...");
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role, isActive: true },
      create: u,
    });
  }

  // ==========================================
  // 3. 系統營運配置 (System Settings)
  // ==========================================
  const configs = [
    {
      key: "rates_config",
      value: {
        categories: {
          general: { name: "一般家具", weightRate: 25, volumeRate: 400 },
          special: { name: "特貨/電器", weightRate: 35, volumeRate: 550 },
        },
        constants: {
          VOLUME_DIVISOR: 28317,
          CBM_TO_CAI_FACTOR: 35.315,
          OVERSIZED_LIMIT: 300,
          OVERSIZED_FEE: 1500,
          OVERWEIGHT_LIMIT: 100,
          OVERWEIGHT_FEE: 1000,
        },
      },
      description: "全域運費與附加費計費配置",
    },
    {
      key: "bank_info",
      value: {
        bankName: "第一銀行 (007)",
        branch: "台南分行",
        account: "60110066477",
        holder: "小跑豬物流有限公司",
      },
      description: "客戶匯款轉帳資訊",
    },
    {
      key: "furniture_config",
      value: { exchangeRate: 4.65, serviceFeeRate: 0.05, minServiceFee: 500 },
      description: "家具代採購匯率與手續費",
    },
  ];

  console.log("-> 初始化系統配置...");
  for (const c of configs) {
    await prisma.systemSetting.upsert({
      where: { key: c.key },
      update: { value: c.value },
      create: c,
    });
  }

  // ==========================================
  // 4. 附加服務項目 (Service Items)
  // ==========================================
  const serviceItems = [
    {
      name: "上樓費",
      price: 0,
      unit: "PIECE",
      description: "由派送司機現場報價領取",
    },
    {
      name: "拆木架回收",
      price: 0,
      unit: "PIECE",
      description: "司機現場處理",
    },
    {
      name: "氣泡膜加固",
      price: 150,
      unit: "PIECE",
      description: "倉庫專業打包加固",
    },
    {
      name: "釘木架服務",
      price: 800,
      unit: "PIECE",
      description: "易碎品強制加固",
    },
  ];

  console.log("-> 建立附加服務清單...");
  for (const item of serviceItems) {
    await prisma.shipmentServiceItem.upsert({
      where: { name: item.name },
      update: item,
      create: item,
    });
  }

  // ==========================================
  // 5. 內容管理系統初始化 (News & CMS)
  // ==========================================
  console.log("-> 建立初始公告...");
  await prisma.news.upsert({
    where: { id: "initial-welcome-news" },
    update: {},
    create: {
      id: "initial-welcome-news",
      title: "歡迎使用小跑豬 2026 專業物流系統",
      content:
        "我們的系統已全面升級為專業 ERP 體系，為您提供更精準的計費與資金安全保障。",
      category: "SYSTEM",
      isImportant: true,
      isPublished: true,
    },
  });

  console.log("✅ 所有種子數據初始化完成！系統已就緒。");
}

main()
  .catch((e) => {
    console.error("❌ Seed 執行失敗:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
