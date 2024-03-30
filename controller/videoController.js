// videoController.js
import dotenv from "dotenv";
dotenv.config();
import fetch from "node-fetch";
import OpenTok from "opentok";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs, { rmSync } from "fs";
import path from "path";
import { uploadBufferToS3 } from "./s3Controller.js";
import {
  getAllVideos,
  getVideoByTitle,
  createVideo,
  createInitialVideoMetadata,
  updateForVonageVideoMetadataUpload,
  saveRecordingDetailsTodDb,
  updateVideo,
  deleteVideo,
} from "../queries/videos.js";

const opentok = new OpenTok(
  process.env.VONAGE_API_KEY,
  process.env.VONAGE_SECRET
);

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const allVideos = async (req, res) => {
  try {
    const videos = await getAllVideos();
    res.json(videos);
  } catch (error) {
    console.error("Error fetching videos c:", error);
    res.status(500).json("Error fetching videos c");
  }
};

const videoByTitle = async (req, res) => {
  try {
    const video = await getVideoByTitle(req.params.id);
    if (video) {
      res.json(video);
    } else {
      res.status(404).json("Video not found c");
    }
  } catch (error) {
    console.error("Error fetching video by id c:", error);
    res.status(500).json("Error fetching video c");
  }
};


export const creatingSession = async (req, res) => {
  opentok.createSession({ mediaMode: "routed" }, function (error, session) {
    if (error) {
      console.error("Error creating session:", error);
      return res.status(500).json("Failed to create session");
    } else {
      console.log("Session ID:", session.sessionId);
      res.json({ sessionId: session.sessionId });
    }
  });
};

export const generatingToken = async (req, res) => {
  const sessionId = req.params.sessionId;
  try {
    const token = opentok.generateToken(sessionId, {
      role: "publisher",
      expireTime: new Date().getTime() / 1000 + 7 * 24 * 60 * 60,
      data: "example_data",
    });
    console.log("Token generated:", token);
    res.json({ token });
  } catch (error) {
    console.error("Error generating token:", error);
    res.status(500).json("Failed to generate token");
  }
};

const startVideoRecording = async (req, res) => {
  const { sessionId, user_id } = req.body; 
  
  opentok.startArchive(sessionId, { name: "Session Recording" }, async (error, archive) => {
      if (error) {
        return res.status(500).json({ message: "Failed to start recording", error });
      }

      try {
          const initialMetadata = { user_id, archive_id: archive.id };
          const videoMetadata = await createInitialVideoMetadata(initialMetadata);
          console.log("[startVideoRecording] Initial video metadata created:", videoMetadata);
          res.json({ archiveId: archive.id, videoMetadata });
      } catch (dbError) {
          console.error("Error creating initial video metadata:", dbError);
          return res.status(500).json({ message: "Failed to create initial video metadata", error: dbError.message });
      }
  });
};


const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const checkArchiveAvailability = async (archive_id, retries = 5) => {
  if (retries === 0) {
    throw new Error('Archive not available after maximum retries');
  }

  const archive = await new Promise((resolve, reject) => {
    opentok.getArchive(archive_id, (err, archive) => {
      if (err) reject(err);
      resolve(archive);
    });
  });
console.log(archive)
  if (archive && archive.status === 'available' && archive.url) {
    return archive;
  } else {
    await delay(1000);
    return checkArchiveAvailability(archive_id, retries - 1);
  }
};

const getArchiveUrlFromVonage = async (videoUrl, outputPath) => {
  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch video: ${response.statusText}`);
  }
  
  await new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(outputPath);
    response.body.pipe(fileStream);
    response.body.on('error', reject);
    fileStream.on('finish', resolve);
  });
};

const stopVideoRecording = async (req, res) => {
  const { archiveId } = req.body;
  console.log(req.body)
  if (!archiveId) {
    return res.status(400).json({ message: 'archiveId is required' });
  }

  try {
    opentok.stopArchive(archiveId, async (error) => {
      if (error) {
        throw new Error(error.message || 'Internal Server Error');
      }

      console.log('[stopVideoRecording] Recording stopped successfully:', archiveId);
      try{
        const archive = await checkArchiveAvailability(archiveId);
        let savedDetails = null;
        if (archive && archive.status === 'available') {
          const metaDataObject = {
            archive_id: archiveId,
            video_url: archive.url, 
          }; 
          savedDetails = await saveRecordingDetailsTodDb(metaDataObject);
        };
        const outputPath = `./utility/${archiveId}.mp4`;
        await getArchiveUrlFromVonage(archive.url, outputPath);
        console.log(`Video downloaded to local:, ${outputPath}`)
        console.log("saveRecordingDetails waiting for results:", archiveId);
      res.json({
        message: 'Recording stopped and metadata updated',savedDetails, downloadPath: outputPath 
      });
    } catch (error) {
      throw new Error(`Error processing archive: ${error.message}`)
    }
    });
  } catch (error) {
    console.error('[stopVideoRecording] Error:', error);
    res.status(500).json({
      message: 'Failed to stop recording or fetch archive details',
      error: error.message
    });
  }
};


const downloadArchive = async (archiveUrl, filename) => {
  const response = await fetch(archiveUrl);
  if (!response.ok) {
    throw new Error('Failed to download archive file');
  }

  const dest = fs.createWriteStream(`./utility/${filename}`);
  response.body.pipe(dest);

  return new Promise((resolve, reject) => {
    dest.on('finish', () => resolve());
    dest.on('error', (err) => reject(err));
  });
};


export const updateVideoDetails = async (req, res) => {
  const { archive_id } = req.params;
  const { title, summary, is_private, video_url } = req.body;
  
  try {
    const updatedVideo = await updateVonageVideoMetadata(archive_id, { title, summary, is_private, video_url });
    res.json(updatedVideo);
  } catch (error) {
    res.status(500).json({ message: "Failed to update video metadata", error });
  }
};


const deleteVideoMetadata = async (req, res) => {
  const videoId = req.params.id;
  try {
    const deletedVideo = await deleteVideo(videoId);
    if (deletedVideo) {
      res.json({ message: "Video deleted successfully", video: deletedVideo });
    } else {
      res.status(404).json("Video not found c");
    }
  } catch (error) {
    console.error("Error deleting video c:", error);
    res.status(500).json("Error deleting video c");
  }
};

export default {
  allVideos,
  videoByTitle,
  creatingSession,
  generatingToken,
  startVideoRecording,
  stopVideoRecording,
  downloadArchive,
  updateVideoDetails,
  deleteVideoMetadata,
};