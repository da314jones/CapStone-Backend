import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  getAllVideos,
  getVideoByTitle,
  createVideo,
  updateVideo,
  deleteVideo,
} from "../queries/videos.js";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();



// AWS SDK Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});



export const uploadBufferToS3 = async (buffer, metaDataObject) => {
  const { user_id, title, ...rest }  = metaDataObject;
  const fileName = `${title}.mp4`;
  const s3Key = `users/${user_id}/${fileName}`
  const params = {
    Bucket: process.env.BUCKET_NAME,
    Key: s3Key,
    Body: buffer,
    ContentType: 'video/mp4',
    Metdata: rest,
  };

  try {
    const command = new PutObjectCommand(params);
    const response = await s3Client.send(command);

    const fileUrl = `https://${params.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
    console.log('Archive successfully uploaded to S3:')
    return { key: s3Key, location: fileUrl }; // Return key and location
  } catch (error) {
    console.error("Error uploading buffer to S3:", error);
    throw error;
  }
};


const uploadFile = async (req, res) => {
  const { file } = req;
  const metaDataObject = req.body;
  if (!metaDataObject.user_id) {
    return res.status(400).json({ message: "user_id is required" });
  }
  const user_id = req.body.user_id;
  const title = req.body.title || "Untitled";
  const summary = req.body.summary || "";
  const isPrivate = req.body.isPrivate === "true";
  const duration = parseInt(req.body.duration) || 0;

  const fileStream = fs.createReadStream(file.path);

  const params = {
    Bucket: process.env.BUCKET_NAME,
    Key: `users/${user_id}/${file.originalname}`,
    Body: fileStream,
    ContentType: file.mimetype,
    Metadata: {
      user_id: user_id.toString(),
    }, 
  };

  try {
    const command = new PutObjectCommand(params);
    await s3Client.send(command);
    const fileUrl = `https://${params.Bucket}.s3.${
      process.env.AWS_REGION
    }.amazonaws.com/${encodeURIComponent(params.Key)}`;
    const video = await createVideo({
      user_id,
      title: req.body.title || "Untitled",
      summary: req.body.summary || "",
      video_url: fileUrl,
      isPrivate: req.body.isPrivate || false,
      duration: req.body.duration || 0,
    });
    const newVideo = await createVideo(video);

    fs.unlink(file.path, (err) => {
      if (err) {
        console.error("Failed to delete temporary file:", err);
      }
    });
    if (req.file) {
      console.log("Uploading file:", req.file.originalname);
      res.status(200).json({
        message: "Video uploaded successfully",
        url: fileUrl,
        user_id,
        file: req.file.originalname,
      });
    } else {
      res.status(400).json({ message: "No File uploaded" });
    }
  } catch (err) {
    console.error("Error uploading file:", err);
    res.status(500).send(err.message || "Internal Server Error");
  }
};

const downloadFile = async (req, res) => {
  console.log("Controller: downloadFile called for", req.params.filename);
  const { filename, title } = req.params;
  const newFileName = `${title}`.mp4
  const params = {
    Bucket: process.env.BUCKET_NAME,
    Key: req.params.filename,
  };

  try {
    console.log(
      `Downloading (s3 controller) ${req.params.filename} from S3 bucket: ${params.Bucket}`
    );
    const command = new GetObjectCommand(params);
    const { Body, ContentType } = await s3Client.send(command);
    console.log(`Successfully downloaded ${params.Key}`);

    res.set("Content-Type", ContentType);
    res.set("Content-Dispostion", `attachment; filename="${newFileName}"`)
    Body.pipe(res);
  } catch (error) {
    console.error("Error downloading file:", error);
    res.status(500).send("Internal Server Error");
  }
};

const deleteFile = async (req, res) => {
  console.log("Controller: deleteFile called for", req.params.filename);
  const params = {
    Bucket: process.env.BUCKET_NAME,
    Key: req.params.filename,
  };

  try {
    console.log(
      `Deleting (s3 controller) ${req.params.filename} from S3 bucket: ${params.Bucket}`
    );
    await s3Client.send(new DeleteObjectCommand(params));
    console.log(`Successfully deleted ${params.Key}`);

    res.status(200).send("File deleted successfully.");
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).send("Internal Server Error");
  }
};

const listFiles = async (req, res) => {
  const params = {
    Bucket: process.env.BUCKET_NAME,
  };
  try {
    const command = new ListObjectsV2Command(params);
    const s3Data = await s3Client.send(command);
    const videosFromDb = await getAllVideos();
    
    const videoWithSignedUrls = s3Data.Contents.map(s3Video => {
      const videoMetadata = videosFromDb.find(v => v.s3_key === s3Video.Key);
      const signedUrl = `https://${params.BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Video.Key}`;
      
      return {
        ...s3Video,
        ...videoMetadata,
        signedUrl: signedUrl,
      };
    });
    
    res.json({ message: "Successfully retrieved bucket list:", videoWithSignedUrls });
  } catch (error) {
    console.error("Error listing files:", error);
    res.status(500).json({ message: "Error listing files from S3" });
  }
};


export {
  uploadFile,
  downloadFile,
  deleteFile,
  listFiles,
};