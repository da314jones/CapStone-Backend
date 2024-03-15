import express from "express";
import cors from "cors";
import morgan from "morgan";
import admin from "firebase-admin";
// import { initializeApp } from "firebase-admin/app";
import { S3Client } from "@aws-sdk/client-s3";

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const app = express();

app.use(morgan("dev"));
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Welcome to CapStone!");
});

// Added for the S3 upload route
import s3Routes from "./routes/s3Routes.js";
import users from "./controllers/usersControllers.js";
import videoRoutes from "./routes/videoRoutes.js";

app.use("/s3", s3Routes);
app.use("/users", users);
app.use("/videos", videoRoutes);

app.get("*", (req, res) => {
  res
    .status(404)
    .json({ success: false, data: { error: "Page is not found!" } });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  if (!res.headersSent) {
    next(err);
  }
  res
    .status(500)
    .json({ success: false, data: { error: "Internal Server Error" } });
});

export default app;
