// frontend/admin/assets/js/modules/m-logistics.js
import { adminApi } from "../../../src/api/admin.api.js";
import { ui } from "../../utils/ui-helper.js";

export const logisticsModule = {
  /**
   * 渲染包裹列表
   * 整合 Cloudinary 路徑修復與狀態標籤
   */
  renderParcelTable(container, parcels) {
    container.innerHTML = parcels
      .map(
        (pkg) => `
      <tr class="parcel-row">
        <td><input type="checkbox" class="pkg-select" data-id="${pkg.id}"></td>
        <td><span class="badge-id">${pkg.trackingNumber}</span></td>
        <td>${pkg.user?.name || "無主"} <br><small>${
          pkg.user?.piggyId || ""
        }</small></td>
        <td>${pkg.status}</td>
        <td>${pkg.weight || 0} kg / ${pkg.volumeCai || 0} 才</td>
        <td>
          <button class="btn-action" onclick="openParcelModal('${
            pkg.id
          }')"><i class="fas fa-edit"></i></button>
        </td>
      </tr>
    `
      )
      .join("");
  },

  /**
   * 執行批量刪除 (含安全核對)
   */
  async bulkDelete(selectedIds) {
    if (!selectedIds.length) return;
    const confirm = prompt("此操作無法復原，請輸入 'DELETE' 以確認：");
    if (confirm !== "DELETE") return;

    try {
      await adminApi.bulkDeleteParcels(selectedIds);
      ui.toast(`成功刪除 ${selectedIds.length} 筆包裹`, "success");
      return true;
    } catch (e) {
      ui.toast(e.message, "error");
    }
  },
};
