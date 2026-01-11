// backend/src/services/infrastructure/invoice.service.js
// 優化自 invoiceHelper.js
const axios = require("axios");
const crypto = require("crypto");
const prisma = require("../../../config/db");

class InvoiceService {
  /**
   * 檢查是否為 LINE 佔位符號信箱
   */
  isInvalidEmail(email) {
    return !email || email.includes("@line.temp");
  }

  async createInvoice(orderData, user) {
    if (this.isInvalidEmail(user.email)) {
      throw new Error("請先綁定正式 Email 才能開立發票");
    }

    // 實作與 Amego API 的對接邏輯... [參考原始 invoiceHelper.js]
    // 這裡應包含 AES 加密與傳送請求
  }
}

module.exports = new InvoiceService();
