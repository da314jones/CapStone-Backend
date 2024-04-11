import express from "express";
import videoController from "../controller/videoController.js";
import {processVideoData} from  "../controller/vonageS3Controller.js";
const videos = express.Router();

videos.post("/session", videoController.creatingSession);

videos.get("/token/:sessionId", videoController.generatingToken);

videos.post("/start-recording", videoController.startVideoRecording);

videos.post("/stop-recording", videoController.stopVideoRecording);

videos.post('/uploadVideo/:archiveId', processVideoData)

videos.get('/index', videoController.allVideos)

export default videos;


