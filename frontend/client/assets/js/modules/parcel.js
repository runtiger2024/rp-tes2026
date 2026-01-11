// frontend/client/assets/js/modules/parcel.js
import { apiClient } from "../../../api/apiClient.js";
import { ui } from "../../utils/ui-helper.js";

export const parcelModule = {
  // 電器類關鍵字 (整合自原始碼)
  ELECTRICAL_KEYWORDS: [
    "電",
    "機",
    "扇",
    "視",
    "冰箱",
    "爐",
    "燈",
    "器",
    "泵",
    "吸塵",
    "吹風",
    "烤箱",
    "微波",
    "馬桶",
  ],

  isElectrical(name) {
    return this.ELECTRICAL_KEYWORDS.some((key) => name.includes(key));
  },

  /**
   * 提交包裹預報
   */
  async forecast(formData) {
    // 業務校驗：電器類強制要求網址
    if (this.isElectrical(formData.productName) && !formData.productUrl) {
      throw new Error("偵測到電器類商品，請務必填寫購買網址以利報關。");
    }

    try {
      return await apiClient.post("/client/packages/forecast", formData);
    } catch (error) {
      ui.toast(error.message, "error");
      throw error;
    }
  },

  /**
   * 取得我的包裹列表 (含狀態過濾)
   */
  async getMyParcels(status = "ALL") {
    const endpoint =
      status === "ALL"
        ? "/client/packages"
        : `/client/packages?status=${status}`;
    const data = await apiClient.get(endpoint);
    return data.packages;
  },
};
