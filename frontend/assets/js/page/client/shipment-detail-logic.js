// frontend/assets/js/pages/client/shipment-detail-logic.js
import { modalManager } from "../../core/modal-manager.js";
import { walletModule } from "../../modules/wallet.js";

/**
 * 打開集運單詳情 (對接 shipment-details.html)
 */
window.openShipmentFullDetails = async function (shipmentId) {
  await modalManager.open("shipment-details", (modal) => {
    // 1. 抓取遠端詳細數據
    apiClient.get(`/client/shipments/${shipmentId}`).then((res) => {
      const s = res.shipment;

      // 2. 填充基本資訊 (使用您的 ID 命名規範)
      document.getElementById("sd-id").innerText = s.shipmentNo;
      document.getElementById("sd-status").innerText = s.status;
      document.getElementById(
        "sd-total-cost"
      ).innerText = `NT$ ${s.finalAmount.toLocaleString()}`;

      // 3. 處理憑證照片 (解決破圖核心邏輯)
      const proofImg = modal.querySelector("#sd-payment-proof-img");
      if (s.paymentProof) {
        proofImg.src = walletModule.formatImageUrl(s.paymentProof);
        proofImg.style.display = "block";
      }

      // 4. 渲染包裹明細表 (符合您的 receipt-style 表格)
      renderShipmentItems(s.packages);
    });
  });
};
