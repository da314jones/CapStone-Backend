import express from "express";
import videoController from "../controller/videoController.js";
import vonageS3Controller from  "../controller/vonageS3Controller.js";
const videos = express.Router();

videos.post("/session", videoController.creatingSession);

videos.get("/token/:sessionId", videoController.generatingToken);

videos.post("/start-recording", videoController.startVideoRecording);

videos.post("/stop-recording", videoController.stopVideoRecording);

videos.post("/download-archive", videoController.downloadArchive);

videos.post('/uploadVideo/:archiveId', vonageS3Controller.processVideoData)

// videos.post("/webhook/vonage", vonageS3Controller.downloadAndUploadArchive);

export default videos;

