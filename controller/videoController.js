// videoController.js
import dotenv from "dotenv";
dotenv.config();
import fetch from "node-fetch";
import OpenTok from "opentok";
import fs from "fs";
import path from "path";
import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "aws-sdk/s3-request-presigner";
import { generateThumbnail } from "../utilityService/imageService.js"
import {
  createVideoEntry,
  getAllVideos,
  getVideoByTitle,
  getaAllvideos,
  createInitialVideoMetadata,
  updateForVonageVideoMetadataUpload,
  getVideoMetadata,
  updateVideoRecord,
  deleteVideo,
  getVideoByArchiveId,
} from "../queries/videos.js";



// Confirm that these paths are logged and correctly defined
const videoPath = process.env.VIDEO_PATH;
const thumbnailPath = process.env.THUMBNAIL_PATH;

if (!videoPath || !thumbnailPath) {
  console.error("Base paths are not defined. Please check your environment variables.");
  process.exit(1); // Stop execution if paths are not defined
}

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


// const videoByTitle = async (req, res) => {
//   try {
//     const video = await getVideoByTitle(req.params.id);
//     if (video) {
//       const videoUrl = await getSignedUrl(s3Client, new GetObjectCommand({
//         Bucket: process.env.BUCKET_NAME,
//         Key: video.s3_key
//       }), { expiresIn: 3600 });

//       const thumbnailUrl = await getSignedUrl(s3Client, new GetObjectCommand({
//         Bucket: process.env.BUCKET_NAME,
//         Key: video.thumbnail_key
//       }), { expiresIn: 3600 });

//       res.json({ ...video, videoUrl, thumbnailUrl });
//     } else {
//       res.status(404).json({ message: "Video not found" });
//     }
//   } catch (error) {
//     console.error("Error fetching video by title:", error);
//     res.status(500).json({ message: "Error fetching video", error: error.toString() });
//   }
// };


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

  if (!sessionId || !user_id) {
      return res.status(400).json({ error: "Both sessionId and user_id are required." });
  }

  try {
    opentok.startArchive(sessionId, { name: "Session Recording" }, async (error, archive) => {
        if (error) {
            console.error("Failed to start recording:", error);
            return res.status(500).json({ message: "Failed to start recording", error: error.message });
        }

        // Create a video entry with the received archiveId and userId
        try {
            const createdVideo = await createVideoEntry(user_id, archive.id);
            res.status(201).json({
                message: "Recording started and video entry created successfully.",
                archiveId: archive.id,
                videoDetails: createdVideo
            });
        } catch (dbError) {
            console.error("Error creating video entry:", dbError);
            res.status(500).json({ message: "Failed to create video entry", error: dbError.message });
        }
    });
  } catch (generalError) {
    console.error("Error in starting recording process:", generalError);
    res.status(500).json({ message: "An error occurred in the recording process", error: generalError.message });
  }
};



const downloadArchive = async (archiveUrl, archiveId) => {
  const filename = `${archiveId}.mp4`;
  const filePath = '/Users/djones/Desktop/working-repository/10.2/MODULE_6_CAPSTONE/Tidbits/CapStone-Backend/videos/' + filename;
  
  // Check if the directory exists, create if not
  const directory = '/Users/djones/Desktop/working-repository/10.2/MODULE_6_CAPSTONE/Tidbits/CapStone-Backend/videos';
  
  try {
    await fs.promises.mkdir(directory, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw err; // throws error if directory creation failed for any reason other than already existing
    }
  }

  try {
    const response = await fetch(archiveUrl);
    if (!response.ok) {
      throw new Error('Failed to download archive file');
    }
    
    const dest = fs.createWriteStream(filePath);
    response.body.pipe(dest);

    return new Promise((resolve, reject) => {
      dest.on('finish', () => {
        console.log(`Download complete: ${filePath}`);
        resolve(filePath);
      });
      dest.on('error', (err) => {
        console.error(`Error writing file to: ${filePath}`, err);
        reject(err);
      });
    });
  } catch (error) {
    console.error('Error downloading archive:', error);
    throw error;
  }
};


const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const checkArchiveAvailability = async (archiveId, retries = 10) => {
  if (retries === 0) {
    throw new Error('Archive not available after maximum retries');
  }

  const archive = await new Promise((resolve, reject) => {
    opentok.getArchive(archiveId, (err, archive) => {
      if (err) reject(err);
      resolve(archive);
    });
  });
console.log(archive)
  if (archive && archive.status === 'available' && archive.url) {
    return archive;
  } else {
    await delay(1000);
    return checkArchiveAvailability(archiveId, retries - 1);
  }
};


