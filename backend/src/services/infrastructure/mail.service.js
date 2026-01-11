// backend/src/services/infrastructure/mail.service.js
// 優化自 sendEmail.js
const sgMail = require("@sendgrid/mail");
const prisma = require("../../../config/db");

class MailService {
  constructor() {
    if (process.env.SENDGRID_API_KEY) {
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    }
  }

  async send(to, subject, html) {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "email_config" },
    });
    const config = setting?.value || {
      senderEmail: process.env.SENDER_EMAIL_ADDRESS,
      senderName: "小跑豬物流",
    };

    const msg = {
      to,
      from: { email: config.senderEmail, name: config.senderName },
      subject,
      html,
    };
    return await sgMail.send(msg);
  }

  // 快捷方法：發送集運單通知
  async sendShipmentNotify(user, shipment) {
    const html = `
      <h2>您的訂單已成功建立！</h2>
      <p>親愛的 ${user.name} 您好：</p>
      <p>您的集運單 <strong>${shipment.shipmentNo}</strong> 已建立成功。</p>
      <p>應付金額：NT$ ${shipment.finalAmount.toLocaleString()}</p>
      <p>備註：系統將默認開立電子發票至您的信箱。</p>
    `;
    return this.send(user.email, "小跑豬集運：訂單建立通知", html);
  }
}

module.exports = new MailService();
