/**
 * response.wrapper.js - V2026.01.Final
 * 統一後端回傳格式工具
 */

export const ResponseWrapper = {
  /**
   * 成功回傳 (Success)
   * @param {Object} res - Express Response 對象
   * @param {any} data - 欲回傳的資料內容
   * @param {string} message - 提示訊息 (選填)
   * @param {number} status - HTTP 狀態碼 (預設 200)
   */
  success(res, data = null, message = "Operation successful", status = 200) {
    return res.status(status).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * 錯誤回傳 (Error)
   * @param {Object} res - Express Response 對象
   * @param {string} message - 錯誤訊息
   * @param {number} status - HTTP 狀態碼 (預設 400)
   * @param {string} errorCode - 自定義錯誤代碼 (選填)
   */
  error(
    res,
    message = "An error occurred",
    status = 400,
    errorCode = "INTERNAL_ERROR"
  ) {
    return res.status(status).json({
      success: false,
      message,
      errorCode,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * 分頁專用回傳 (Pagination)
   */
  paginate(res, items, total, page, limit, message = "Fetched successfully") {
    return res.status(200).json({
      success: true,
      message,
      data: items,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
      timestamp: new Date().toISOString(),
    });
  },
};
