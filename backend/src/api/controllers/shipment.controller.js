// backend/src/api/controllers/shipment.controller.js
const shipmentService = require("../../services/logistics/shipment.service");

exports.create = async (req, res) => {
  try {
    const { idCardNumber } = req.body;

    // 專業身分證校驗
    const idRegex = /^[A-Z][12]\d{8}$/;
    if (!idRegex.test(idCardNumber)) {
      return res
        .status(400)
        .json({ success: false, message: "身分證格式錯誤" });
    }

    const shipment = await shipmentService.createShipment(
      req.user.id,
      req.body
    );
    res.status(201).json({ success: true, shipment });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
