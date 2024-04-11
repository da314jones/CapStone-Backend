import express from "express";
const s3 = express.Router();
import {
  uploadFile,
  downloadFile,
  deleteFile,
  listFiles
} from "../controller/s3Controller.js"; 
import upload from "./uploadMiddleware.js";



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

s3.use((err, req, res, next) => {
  console.log.error(err.stack);
  res.status(500).send('Something broke in S3 Controller!');
})

export default s3;
