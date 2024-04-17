import express from "express";
import { creatingSession, generatingToken, startVideoRecording, stopVideoRecording, processS3Objects, getSignedVideoUrl } from "../controller/videoController.js";
import { processVideoData } from  "../controller/vonageS3Controller.js";

const videos = express.Router();

videos.post("/session", creatingSession);

videos.get("/token/:sessionId", generatingToken);   

videos.post("/start-recording", startVideoRecording);

videos.post("/stop-recording", stopVideoRecording);

videos.post('/uploadVideo/:archiveId', processVideoData)

videos.get('/index-thumbnails/', processS3Objects);

videos.get('/getSignedUrl/*', getSignedVideoUrl)

videos.use((err, req,res, next) => {
    console.log.error(err.stack);
    res.status(500).send('Something Broke in Video Controller!');
})


export default videos;