// videoController.js
import dotenv from "dotenv";
dotenv.config();
import fetch from "node-fetch";
import OpenTok from "opentok";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import {
  getAllVideos,
  getVideoById,
  createVideo,
  updateVideo,
  deleteVideo,
} from "../queries/videos.js";

console.log("Vonage API Key XXXXXXX:", process.env.VONAGE_API_KEY);
console.log("Vonage Secret message:", process.env.VONAGE_SECRET);

const opentok = new OpenTok(
  process.env.VONAGE_API_KEY,
  process.env.VONAGE_SECRET
);

const allVideos = async (req, res) => {
  try {
    const videos = await getAllVideos();
    res.json(videos);
  } catch (error) {
    console.error("Error fetching videos c:", error);
    res.status(500).json("Error fetching videos c");
  }
};

const videoById = async (req, res) => {
  try {
    const video = await getVideoById(req.params.id);
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

const createVideoMetadata = async (req, res, next) => {
  const metaDataObject = req.body;
  try {
    const newVideo = await createVideo(metaDataObject);
    console.log("Recieved video metadata:", metaDataObject);
    return res.status(201).json(newVideo);
  } catch (error) {
    console.error("Error saving metaDataObject to database:", error);
    res.status(500).json({ message: 'Error saving metaDataObject.' })
    } 
  };

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

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

// Starts a recording. triggers a archiveID
const startVideoRecording = async (req, res) => {
  const sessionId = req.body.sessionId;
  console.log(
    "[startVideoRecording] Attempting to start recording for session:",
    sessionId
  );

  if (!sessionId) {
    console.error(
      "[startVideoRecording] No sessionId provided for starting recording"
    );
    return res.status(400).json({ message: "sessionId is required" });
  }

  opentok.startArchive(
    sessionId,
    { name: "Session Recording" },
    (error, archive) => {
      if (error) {
        console.error(
          "[startVideoRecording] OpenTok startArchive error:",
          error
        );
        return res.status(500).json({
          message: "Failed to start recording",
          error: error.message || "Internal Server Error",
        });
      }
      console.log(
        "[startVideoRecording] Archive started successfully:",
        archive.id
      );
      res.json({ archiveId: archive.id });
    }
  );
};

const stopVideoRecording = async (req, res) => {
  const { archiveId } = req.body;
  console.log(
    "[stopVideoRecording] Attempting to stop recording for archive:",
    archiveId
  );

  if (!archiveId) {
    console.error(
      "[stopVideoRecording] No archiveId provided for stopping recording"
    );
    return res.status(400).json({ message: "archiveId is required" });
  }

  opentok.stopArchive(archiveId, async (error, archive) => {
    if (error) {
      console.error("[stopVideoRecording] OpenTok stopArchive error:", error);
      return res.status(500).json({
        message: "Failed to stop recording",
        error: error.message || "Internal Server Error",
      });
    }
    console.log('[stopVideoRecording] recording stopped successfully:', archive.id);
    res.json({ message: 'Recording stopped successfully', archiveId: archive.id })
  });
};

export const getArchive = (archiveId) => {
  console.log("[getArchive] Retrieving archive details for:", archiveId);
  return new Promise((resolve, reject) => {
    opentok.getArchive(archiveId, (error, archive) => {
      if (error) {
        console.error("[getArchive] Error retrieving archive:", error);
        reject(error);
      } else {
        console.log(
          "[getArchive] Archive details retrieved successfully:",
          archive
        );
        resolve(archive);
      }
    });
  });
};


const updateVideoMetadata = async (req, res) => {
  const videoId = req.params.id;
  const { title, summary, is_private } = req.body;
  try {
    const updatedVideo = await updateVideo(videoId, { title, summary });
    if (updatedVideo) {
      res.json({ message: "Video updated successfully", updatedVideo });
    } else {
      res.status(404).json("Video not found c");
    }
  } catch (error) {
    console.error("Error updating video c", error);
    res.status(500).json("Error updating video");
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

// const listFiles = async (req, res) => {
//   const params = {
//     Bucket: process.env.BUCKET_NAME,
//   };
//   try {
//     console.log(`Listing files from S3 bucket: ${params.Bucket}`);
//     const command = new ListObjectsV2Command(params);
//     const data = await s3Client.send(command);
//     const files = data.Contents.map((file) => ({
//       name: file.Key,
//       size: file.Size,
//     }));

//     res.status(200).json(files);
//   } catch (error) {
//     console.error("Error listing files:", error);
//     res.status(500).json({ message: "Error listing files from S3" });
//   }
// };

export default {
  allVideos,
  videoById,
  createVideoMetadata,
  creatingSession,
  generatingToken,
  startVideoRecording,
  stopVideoRecording,
  // uploadVideo,
  updateVideoMetadata,
  deleteVideoMetadata,
  // listFiles,
};
