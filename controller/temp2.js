// videoController.js
import dotenv from "dotenv";
dotenv.config();
import fetch from "node-fetch";
import OpenTok from "opentok";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import { uploadBufferToS3 } from "./s3Controller.js";
import {
  getAllVideos,
  getVideoById,
  createVideo,
  updateVideo,
  deleteVideo,
} from "../queries/videos.js";

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

// const processArchiveAndUpload = async (req, res, metaDataObject) => {
//   const archiveId  = metaDataObject.archiveId;
//   console.log(archiveId);

//   try {
//     // Check archive availability
//     const archive = await checkArchiveAvailability(archiveId);
//     if (!archive || archive.status !== 'available' || !archive.url) {
//       return res.status(404).json({ message: "Archive not available or URL not found" });
//     }

//     // Download and upload to S3
//     const response = await fetch(archive.url);
//     const arrayBuffer = await response.arrayBuffer();
//     const buffer = Buffer.from(arrayBuffer);
//     const { key, location } = await uploadBufferToS3(buffer, metaDataObject);

//     metaDataObject.signed_url = location;
//     metaDataObject.s3_key = key;
//     metaDataObject.video_url = archive.url

//     // Save metadata to DB
//     // const videoMetadata = {
//     //   ...metaDataObject,
//     //   signed_url: location,
//     //   s3_key: key,
//     // };
//     const savedVideo = await createVideo(metaDataObject);

//     return { message: "Video processed and uploaded successfully", videoMetadata: savedVideo };
//   } catch (error) {
//     console.error("Error processing video:", error);
//     res.status(500).json({ message: "Error processing video" });
//   }
// };


const createVideoMetadata = async (req, res, next) => {
  const metaDataObject = req.body;
  console.log(metaDataObject)
  try {
    const video = await createVideo(metaDataObject);
    res.status(201).json({ message: "Metadata saved successfully", video });
  } catch (error) {
    console.error("Error saving metaDataObject to database:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Error saving metaDataObject." })
    };
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

const downloadArchive = async (archiveUrl, filename) => {
    const response = await fetch(archiveUrl);
    if (!response.ok) {
      throw new Error('Failed to download archive file');
    }
  
    const dest = fs.createWriteStream(`./uploads/${filename}`);
    response.body.pipe(dest);
  
    return new Promise((resolve, reject) => {
      dest.on('finish', () => resolve());
      dest.on('error', (err) => reject(err));
    });
  };


const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Recursive function to check archive availability
const checkArchiveAvailability = async (archiveId, retries = 5) => {
  if (retries === 0) {
    throw new Error('Archive not available after maximum retries');
  }

  const archive = await new Promise((resolve, reject) => {
    opentok.getArchive(archiveId, (err, archive) => {
      if (err) reject(err);
      resolve(archive);
    });
  });

  if (archive && archive.status === 'available' && archive.url) {
    return archive;
  } else {
    await delay(1000); // Wait for 1 second before retrying
    return checkArchiveAvailability(archiveId, retries - 1);
  }
};

const stopVideoRecording = async (req, res) => {
  const { archiveId, title  } = req.body;

  if (!archiveId) {
    return res.status(400).json({ message: 'archiveId is required' });
  }

  try {
    opentok.stopArchive(archiveId, async (error) => {
      if (error) {
        throw new Error(error.message || 'Internal Server Error');
      }

      console.log('[stopVideoRecording] Recording stopped successfully:', archiveId);
      resolve(archive)
      try {
      const archive = await checkArchiveAvailability(archiveId);
      await downloadArchive(archive.url, title);
      res.json({
        message: 'Recording stopped successfully',
        archiveId: archive.id,
        archiveUrl: archive.url,
      });
      if (archive && archive.status === 'available') {
          const metaDataObject = {
            archive_id: archiveId,
            video_url: archive.url, 
          }; 
      console.log({"good to go": archive.url});
      savedDetails = await saveRecordingDetailsTodDb(metaDataObject);
        } catch(error) {
            throw new Error(`Error processing archive: ${error.message`):
        }
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

export default {
  allVideos,
  videoById,
  createVideoMetadata,
  creatingSession,
  generatingToken,
  startVideoRecording,
  stopVideoRecording,
  downloadArchive,
  updateVideoMetadata,
  deleteVideoMetadata,
};
