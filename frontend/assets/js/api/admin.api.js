// frontend/src/api/admin.api.js
import { apiClient } from "./apiClient.js";

export const adminApi = {
  // --- 營運設定 ---
  getSettings: () => apiClient.get("/admin/ops/settings"),
  updateSettings: (data) => apiClient.post("/admin/ops/settings", data),

  // --- 附加服務 (ShipmentServiceItem) ---
  getServiceItems: () => apiClient.get("/admin/ops/service-items"),
  createServiceItem: (data) => apiClient.post("/admin/ops/service-items", data),
  deleteServiceItem: (id) =>
    apiClient.request(`/admin/ops/service-items/${id}`, { method: "DELETE" }),

  // --- 包裹管理 ---
  getParcels: (params) =>
    apiClient.get(`/admin/packages?${new URLSearchParams(params)}`),
  updateParcel: (id, formData) =>
    apiClient.upload(`/admin/packages/${id}`, formData),
  bulkDeleteParcels: (ids) =>
    apiClient.post("/admin/packages/bulk-delete", { ids }),

  // --- 集運單管理 ---
  getShipments: (params) =>
    apiClient.get(`/admin/shipments?${new URLSearchParams(params)}`),
  updateShipmentStatus: (id, status) =>
    apiClient.post(`/admin/shipments/${id}/status`, { status }),
  adjustShipmentPrice: (id, data) =>
    apiClient.post(`/admin/shipments/${id}/adjust-price`, data),

  // --- 財務與用戶 ---
  getUsers: (query) => apiClient.get(`/admin/users?search=${query}`),
  reviewDeposit: (id, action, reason) =>
    apiClient.post(`/admin/finance/deposits/${id}/review`, { action, reason }),
};
