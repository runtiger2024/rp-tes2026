// frontend/client/assets/js/pages/client/shipment-flow.js
import { modalManager } from "../../core/modal-manager.js";
import { shipmentModule } from "../../modules/shipment.js";
import { userStore } from "../../store/userStore.js";

/**
 * 啟動集運下單流程
 */
window.startShipmentFlow = async function (selectedParcelIds) {
  await modalManager.open("shipment-create", (modal) => {
    // 1. 渲染包裹清單 (對接 shipment-package-list)
    renderCheckoutParcels(selectedParcelIds);

    // 2. 檢查錢包餘額並顯示支付資訊 (維持您的 UI 風格)
    const balance = userStore.state.user?.balance || 0;
    const infoBox = modal.querySelector("#wallet-pay-info");
    infoBox.style.display = "block";
    infoBox.innerText = `目前錢包餘額：NT$ ${balance.toLocaleString()}`;
  });
};

/**
 * 對接 recipient-selector.html
 */
window.openRecipientSelector = async function () {
  await modalManager.open("recipient-selector", (modal) => {
    // 這裡調用 member.controller 提供的 API 並渲染列表
    console.log("載入常用收件人列表...");
  });
};
