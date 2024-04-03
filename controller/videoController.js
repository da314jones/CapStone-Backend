// videoController.js
import dotenv from "dotenv";
dotenv.config();
import fetch from "node-fetch";
import OpenTok from "opentok";
// import ffmpeg from 'fluent-ffmpeg';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs, { rmSync } from "fs";
import path from "path";
import { uploadBufferToS3 } from "./s3Controller.js";
import generateThumbnail from "../utilityServive/imageService.js"
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
  try {
    const archive = await stopAndFetchArchiveDetails(archiveId);
    const videoPath = await downloadVideo(archive.url, archiveId);
    const thumbnailPath = await generateThumbnail(videoPath, archiveId);
    const [videoS3Url, thumbnailS3Url] = await Promise.all([
      uploadFileToS3(videoPath, `videos/${archiveId}.mp4`),
      uploadFileToS3(thumbnailPath, `thumbnails/${archiveId}.png`)
    ]);
    await saveRecordingDetailsToDb({
      archiveId,
      videoUrl: videoS3Url,
      thumbnailUrl: thumbnailS3Url
    });
    // Clean up local files
    fs.unlinkSync(videoPath);
    fs.unlinkSync(thumbnailPath);
    res.json({
      message: "Recording processed successfully",
      videoUrl: videoS3Url,
      thumbnailUrl: thumbnailS3Url
    });
  } catch (error) {
    console.error("Failed to process recording:", error);
    res.status(500).json({ message: "Failed to process recording", error: error.toString() });
  }
};

// Assume `stopAndFetchArchiveDetails`, `downloadVideo`, `generateThumbnail`, `uploadFileToS3`, and `saveRecordingDetailsToDb` are defined

// Example of how you might define one of the utility functions
async function downloadVideo(url, archiveId) {
  const outputPath = path.join(__dirname, 'downloads', `${archiveId}.mp4`);
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to download video');
  await new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(outputPath);
    response.body.pipe(fileStream);
    response.body.on('error', reject);
    fileStream.on('finish', resolve);
  });
  return outputPath;
}

async function generateThumbnail(videoPath, thumbnailPath) {
  return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
          .screenshots({
              count: 1,
              folder: path.dirname(thumbnailPath),
              filename: path.basename(thumbnailPath),
              size: '320x240'
          })
          .on('end', resolve)
          .on('error', reject);
  });
}

async function uploadFileToS3(filePath, s3Key) {
  const fileStream = fs.createReadStream(filePath);
  const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
      Body: fileStream,
  };
  await s3Client.send(new PutObjectCommand(uploadParams));
  return `https://${process.env.S3_BUCKET_NAME}.s3.amazonaws.com/${s3Key}`;
}
};
}


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

const validateInputs = (archive_id, formData) => {
  if (!archive_id) throw new Error("Archive ID is required.");
  if (!formData || typeof formData !== 'object') throw new Error("Form data is invalid.");
};

 const processVideoUpload = async (req, res) => {
  const { archive_id } = req.params;
  const formData = req.body;
  
  // validate data
  validateInputs(archive_id, formData);

  try {
    //  keys and paths
    const videoKey = `videos/${archive_id}.mp4`;
    const videoPath = `./utility/${archive_id}.mp4`;
    const thumbnailKey = `thumbnails/${archive_id}.png`;
    const thumbnailPath = `./utility/${archive_id}-thumbnail.png`;

    //  uploads
    const videoUrl = await uploadToS3(videoPath, videoKey, {title: formData.title});
    const thumbnailUrl = await uploadToS3(thumbnailPath, thumbnailKey, {title: formData.title});

    await updateDatabaseWithVideoThumbnailUrl(archive_id, videoS3Key, thumbnailS3Key)
    // Update database 
    await updateVideoRecord(archive_id, {signed_url: videoUrl, thumbnail: thumbnailUrl});

    // delete local files
fs.unlinkSync(outputPath);
fs.unlinkSync(thumbnailPath);

// Response to client
res.json({
  message: 'Video processed successfully',
  videoUrl: `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${videoS3Key}`,
  thumbnailUrl: `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${thumbnailS3Key}`,
});

  } catch (error) {
    console.error('Error processing video upload:', error);
    res.status(500).send('Failed to process video upload.');
  }
};



export const updateVideoDetails = async (req, res) => {
  const { archive_id } = req.params;
  const { title, summary, is_private, signed_url } = req.body;
  
  try {
    const updatedVideo = await updateVonageVideoMetadata(archive_id, { title, summary, is_private, signed_url });
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
  processVideoUpload,
  updateVideoDetails,
  deleteVideoMetadata,
};