const getArchiveUrlAndSaveVideo = async (archiveId) => {
  const response = await checkArchiveAvailability(archiveId);
  if (!response.status) {
    throw new Error(`Failed to fetch video: ${response.statusText}`);
  }  
  const videoFile = await downloadArchive(response.url, archiveId);
  return [response, videoFile]
};


const stopVideoRecording = async (req, res) => {
  const { archiveId, user_id } = req.body;
  try {
    const archive = await new Promise((resolve, reject) => {
      opentok.stopArchive(archiveId, (error, archive) => {
        if (error) {
          reject(new Error(error.message || 'Internal Server Error'));
        } else {
          resolve(archive);
        }
      });
    });
    const [response, videoPath] = await getArchiveUrlAndSaveVideo(archiveId);
    const thumbnailPath = await generateThumbnail(videoPath, archiveId);
    res.json({
      message: 'Recording and thumbnail processed successfully',
      details: { videoPath, thumbnailPath, archiveId }
    });
  } catch (error) {
    console.error('Failed to stop recording:', error);
    res.status(500).json({ message: 'Failed to stop recording', error: error.toString() });
  }
};


async function generatePresignedUrl() {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: process.env.AWS_SECRET_ACCESS_KEY
    });
      const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      console.log("Presigned URL:", url);
      return url;
  } catch (error) {
      console.error("Error generating presigned URL:", error);
  }
}

generatePresignedUrl();

export const allVideos = async (req, res) => {
  try {
    const videos = await getAllVideos();
    const videoData = await Promise.all(videos.map(async (video) => {
      const videoSignedUrl = await getSignedUrl(s3Client, new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: video.s3_key
      }), { expiresIn: 3600 });

      const thumbnailSignedUrl = await getSignedUrl(s3Client, new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: video.thumbnail_key
      }), { expiresIn: 3600 });

      return {
        ...video,
        videoUrl: videoSignedUrl,
        thumbnailUrl: thumbnailSignedUrl
      };
    }));
    res.json({ videoWithSignedUrls: videoData });
  } catch (error) {
    console.error("Error fetching videos:", error);
    res.status(500).json({ message: "Error fetching videos", error: error.toString() });
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

// export const videoWithMetadataObject = async (req, res) => {
//   try {
//     const videos = await getAllVideos();
//     const videoData = await Promise.all(videos.map(async (video) => {
//       const videoUrl = await getSignedUrl(s3Client, new GetObjectCommand({
//         Bucket: process.env.BUCKET_NAME,
//         Key: videothumbnail_key
//       }), { expiresIn: 3600 });
//       return {
//         title: video.title,
//         videoUrl,
//         duration: video.duration,
//         views: video.views
//       };
//     }));
//     res.json({ videoWithSignedUrls: videoData });
//   } catch (error) {
//     console.error('Failed to list videos:', error);
//     res.status(500).json({ message: 'Failed to retrieve videos', error: error.toString() });
//   }
// };





  
  


// export const updateVideoDetails = async (req, res) => {
//   const { archiveId } = req.params;
//   const { title, summary, is_private, signed_url } = req.body;
  
//   try {
//     const updatedVideo = await updateVonageVideoMetadata(archiveId, { title, summary, is_private, signed_url });
//     res.json(updatedVideo);
//   } catch (error) {
//     res.status(500).json({ message: "Failed to update video metadata", error });
//   }
// };

// const deleteVideoMetadata = async (req, res) => {
//   const videoId = req.params.id;
//   try {
//     const deletedVideo = await deleteVideo(videoId);
//     if (deletedVideo) {
//       res.json({ message: "Video deleted successfully", video: deletedVideo });
//     } else {
//       res.status(404).json("Video not found c");
//     }
//   } catch (error) {
//     console.error("Error deleting video c:", error);
//     res.status(500).json("Error deleting video c");
//   }
// };

export default {
  allVideos,
  videoByTitle,
  creatingSession,
  generatingToken,
  startVideoRecording,
  stopVideoRecording,
  videoWithMetadataObject,
  downloadArchive,
  updateVideoDetails,
  deleteVideoMetadata,
};