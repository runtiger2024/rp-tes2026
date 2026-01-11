// frontend/admin/assets/js/modules/m-content.js
import { adminApi } from "../../../src/api/admin.api.js";
import { ui } from "../../utils/ui-helper.js";

export const contentModule = {
  /**
   * 更新全域費率 (整合 V16.2 邏輯)
   */
  async saveLogisticsRates() {
    const data = {
      categories: {
        general: {
          weightRate: parseFloat(
            document.getElementById("rate-gen-weight").value
          ),
          volumeRate: parseFloat(document.getElementById("rate-gen-vol").value),
        },
        // ...其餘類別
      },
    };

    try {
      await adminApi.updateSettings({ rates_config: data });
      ui.toast("費率配置已生效", "success");
    } catch (e) {
      ui.toast("儲存失敗", "error");
    }
  },

  /**
   * 測試管理員 Email (整合 V16.2)
   */
  async testEmail() {
    const btn = document.getElementById("btn-test-email");
    ui.setLoading(btn, true);
    try {
      await apiClient.post("/admin/ops/test/email");
      ui.toast("測試郵件已發送", "success");
    } catch (e) {
      ui.toast("發送失敗", "error");
    } finally {
      ui.setLoading(btn, false);
    }
  },
};
