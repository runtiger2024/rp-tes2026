// backend/src/api/controllers/settings.controller.js
const prisma = require("../../../config/db");

/**
 * 取得用戶端公開配置 (整合 V2026.1.1)
 */
exports.getPublicSettings = async (req, res) => {
  try {
    // 限制僅讀取公開 Key
    const publicKeys = [
      "bank_info",
      "announcement",
      "warehouse_info",
      "furniture_config",
    ];
    const settingsList = await prisma.systemSetting.findMany({
      where: { key: { in: publicKeys } },
    });

    const settings = {};
    settingsList.forEach((s) => (settings[s.key] = s.value));

    res.json({
      success: true,
      settings,
      note: "默認開立電子發票至帳號設定中填寫的電子信箱", // 根據 V2.4.1 錢包模組需求新增
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "無法讀取資訊" });
  }
};
