// backend/src/utils/rates.helper.js
const prisma = require("../../config/db");

const DEFAULT_RATES = {
  categories: {
    general: { name: "一般家具", weightRate: 0, volumeRate: 0 },
  },
  constants: {
    VOLUME_DIVISOR: 28317,
    CBM_TO_CAI_FACTOR: 35.315,
    OVERSIZED_LIMIT: 300,
    OVERSIZED_FEE: 0,
    OVERWEIGHT_LIMIT: 100,
    OVERWEIGHT_FEE: 0,
  },
};

const getRates = async () => {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "rates_config" },
    });
    if (!setting) return DEFAULT_RATES;
    return typeof setting.value === "string"
      ? JSON.parse(setting.value)
      : setting.value;
  } catch (e) {
    return DEFAULT_RATES;
  }
};

const getCategoryRate = (rates, typeInput) => {
  const normalized = (typeInput || "general").trim().toLowerCase();
  return rates.categories[normalized] || rates.categories["general"];
};

module.exports = { getRates, getCategoryRate };
