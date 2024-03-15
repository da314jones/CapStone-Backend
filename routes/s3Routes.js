import express from "express";
const s3 = express.Router();
import {
  uploadFile,
  downloadFile,
  deleteFile,
  listFiles,
  // generateUploadPresignedUrl,
  // generateDownloadPresignedUrl,
} from "../controllers/s3Controller.js"; // Adjusted import
import upload from "./uploadMiddleware.js";

// s3.get("/download-url/:fileName", generateDownloadPresignedUrl);

// Route to generate an upload presigned URL
// s3.post("/generate-presigned-url", generateUploadPresignedUrl);

// POST route for file upload
s3.post("/upload", upload.single("file"), uploadFile);

s3.get(
  "/download/:filename",
  (req, res, next) => {
    console.log("Downloading (uploadRoutes) file:", req.params.filename);
    next();
  },
  downloadFile
);

s3.delete(
  "/delete/:filename",
  (req, res, next) => {
    console.log("Deleting (uploadRoutes) file:", req.params.filename);
    next();
  },
  deleteFile
);

s3.get("/list", listFiles);

export default s3;
