// frontend/assets/js/utils/ui-helper.js
export const ui = {
  toast(message, type = "info") {
    const container = document.getElementById("message-container");
    if (!container) return alert(message);

    const toast = document.createElement("div");
    toast.className = `toast toast-${type} animate__animated animate__fadeInUp`;
    toast.innerHTML = `
      <div class="toast-content">
        <i class="fas ${this.getIcon(type)}"></i>
        <span>${message}</span>
      </div>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.replace("animate__fadeInUp", "animate__fadeOutDown");
      setTimeout(() => toast.remove(), 500);
    }, 3500);
  },

  getIcon(type) {
    const icons = {
      success: "fa-check-circle",
      error: "fa-exclamation-circle",
      warning: "fa-exclamation-triangle",
    };
    return icons[type] || "fa-info-circle";
  },

  setLoading(btnElement, isLoading, originalHtml) {
    if (isLoading) {
      btnElement.disabled = true;
      btnElement.dataset.original = btnElement.innerHTML;
      btnElement.innerHTML = `<i class="fas fa-circle-notch fa-spin"></i> 處理中...`;
    } else {
      btnElement.disabled = false;
      btnElement.innerHTML = btnElement.dataset.original || originalHtml;
    }
  },
};
