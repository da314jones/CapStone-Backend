// vonageS3Controller.js
import dotenv from "dotenv";
dotenv.config();
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import fetch from "node-fetch";
import OpenTok from "opentok";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";import { getVideoByArchiveId, updateDatabaseWithS3Url, updateDatabaseWithVideoAndThumbnail } from "../queries/videos.js";


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

  // Reformat the title to create a valid S3 key 
  const uploadVideoToS3 = async (formData, archiveId) => {
    const videoDetails = await getVideoByArchiveId(archiveId);
    console.log(videoDetails); // This should log the object with user_id
    console.log(archiveId)
    if (!videoDetails) {
      throw new Error("Video not found with archiveId.");
    }
  
    const userId = videoDetails.user_id; 
    const sanitizedTitle = formData.title.replace(/[^a-zA-Z0-9-_]+/g, '-');
    const s3Key = `user/${userId}/${sanitizedTitle}.mp4`;
      const localVideoPath = `./utility/${archiveId}.mp4`;
  
    try {
      await fs.promises.access(localVideoPath, fs.constants.F_OK);
  
      const fileStream = fs.createReadStream(localVideoPath);
      const uploadParams = {
        Bucket: process.env.BUCKET_NAME,
        Key: s3Key,
        Body: fileStream,
        Metadata: {
          title: formData.title,
          summary: formData.summary,
        },
      };
  
      const uploadResult = await s3Client.send(new PutObjectCommand(uploadParams));
      console.log('Upload Result:', uploadResult);
  
      const s3Url = `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${s3Key}`;
      await updateDatabaseWithS3Url(archiveId, formData, s3Key)
      return s3Url;
    } catch (err) {
      console.error(`${localVideoPath} does not exist or other error:`, err);
      throw err; 
    }
  };

const processVideoData = async (req, res) => {
  const { archiveId } = req.params;
  const formData = req.body;

  try {
    const s3Url = await uploadVideoToS3(formData, archiveId);
    res.json({
      message: "Video successfully uploaded to s3 and the database updated",
      s3Url: s3Url,
    });
  } catch (error) {
    console.error('Error processing video data:', error);
    res.status(500).json({
      message: 'Failed to process video data',
      error: error.toString(),
    });
  }
};

// // Import necessary libraries and modules
// import fs from 'fs';
// import ffmpeg from 'fluent-ffmpeg';
// import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
// import { getVideoByArchiveId, updateDatabaseWithVideoAndThumbnail } from "../queries/videos.js";

// // Setup your S3 client and other configurations as before

// // Upload video and its thumbnail to S3, then update database
// const processVideoUploadAndThumbnail = async (req, res) => {
//   const { archiveId } = req.params;
//   const formData = req.body; // Contains title, summary, etc.
  
//   try {
//     // Define file paths
//     const videoFilePath = `./utility/${archiveId}.mp4`;
//     const thumbnailFilePath = `./utility/${archiveId}-thumbnail.png`;

//     // Generate and upload thumbnail
//     await generateThumbnail(videoFilePath, thumbnailFilePath);
//     const thumbnailS3Key = `thumbnails/${archiveId}.png`;
//     await uploadFileToS3(thumbnailFilePath, thumbnailS3Key);

//     // Upload video to S3
//     const videoS3Key = `videos/${archiveId}.mp4`;
//     await uploadFileToS3(videoFilePath, videoS3Key);

//     // Update database with video and thumbnail S3 keys
//     await updateDatabaseWithVideoAndThumbnail(archiveId, videoS3Key, thumbnailS3Key, formData);

//     res.json({ message: "Video and thumbnail processed and uploaded successfully." });
//   } catch (error) {
//     console.error('Error processing video and thumbnail:', error);
//     res.status(500).json({ message: 'Failed to process video and thumbnail', error: error.toString() });
//   }
// };

// // Function to upload a file to S3
// async function uploadFileToS3(filePath, s3Key) {
//   const fileStream = fs.createReadStream(filePath);
//   const uploadParams = { Bucket: process.env.BUCKET_NAME, Key: s3Key, Body: fileStream };
  
//   await s3Client.send(new PutObjectCommand(uploadParams));
//   console.log(`${filePath} uploaded to S3 as ${s3Key}`);
// }

// // Function to generate a thumbnail for a video
// function generateThumbnail(videoPath, thumbnailPath) {
//   return new Promise((resolve, reject) => {
//     ffmpeg(videoPath)
//       .screenshots({
//         count: 1,
//         folder: './utility', // Make sure this matches your actual folder path
//         size: '320x240',
//         filename: `${thumbnailPath.split('/').pop()}` // Extracts file name from path
//       })
//       .on('end', () => resolve())
//       .on('error', (err) => reject(err));
//   });
// }



// // export const downloadAndUploadArchive = async (archive_id, user_id, metadata) => {
// //   try {
// //     const archiveUrl = await getArchiveUrlFromVonage(archive_id);
// //     const videoBuffer = await fetch(archiveUrl).then(res => res.buffer());

// //     const s3Key = `archives/${user_id}/${Date.now()}-${metadata.title}.mp4`;
// //     const params = {
// //       Bucket: process.env.BUCKET_NAME,
// //       Key: s3Key,
// //       Body: videoBuffer,
// //       Metadata: {
// //         title: metadata.title,
// //         summary: metadata.summary,
// //       }
// //     };

//     // Upload to S3
// //     await s3Client.send(new PutObjectCommand(params));

// //     await updateForVonageVideoMetadataUpload({
// //       user_id: user_id,
// //       title: metadata.title,
// //       summary: metadata.summary,
// //       category: metadata.category,
// //       video_url: `https://${params.Bucket}.s3.amazonaws.com/${params.Key}`,
// //       is_private: metadata.is_private,
// //       s3_key: s3Key,
// //       source: "Vonage",
// //     });

// //     console.log("Video processed and uploaded successfully");
// //   } catch (error) {
// //     console.error("Error in downloading/uploading archive:", error);
// //   }
// // };


// export default {
//     // downloadAndUploadArchive,
//     processVideoData
// }