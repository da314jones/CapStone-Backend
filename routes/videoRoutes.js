import express from "express";
import videoController from "../controller/videoController.js";
const videos = express.Router();

videos.post("/session", videoController.creatingSession);

videos.get("/token/:sessionId", videoController.generatingToken);

videos.post("/video-metadata/", videoController.createVideoMetadata);

videos.post("/start-recording", videoController.startVideoRecording);

videos.post("/stop-recording", videoController.stopVideoRecording);

videos.post("/upload-recording", videoController.uploadVideo);

// videos.get ('/list', videoController.listFiles)

export default videos;
