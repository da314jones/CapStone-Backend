import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import fs from "fs";
import dotenv from 'dotenv';
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
const listFilesByUserId = async (userId) => {
  const prefix = `users/${userId}/`; // Adjust based on your actual file structure in S3
  const params = {
    Bucket: process.env.BUCKET_NAME,
    Prefix: prefix,
  };

  try {
    const command = new ListObjectsV2Command(params);
    const data = await s3Client.send(command);
    return data.Contents.map((file) => ({
      name: file.Key,
      size: file.Size,
      lastModified: file.LastModified,
    }));
  } catch (error) {
    console.error("Error listing files by user ID:", error);
    throw error; // Rethrow the error for handling at a higher level
  }
};


const uploadFile = async (req, res) => {
  const { file } = req;
  const userId = req.body.userId;
  const fileStream = fs.createReadStream(file.path);

  const params = {
    Bucket: process.env.BUCKET_NAME, 
    Key: `users/${userId}/${file.originalname}`, 
    Body: fileStream,
    ContentType: file.mimetype,
    Metadata: {
      userId: userId,
    }, // Assuming mimetype is provided by multer
  };
  try {
    const command = new PutObjectCommand(params);
    await s3Client.send(command);
    const fileUrl = `https://${params.Bucket}.s3.${
      process.env.AWS_REGION
    }.amazonaws.com/${encodeURIComponent(params.Key)}`;
    fs.unlinkSync(file.path); // Clean up the uploaded file from temporary storage
    res
      .status(200)
      .send({ message: "File uploaded successfully", url: fileUrl, userId });
  } catch (err) {
    console.error("Error uploading file:", err);
    res.status(500).send(err.message || "Internal Server Error");
  }
};

// direct uploads to s3
const generateUploadPresignedUrl = async (req, res) => {
  const userId = req.body.userId;
  const fileName = `users/${userId}/${req.body.fileName}`;
  try {
    const command = new PutObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: fileName,
    });
    const url = await getSignedUrl(s3Client, command, { Expires: 60 * 5 });
    res.status(200).send({ url });
  } catch (error) {
    console.error("Error generating presigned URL for upload:", error);
    res.Status(500).send(error.message || "Internal Server Error");
  }
};

const generateDownloadPresignedUrl = async (req, res) => {
  const { fileName } = req.params;
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileName,
    });
    const url = await getSignedUrl(s3Client, command, { expiresIn: 300 });
    res.status(200).json({ url });
  } catch (error) {
    console.error("Error generating download presigned URL:", error);
  }
};

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
    const files = data.Contents.map((file) => ({
      name: file.Key,
      size: file.Size,
      lastModified: file.LastModified,
    }));

    res.status(200).json(files);
  } catch (error) {
    console.error("Error listing files:", error);
    res.status(500).json({ message: "Error listing files from S3" });
  }
};

export {
  listFilesByUserId,
  uploadFile,
  generateUploadPresignedUrl,
  generateDownloadPresignedUrl,
  downloadFile,
  deleteFile,
  listFiles,
};
