import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  getVideoByArchiveId,
  updateDatabaseWithVideoAndThumbnail,
} from "../queries/videos.js";

dotenv.config();

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const uploadFileToS3 = async (filePath, s3Key, metadata) => {
  const fileStream = fs.createReadStream(filePath);
  const uploadParams = {
    Bucket: process.env.BUCKET_NAME,
    Key: s3Key,
    Body: fileStream,
    Metadata: {
      title: metadata.title,
      summary: metadata.summary,
      category: metadata.category || "Default Category",
      isPrivate: metadata.is_private ? metadata.is_private.toString() : "false",
      source: metadata.source || "Unknown",
    },
  };

  try {
    const uploadResult = await s3Client.send(
      new PutObjectCommand(uploadParams)
    );
    console.log(`Successfully uploaded to S3: ${s3Key}`);
    return s3Key;
  } catch (error) {
    console.error("Error uploading to S3:", error);
    throw error;
  }
};

const deleteFile = (filePath) => {
  try {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Error deleting file:", filePath, err);
      } else {
        console.log("File deleted successfully:", filePath);
      }
    });
  } catch (error) {
    console.error("Failed to delete file:", filePath, error);
  }
};

const processVideoData = async (req, res) => {
  const { archiveId } = req.params;
  const formData = req.body;
  const videoDetails = await getVideoByArchiveId(archiveId);

  if (!videoDetails) {
    return res
      .status(404)
      .json({ message: "Video not found with archiveId: " + archiveId });
  }

  const userId = videoDetails.user_id;
  const sanitizedTitle = formData.title.replace(/[^a-zA-Z0-9-_]+/g, "-");
  const videoS3Key = `user/${userId}/${sanitizedTitle}.mp4`;
  const thumbnailS3Key = `user/${userId}/${sanitizedTitle}.png`;
  const videoFilePath = path.join("videos", `${archiveId}.mp4`);
  const thumbnailFilePath = path.join("thumbnails", `${archiveId}.png`);

  try {
    const [videoUploadResult, thumbnailUploadResult] = await Promise.all([
      uploadFileToS3(videoFilePath, videoS3Key, formData),
      uploadFileToS3(thumbnailFilePath, thumbnailS3Key, formData),
    ]);

    deleteFile(videoFilePath);
    deleteFile(thumbnailFilePath);

    const updatedRecord = await updateDatabaseWithVideoAndThumbnail(
      archiveId,
      videoS3Key,
      thumbnailS3Key,
      {
        ...formData,
        title: formData.title,
        summary: formData.summary,
        category: formData.category || "Default Category",
        is_private: formData.is_private || false,
      }
    );
    console.log({
      "DB Update:": updatedRecord,
      "Video S3 Key:": videoUploadResult,
      "Thumbnail S3 Key:": thumbnailUploadResult,
    });
    res.json({
      message: "Video and thumbnail successfully uploaded and database updated",
      data: updatedRecord,
    });
  } catch (error) {
    console.error("Error during upload or database update:", error);
    res.status(500).json({
      message: "Failed to upload video and thumbnail and update database",
      error: error.toString(),
    });
  }
};

export {
  processVideoData
};
