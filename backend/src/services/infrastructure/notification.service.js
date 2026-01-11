// backend/src/services/infrastructure/notification.service.js
const prisma = require("../../../config/db");
const lineService = require("./line.service");

class NotificationService {
  /**
   * 發送系統通知 (含 LINE 自動推播)
   */
  async notify(userId, { title, content, type = "SYSTEM", path = "" }) {
    // 1. 建立站內通知
    const notification = await prisma.notification.create({
      data: { userId, title, content, type },
    });

    // 2. 如果使用者綁定了 LINE，同步推播
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lineUserId: true },
    });

    if (user?.lineUserId) {
      const flexMessage = lineService.createParcelFlex(title, content);
      await lineService.pushMessage(user.lineUserId, flexMessage);
    }

    return notification;
  }
}

module.exports = new NotificationService();
