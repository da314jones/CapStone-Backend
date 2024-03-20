// uploadMiddleware.js
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
const fs = require('fs');
const https = require('https');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Set up storage location for multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../uploads"));
    // Temporary directory for uploads
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

// Create multer upload middleware
const upload = multer({ storage: storage });


const archiveUrl = 'ARCHIVE_VIDEO_URL';
const filePath = ''

export default upload;
