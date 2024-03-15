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
  getVideoById,
  createVideo,
  updateVideo,
  deleteVideo,
} from "../queries/videos.js";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

// AWS SDK Configuration
// Credentials will be automatically sourced from environment variables
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Example function to list files by user ID
// const listFilesByUserId = async (userId) => {
//   const prefix = `users/${userId}/`; // Adjust based on your actual file structure in S3
//   const params = {
//     Bucket: process.env.BUCKET_NAME,
//     Prefix: prefix,
//   };

//   try {
//     const command = new ListObjectsV2Command(params);
//     const data = await s3Client.send(command);
//     return data.Contents.map((video) => ({
//       name: video.Key,
//       objectUrl: `https://${params.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${video.Key}`,
//       size: video.Size,
//       lastModified: video.LastModified,
//     }));
//   } catch (error) {
//     console.error("Error listing files by user ID:", error);
//     throw error; 
//   }
// };

const uploadFile = async (req, res) => {
  const { file } = req;
  const userId = req.body.userId;
  const title = req.body.title || 'Untitled';
  const summary = req.body.summary || "";
  const isPrivate = req.body.isPrivate === 'true';
  const duration = parseInt(req.body.duration) || 0;

  const fileStream = fs.createReadStream(file.path);

  const params = {
    Bucket: process.env.BUCKET_NAME,
    Key: `users/${userId}/${file.originalname}`,
    Body: fileStream,
    ContentType: file.mimetype,
    Metadata: {
      userId: userId.toString()
    }, // Assuming mimetype is provided by multer
  };

  try {
    const command = new PutObjectCommand(params);
    await s3Client.send(command);
    const fileUrl = `https://${params.Bucket}.s3.${
      process.env.AWS_REGION
    }.amazonaws.com/${encodeURIComponent(params.Key)}`;
    const video = await createVideo({
      userId,
      title: req.body.title || 'Untitled',
      summary: req.body.summary || '',
      video_url: fileUrl,
      isPrivate: req.body.isPrivate || false,
      duration: req.body.duration || 0,
    })
    const newVideo = await createVideo(videoData);
    
    fs.unlink(file.path, (err) => {
      if (err) {
        console.error("Failed to delete temporary file:", err);
      }
    }); // Cleans up the uploaded file from temporary storage
    if (req.file) {
      console.log("Uploading file:", req.file.originalname);
      res.status(200).json({ message: "Video uploaded successfully", url: fileUrl, userId, file: req.file.originalname });
    }else {
      res.status(400).json({ message: 'No File uploaded' })
    }
  } catch (err) {
    console.error("Error uploading file:", err);
    res.status(500).send(err.message || "Internal Server Error");
  }
};

// // direct uploads to s3
// const generateUploadPresignedUrl = async (req, res) => {
//   const userId = req.body.userId;
//   const fileName = `users/${userId}/${req.body.fileName}`;
//   try {
//     const command = new PutObjectCommand({
//       Bucket: process.env.BUCKET_NAME,
//       Key: fileName,
//     });
//     const url = await getSignedUrl(s3Client, command, { Expires: 60 * 5 });
//     res.status(200).send({ url });
//   } catch (error) {
//     console.error("Error generating presigned URL for upload:", error);
//     res.Status(500).send(error.message || "Internal Server Error");
//   }
// };

// const generateDownloadPresignedUrl = async (req, res) => {
//   const { fileName } = req.params;
//   try {
//     const command = new GetObjectCommand({
//       Bucket: process.env.AWS_S3_BUCKET_NAME,
//       Key: fileName,
//     });
//     const url = await getSignedUrl(s3Client, command, { expiresIn: 300 });
//     res.status(200).json({ url });
//   } catch (error) {
//     console.error("Error generating download presigned URL:", error);
//   }
// };

const downloadFile = async (req, res) => {
  console.log("Controller: downloadFile called for", req.params.filename);
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
    console.log(`Listing files from S3 bucket: ${params.Bucket}`);
    const command = new ListObjectsV2Command(params);
    const data = await s3Client.send(command);
    const videoWithSignedUrls = await Promise.all(
      data.Contents.map(async (video) => {
        const urlCommand = new GetObjectCommand({
          Bucket: params.Bucket,
          Key: video.Key,
        });
        const signedUrl = await getSignedUrl(s3Client, urlCommand, {
          expiresIn: 3600,
        });
        return {
          ...video,
          signedUrl,
        };
      })
    );
    res
      .status(200)
      .json({
        message: "Successfully retrieved bucket list:",
        videoWithSignedUrls,
      });
  } catch (error) {
    console.error("Error listing files:", error);
    res.status(500).json({ message: "Error listing files from S3" });
  }
};

export {
  // listFilesByUserId,
  uploadFile,
  // generateUploadPresignedUrl,
  // generateDownloadPresignedUrl,
  downloadFile,
  deleteFile,
  listFiles,
};
