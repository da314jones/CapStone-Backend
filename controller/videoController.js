import dotenv from "dotenv";
dotenv.config();
import fetch from "node-fetch";
import OpenTok from "opentok";
import fs, { rmSync } from "fs";
import path from "path";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand
} from "@aws-sdk/client-s3";
import { generateThumbnail } from "../utilityService/imageService.js";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
// import { parseUrl } from "@smithy/url-parser";
// import { formatUrl } from "@aws-sdk/util-format-url";
// import { Hash } from "@smithy/hash-node";
// import https from "https";
// import { fromIni } from "@aws-sdk/credential-providers";
// import { HttpRequest } from "@smithy/protocol-http";
import {
  createVideoEntry,
  checkAndInsertUser,
  insertVideoMetadata,
  getAllVideos,
} from "../queries/videos.js";

const videoPath = process.env.VIDEO_PATH;
const thumbnailPath = process.env.THUMBNAIL_PATH;

if (!videoPath || !thumbnailPath) {
  console.error(
    "FilePaths are not defined. Please check your environment variables."
  );
  process.exit(1); 
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
const BUCKET_NAME = process.env.BUCKET_NAME

export const creatingSession = async (req, res) => {
  try {
    opentok.createSession({ mediaMode: "routed" }, function (error, session) {
      if (error) {
        console.error("Error creating session:", error);
        return res.status(500).json("Failed to create session");
      } else {
        console.log("Session ID:", session.sessionId);
        res.json({ sessionId: session.sessionId });
      }
    });
  } catch (error) {
    console.error('Error creating session:', error);
    return res.status(500).json('Failed to create session');
  }
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

export const startVideoRecording = async (req, res) => {
  const { sessionId, user_id } = req.body;

  if (!sessionId || !user_id) {
    return res
      .status(400)
      .json({ error: "Both sessionId and user_id are required." });
  }

  // Additional debug
  console.log("Received for recording:", { sessionId, user_id });

  try {
    opentok.startArchive(
      sessionId,
      { name: "Session Recording" },
      async (error, archive) => {
        if (error) {
          console.error("Failed to start recording:", error);
          return res
            .status(500)
            .json({
              message: "Failed to start recording",
              error: error.message,
            });
        }
        console.log("Recording started:", archive);
        try {
          const createdVideo = await createVideoEntry(user_id, archive.id);
          res.status(201).json({
            message: "Recording started and video entry created successfully.",
            archiveId: archive.id,
            videoDetails: createdVideo,
          });
        } catch (dbError) {
          console.error("Error creating video entry:", dbError);
          res
            .status(500)
            .json({
              message: "Failed to create video entry",
              error: dbError.message,
            });
        }
      }
    );
  } catch (generalError) {
    console.error("Error in starting recording process:", generalError);
    res
      .status(500)
      .json({
        message: "An error occurred in the recording process",
        error: generalError.message,
      });
  }
};

const downloadArchive = async (archiveUrl, archiveId) => {
  const filename = `${archiveId}.mp4`;
  const directory = "./videos/";
  const filePath = directory + filename;

  try {
    await fs.promises.mkdir(directory, { recursive: true });
  } catch (err) {
    if (err.code !== "EEXIST") {
      throw err;
    }
  }

  try {
    const response = await fetch(archiveUrl);
    if (!response.ok) {
      throw new Error("Failed to download archive file");
    }

    const dest = fs.createWriteStream(filePath);
    response.body.pipe(dest);

    return new Promise((resolve, reject) => {
      dest.on("finish", () => {
        console.log(`Download complete: ${filePath}`);
        resolve(filePath);
      });
      dest.on("error", (err) => {
        console.error(`Error writing file to: ${filePath}`, err);
        reject(err);
      });
    });
  } catch (error) {
    console.error("Error downloading archive:", error);
    throw error;
  }
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const checkArchiveAvailability = async (archiveId, retries = 10) => {
  if (retries === 0) {
    throw new Error("Archive not available after maximum retries");
  }

  const archive = await new Promise((resolve, reject) => {
    opentok.getArchive(archiveId, (err, archive) => {
      if (err) reject(err);
      resolve(archive);
    });
  });
  console.log(archive);
  if (archive && archive.status === "available" && archive.url) {
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
  return [response, videoFile];
};

export const stopVideoRecording = async (req, res) => {
  const { archiveId, user_id } = req.body;
  try {
      const archive = await new Promise((resolve, reject) => {
          opentok.stopArchive(archiveId, (error, archive) => {
              if (error) {
                  reject(new Error(error.message || "Internal Server Error"));
              } else {
                  resolve(archive);
              }
          });
      });
      const [response, videoPath] = await getArchiveUrlAndSaveVideo(archiveId);
      const thumbnailPath = await generateThumbnail(videoPath, archiveId);
      res.json({
          message: "Recording and thumbnail processed successfully",
          details: { videoPath, thumbnailPath, archiveId },
      });
  } catch (error) {
      console.error("Failed to stop recording:", error);
      res
          .status(500)
          .json({ message: "Failed to stop recording", error: error.toString() });
  }
};

export async function processS3Objects(req, res) {
    try {
        const listParams = { Bucket: BUCKET_NAME };
        const listData = await s3Client.send(new ListObjectsV2Command(listParams));
        const thumbnailImage = [];

        for (const object of listData.Contents) {
            const headParams = { Bucket: BUCKET_NAME, Key: object.Key };
            const metaData = await s3Client.send(new HeadObjectCommand(headParams));
            const metadataContent = metaData.Metadata;

            if (metadataContent && metadataContent.user) {
                const userData = JSON.parse(metadataContent.user);
                await checkAndInsertUser(metadataContent.user);
                const videoData = {
                    user_id: userData.user_id,
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    email: userData.email,
                    photo_url: userData.photo_url,
                    created_at: userData.created_at,
                    category: metadataContent.category,
                    title: metadataContent.title,
                    summary: metadataContent.summary,
                    isPrivate: metadataContent.isprivate,
                    source: metadataContent.source,
                    s3_key: object.Key,
                    thumbnail_key: object.Key.replace('.mp4', '.png')
                };
                await insertVideoMetadata(videoData);
                const thumbnailUrl = await getSignedUrl(s3Client, new GetObjectCommand({ Bucket: BUCKET_NAME, Key: videoData.thumbnail_key }), { expiresIn: 86400 });

                  thumbnailImage.push({
                    ...videoData,
                    // videoUrl,
                    thumbnailUrl

                });
            }
        }

        res.json({ thumbnailImage });        
    } catch (error) {
        console.error("Error processing S3 objects:", error);
        res.status(500).json({ message: "Failed to process S3 objects", error: error.toString() });
    }
};

export const getSignedVideoUrl = async (req, res) => {
  const thumbanilDestructured = req.body.thumbnail;
  
  if (!thumbanilDestructured) {
    return res.status(400).json({ error: "thumbnail key is required." });
  }

  try {
    const videoKey = new URL(thumbanilDestructured);
    const signedUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: videoKey
      }),
      { expiresIn: 3600 }
    );

    console.log("Signed URL:", signedUrl);
    res.status(200).json({
      message: "Video signed Url sucessfully generated:", 
      signedUrl: signedUrl
    }) ;
  } catch (error) {
    console.error("Error generating signed URL:", error);
    res.status(500).json({ message: "Failed to generate signed URL", error: error.toString() });
  }
};
// try {
//   const req = {}; 
//   const res = {};
//   const signedUrl = await getSignedVideoUrl(req, res);
//   console.log("Signed URL:", signedUrl);
// } catch (error) {
//   console.error("Failed to retrieve signed URL:", error);
// }


export const retrieveSignedVideoUrl = async (req, res) => {
  const { videoKey } = req.body;

  if (!videoKey) {
    return res.status(400).json({ error: "Video key is required in the request body." });
  }

  try {
    const signedUrl = await getSignedUrl(
      s3Client,
      new GetObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: videoKey
      }),
      { expiresIn: 3600 } 
    );

    console.log("Signed URL generated:", signedUrl);
    return res.json({ signedUrl });
  } catch (error) {
    console.error("Error generating signed URL:", error);
    res.status(500).json({ message: "Failed to generate signed URL", error: error.toString() });
  }
};















export const allVideos = async (req, res) => {
  try {
    const videos = await getAllVideos();
    const videoData = await Promise.all(
      videos.map(async (video) => {
        const videoSignedUrl = await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.BUCKET_NAME,
            Key: video.s3_key,
          }),
          { expiresIn: 86400 }
        );

        const thumbnailSignedUrl = await getSignedUrl(
          s3Client,
          new GetObjectCommand({
            Bucket: process.env.BUCKET_NAME,
            Key: video.thumbnail_key,
          }),
          { expiresIn: 86400 }
        );

        return {
          ...video,
          videoUrl: videoSignedUrl,
          thumbnailUrl: thumbnailSignedUrl,
        };
      })
    );
    res.json({ videoWithSignedUrls: videoData });
  } catch (error) {
    console.error("Error fetching videos:", error);
    res
      .status(500)
      .json({ message: "Error fetching videos", error: error.toString() });
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


export default {
  allVideos,
  videoByTitle,
  creatingSession,
  generatingToken,
  startVideoRecording,
  processS3Objects,
  getSignedVideoUrl,
  // signedVideoUrl,
  downloadArchive,
  stopVideoRecording,
};
