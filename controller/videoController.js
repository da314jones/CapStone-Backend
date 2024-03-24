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

export const getArchiveDetailsAndUploadToS3 = async (
  req,
  res,
  metaDataObject
) => {
  const archiveId  = req.params;
console.log(archiveId);
  const  user_id  = req.query; // Or determine userId from session, etc.

  opentok.getArchive(archiveId, async (error, archive) => {
    if (error) {
      console.error("Error retrieving archive:", error);
      return res.status(500).json({ message: "Error retrieving archive" });
    }

    if (archive.status === "available" && archive.url) {
      try {
        const response = await fetch(archive.url);
        if (!response.ok) throw new Error("Failed to download archive");
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { key, location } = await uploadBufferToS3(
          buffer,
          "video/mp4",
          metaDataObject.user_id,
          archiveId
        );

        console.log(metaDataObject.user_id, archiveId)

        const videoMetadata = {
          user_id: metaDataObject.user_id,
          category: metaDataObject.category,
          title: metaDataObject.title,
          summary: metaDataObject.summary,
          signed_url: location,
          isPrivate: metaDataObject.isPrivate || false,
          s3_key: key,
          archive_id: archiveId,
        };
        await createVideo(videoMetadata);
        res.json({
          message: "Video processed and uploaded successfully",
          location,
          s3Key: key,
        });
      } catch (uploadError) {
        console.error("Error processing video:", uploadError);
        res.status(500).json({ message: "Error processing video" });
      }
    } else {
      res
        .status(404)
        .json({ message: "Archive not available or URL not found" });
    }
  });
};

const createVideoMetadata = async (req, res, next) => {
  const metaDataObject = req.body;
  console.log(metaDataObject)
  const { user_id, category, title, archiveId } = metaDataObject;
  console.log(metaDataObject);
  try {
    console.log('Meta:', metaDataObject, 'Archive:', archiveId)
    const newVideo = await createVideo(metaDataObject);
    await getArchiveDetailsAndUploadToS3(archiveId, metaDataObject, );
    console.log("Recieved video metadata:", metaDataObject);
    return res.status(201).json(newVideo);
  } catch (error) {
    console.error("Error saving metaDataObject to database:", error);
    res.status(500).json({ message: "Error saving metaDataObject." });
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
  const { archiveId } = req.body;

  if (!archiveId) {
    return res.status(400).json({ message: 'archiveId is required' });
  }

  try {
    opentok.stopArchive(archiveId, async (error) => {
      if (error) {
        throw new Error(error.message || 'Internal Server Error');
      }

      console.log('[stopVideoRecording] Recording stopped successfully:', archiveId);

      const archive = await checkArchiveAvailability(archiveId);
      res.json({
        message: 'Recording stopped successfully',
        archiveId: archive.id,
        archiveUrl: archive.url
      });
    });
  } catch (error) {
    console.error('[stopVideoRecording] Error:', error);
    res.status(500).json({
      message: 'Failed to stop recording or fetch archive details',
      error: error.message
    });
  }
};





// const stopVideoRecording = async (req, res) => {
//   const { archiveId } = req.body;
//   console.log(
//     "[stopVideoRecording] Attempting to stop recording for archive:",
//     archiveId
//   );


//   if (!archiveId) {
//     console.error(
//       "[stopVideoRecording] No archiveId provided for stopping recording"
//     );
//     return res.status(400).json({ message: "archiveId is required" });
//   }

//   opentok.stopArchive(archiveId, async (error, archive) => {
//     if (error) {
//       console.error("[stopVideoRecording] OpenTok stopArchive error:", error);
//       return res.status(500).json({
//         message: "Failed to stop recording",
//         error: error.message || "Internal Server Error",
//       });
//     }
//     console.log(
//       "[stopVideoRecording] recording stopped successfully:",
//       archive.id
//     );
//     // res.json({
//     //   message: "Recording stopped successfully",
//     //   archiveId: archive.id,
//     // });
    
//   });
// let count = 0;
//   setInterval(() => {
//     count++;
//     opentok.getArchive(archiveId, function (err, archive) {
//       if (err) return console.log(err);
//       if (archive.url) {
//         res.json({
//           message: "Recording stopped successfully",
//           archiveId: archive.id,
//           archiveUrl: archive.url
//         });      }
//       console.log(archive);
//       if (count > 5) {
//         res.status(500).json({ message: 'Server failed to resond' })
//       }
//     });  
//   }, 1000);


  
// };


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
  getArchiveDetailsAndUploadToS3,
  updateVideoMetadata,
  deleteVideoMetadata,
};
