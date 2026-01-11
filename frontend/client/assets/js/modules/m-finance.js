// frontend/admin/assets/js/modules/m-finance.js
import { adminApi } from "../../../src/api/admin.api.js";
import { ui } from "../../utils/ui-helper.js";

export const financeModule = {
  /**
   * 運單改價與稽核 (Audit Logic)
   */
  async adjustPrice(shipmentId, newAmount, reason) {
    try {
      const res = await adminApi.adjustShipmentPrice(shipmentId, {
        newAmount,
        reason,
      });
      ui.toast(`改價成功！已自動處理錢包對沖`, "success");
      return res;
    } catch (e) {
      ui.toast("改價失敗：" + e.message, "error");
    }
  },

  /**
   * 審核儲值憑證
   */
  async handleDepositReview(id, isApprove, reason = "") {
    try {
      const action = isApprove ? "APPROVE" : "REJECT";
      await adminApi.reviewDeposit(id, action, reason);
      ui.toast(isApprove ? "已核准並入帳" : "已駁回申請", "success");
      return true;
    } catch (e) {
      ui.toast(e.message, "error");
    }
  },
};
