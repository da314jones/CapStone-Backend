// vonageS3Controller.js
import dotenv from "dotenv";
dotenv.config();
import fetch from "node-fetch";
import OpenTok from "opentok";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";import { createVideo, saveRecordingDetails } from "../queries/videos.js";


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

const getArchiveUrlFromVonage = async (archiveId) => {
    return new Promise((resolve, reject) => {
        opentok.getArchive(archiveId, (error, archive) => {
            if (error) {
                console.error(`Failed to get archive ${archiveId}:`, error);
                reject(error);
            } else {
                resolve(archive.url);
            }
        });
    });
};


const downloadAndUploadArchive = async (archive_id, user_id, metadata) => {
  try {
    const archiveUrl = await getArchiveUrlFromVonage(archive_id);
    const videoBuffer = await fetch(archiveUrl).then(res => res.buffer());

    const s3Key = `archives/${user_id}/${Date.now()}-${metadata.title}.mp4`;
    const params = {
      Bucket: process.env.BUCKET_NAME,
      Key: s3Key,
      Body: videoBuffer,
      Metadata: {
        title: metadata.title,
        summary: metadata.summary,
      }
    };

    // Upload to S3
    await s3Client.send(new PutObjectCommand(params));

    await createVideo({
      user_id: user_id,
      title: metadata.title,
      summary: metadata.summary,
      category: metadata.category,
      video_url: `https://${params.Bucket}.s3.amazonaws.com/${params.Key}`,
      is_private: metadata.is_private,
      s3_key: s3Key,
      source: "Vonage",
    });

    console.log("Video processed and uploaded successfully");
  } catch (error) {
    console.error("Error in downloading/uploading archive:", error);
  }
};


export default {
    downloadAndUploadArchive
}