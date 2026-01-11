// backend/src/services/infrastructure/storage.service.js
// 優化自 upload.js
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, // 強制回傳 HTTPS 網址
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    // 確保全域唯一性與 URL 安全性，避免中文檔名亂碼
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    return {
      folder: "runpiggy-uploads",
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      public_id: uniqueSuffix,
    };
  },
});

module.exports = multer({ storage });
