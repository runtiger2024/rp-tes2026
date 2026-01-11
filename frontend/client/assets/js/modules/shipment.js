// frontend/client/assets/js/modules/shipment.js
import { apiClient } from "../../../api/apiClient.js";
import { ui } from "../../utils/ui-helper.js";

export const shipmentModule = {
  STATUS_MAP: {
    UNPAID: { text: "待付款", class: "status-PENDING" },
    PAID: { text: "已付款/待處理", class: "status-PROCESSING" },
    PROCESSING: { text: "揀貨打包中", class: "status-PROCESSING" },
    SHIPPED: { text: "已發貨運輸中", class: "status-SHIPPED" },
    ARRIVED: { text: "已送達簽收", class: "status-COMPLETED" },
    CANCELLED: { text: "已取消", class: "status-CANCELLED" },
  },

  // 專業身分證字號驗證
  validateIdCard(id) {
    const idRegex = /^[A-Z][12]\d{8}$/;
    return idRegex.test(id);
  },

  /**
   * 建立集運單
   */
  async create(shipmentData) {
    if (!this.validateIdCard(shipmentData.idCardNumber)) {
      throw new Error("身分證字號格式不正確 (需首字大寫英文+9位數字)");
    }

    try {
      const res = await apiClient.post(
        "/client/shipments/create",
        shipmentData
      );
      ui.toast("集運單建立成功，請儘速完成支付", "success");
      return res.shipment;
    } catch (error) {
      ui.toast(error.message, "error");
      throw error;
    }
  },

  /**
   * 獲取附加服務清單 (從系統設定動態載入)
   */
  async getServiceItems() {
    const data = await apiClient.get("/client/settings/service-items");
    return data.items || [];
  },
};
