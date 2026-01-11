// backend/src/services/infrastructure/config.service.js
const prisma = require("../../../config/db");
const ratesManager = require("../../utils/ratesManager");

class ConfigService {
  /**
   * 初始化系統預設設定 (整合自 V2026.1.1)
   */
  async seedDefaultSettings() {
    const currentRates = await ratesManager.getRates();
    const configs = [
      {
        key: "rates_config",
        value: currentRates,
        category: "SHIPPING",
        description: "運費費率與常數設定 (JSON)",
      },
      {
        key: "invoice_config",
        value: {
          merchantId: "",
          hashKey: "",
          apiUrl: "https://invoice-api.amego.tw/json/f0401",
          enabled: false,
        },
        category: "INVOICE",
        description: "電子發票介接配置",
      },
      {
        key: "bank_info",
        value: {
          bankName: "第一銀行 (007)",
          branch: "台南分行",
          account: "60110066477",
          holder: "跑得快",
        },
        category: "PAYMENT",
        description: "銀行轉帳資訊",
      },
      {
        key: "announcement",
        value: { enabled: true, text: "歡迎使用小跑豬集運！", color: "info" },
        category: "CONTENT",
        description: "首頁跑馬燈公告",
      },
      {
        key: "furniture_config",
        value: { exchangeRate: 4.65, serviceFeeRate: 0.05, minServiceFee: 500 },
        category: "FURNITURE",
        description: "家具代採購參數",
      },
    ];

    for (const config of configs) {
      await prisma.systemSetting.upsert({
        where: { key: config.key },
        update: {},
        create: config,
      });
    }
  }

  /**
   * 取得系統設定並進行安全性遮罩 (整合自 V16.1)
   */
  async getSettings(isAdmin = false) {
    const settingsList = await prisma.systemSetting.findMany();
    const settings = {};

    settingsList.forEach((item) => {
      let val = item.value;
      // 敏感資訊遮罩：發票 HashKey
      if (item.key === "invoice_config" && val?.hashKey) {
        val = { ...val, hashKey: "********" };
      }
      settings[item.key] = val;
    });

    return settings;
  }

  /**
   * 更新單一或批量設定 (含校驗與遮罩還原邏輯)
   */
  async updateSettings(updates, adminId) {
    return await prisma.$transaction(async (tx) => {
      for (const [key, value] of Object.entries(updates)) {
        // 1. 發票設定還原遮罩
        if (key === "invoice_config" && value.hashKey === "********") {
          const old = await tx.systemSetting.findUnique({
            where: { key: "invoice_config" },
          });
          value.hashKey = old?.value?.hashKey || "";
        }

        // 2. 業務校驗：家具代購匯率
        if (
          key === "furniture_config" &&
          isNaN(parseFloat(value.exchangeRate))
        ) {
          throw new Error("家具代採購匯率必須為數字");
        }

        await tx.systemSetting.upsert({
          where: { key },
          update: { value },
          create: { key, value, category: "GENERAL" },
        });
      }
    });
  }
}

module.exports = new ConfigService();
