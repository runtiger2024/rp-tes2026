// frontend/assets/js/pages/client/index.js
import { apiClient } from "../../api/apiClient.js";

window.calculateShipping = async function () {
  const loader = document.getElementById("loading-spinner");
  const results = document.getElementById("results-container");

  loader.style.display = "block";
  results.style.display = "none";

  try {
    const formData = {
      weight: document.getElementById("input-weight").value,
      length: document.getElementById("input-length").value,
      // ...擷取其餘欄位
    };
    const data = await apiClient.post("/client/pricing/estimate", formData);

    // 渲染結果 (保持您原本 results-container 的風格)
    renderResults(data);
  } catch (e) {
    document.getElementById("error-message").innerText = e.message;
    document.getElementById("error-message").style.display = "block";
  } finally {
    loader.style.display = "none";
  }
};
