import express from "express";
import videoController from "../controller/videoController.js";
const videos = express.Router();

videos.post("/session", videoController.creatingSession);

videos.get("/token/:sessionId", videoController.generatingToken);

videos.post("/video-metadata/", videoController.createVideoMetadata);

videos.post("/start-recording", videoController.startVideoRecording);

videos.post("/stop-recording", videoController.stopVideoRecording);

// In your videoRoutes.js or wherever you define routes
videos.get('/archive/:archiveId', videoController.getArchiveDetailsAndUploadToS3);


export default videos;
