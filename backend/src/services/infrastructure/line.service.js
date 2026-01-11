// backend/src/services/infrastructure/line.service.js
// 優化自 lineManager.js V16.0
const axios = require("axios");
const qs = require("qs");

class LineService {
  constructor() {
    this.cachedToken = null;
    this.tokenExpiresAt = 0;
  }

  /**
   * 自動維護與獲取 LINE Access Token
   */
  async getAccessToken() {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt - 300000) {
      return this.cachedToken;
    }

    try {
      const response = await axios.post(
        "https://api.line.me/v2/oauth/accessToken",
        qs.stringify({
          grant_type: "client_credentials",
          client_id: process.env.LINE_CHANNEL_ID,
          client_secret: process.env.LINE_CHANNEL_SECRET,
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      this.cachedToken = response.data.access_token;
      this.tokenExpiresAt = Date.now() + response.data.expires_in * 1000;
      return this.cachedToken;
    } catch (error) {
      console.error("[LINE Service] Token Error:", error.message);
      return null;
    }
  }

  /**
   * 發送單人推播訊息 (支援文字或 Flex Message)
   */
  async pushMessage(to, messages) {
    const token = await this.getAccessToken();
    if (!token || !to) return;

    try {
      const msgArray = Array.isArray(messages) ? messages : [messages];
      await axios.post(
        "https://api.line.me/v2/bot/message/push",
        {
          to,
          messages: msgArray.map((m) =>
            typeof m === "string" ? { type: "text", text: m } : m
          ),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      console.error(
        "[LINE Service] Push Error:",
        error.response?.data || error.message
      );
    }
  }

  /**
   * 建立專業物流 Flex Message (包裹卡片)
   */
  createParcelFlex(status, description) {
    return {
      type: "flex",
      altText: "小跑豬包裹狀態更新",
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: "小跑豬物流通知",
              weight: "bold",
              color: "#1DB446",
              size: "sm",
            },
            {
              type: "text",
              text: status,
              weight: "bold",
              size: "xl",
              margin: "md",
            },
            { type: "separator", margin: "xxl" },
            {
              type: "text",
              text: description,
              wrap: true,
              margin: "md",
              size: "sm",
              color: "#666666",
            },
          ],
        },
      },
    };
  }
}

module.exports = new LineService();
