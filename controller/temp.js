// videoController.js
import dotenv from "dotenv";
dotenv.config();
import fetch from "node-fetch";
import OpenTok from "opentok";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs, { rmSync } from "fs";
import path from "path";
import {
  getAllVideos,
  getVideoByArchiveId,
  getVideoByTitle,
  createVideo,
  createInitialVideoMetadata,
  saveRecordingDetailsTodDb,
  updateForVonageVideoMetadataUpload,
  updateDatabaseWithS3Url,
  updateDatabaseWithVideoThumbnailUrl,
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
  opentok.startArchive(sessionId, { name: "Session Recording" }, (error, archive) => {
    if (error) {
      console.error("Error starting archive:", error);
      return res.status(500).json({ message: "Failed to start recording", error: error.message });
    }

    // Assuming createInitialVideoMetadata creates an entry in the DB and returns metadata including the archiveId
    createInitialVideoMetadata({ user_id, archive_id: archive.id })
      .then(videoMetadata => {
        res.json({ archiveId: archive.id, videoMetadata }); // Send archiveId to the frontend
      })
      .catch(dbError => {
        console.error("Error creating initial video metadata:", dbError);
        res.status(500).json({ message: "Failed to create initial video metadata", error: dbError.message });
      });
  });
};



const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const checkArchiveAvailability = async (archive_id, retries = 7) => {
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

  if (!archiveId) {
      return res.status(400).json({ message: "Missing required field: archiveId." });
  };
  const videoPath = `./utility/tempVideo/${archiveId}.mp4`; 

  try {
    const archive = await new Promise((resolve, reject) => {
        opentok.stopArchive(archiveId, (error, archive) => {
            if (error) {
                console.error("Error stopping the archive:", error);
                return reject(new Error("Failed to stop recording"));
            }
            console.log('[stopVideoRecording] Recording stopped successfully:', archiveId);
            resolve(archive);
        });
    });
      // Retrieve the existing video record from the database
      const videoRecord = await getVideoByArchiveId(archiveId);
      if (!videoRecord) {
          return res.status(404).json({ message: "Video record not found." });
      }
    try {
      let savedDetails = null;
      if (archive && archive.status === 'available') {
        const metaDataObject = {
          archive_id: archiveId,
          video_url: archive.url, 
        }; 
        savedDetails = await saveRecordingDetailsTodDb(metaDataObject);
      };
    }

      // Download the archive video
      await getArchiveUrlFromVonage(archive.url, videoPath);
      
      const videoPath = `./utility/tempVideo/${archiveId}.mp4`;
      // Generate a thumbnail for the video
      const thumbnailPath = `./utility/tempImage/${archiveId}-thumbnail.png`;
      await generateThumbnail(videoPath, thumbnailPath);// Assuming this function is implemented

      // Upload the video and thumbnail to S3
      const userId = videoRecord.user_id; // Assuming `user_id` was stored in the video record
      const sanitizedTitle = videoRecord.title.replace(/[^a-zA-Z0-9-_\.]/g, '_');
      const videoKey = `user/${userId}/${sanitizedTitle}.mp4`;
      const thumbnailKey = `user/${userId}/${sanitizedTitle}.png`;
      const videoUrl = await uploadToS3(s3Client, videoPath, videoKey); // Assuming `uploadToS3` is implemented
      const thumbnailUrl = await uploadToS3(s3Client, thumbnailPath, thumbnailKey);

      // Update the existing video record in the database
      await updateVideoRecord(archiveId, {
          signed_url: videoUrl, 
          thumbnail_url: thumbnailUrl,
          // Include any other metadata updates here
      });

      // Respond to the client
      res.json({
          message: 'Video recording stopped, processed, and uploaded successfully',
          data: { videoUrl, thumbnailUrl },
      });
  } catch (error) {
      console.error('Error in stopVideoRecording:', error);
      res.status(500).json({ message: 'Failed to stop recording and process video', error: error.toString() });
  } finally {
      // Cleanup: remove local files
      fs.unlinkSync(videoPath);
      fs.unlinkSync(thumbnailPath);
  }
};

const processVideoUpload = async (req, res) => {
  const { archiveId } = req.params;
  const formData = req.body;
  // Validate inputs
  validateInputs(archiveId, formData);

  try {
    const s3Url = await uploadVideoToS3(formData, archiveId);
    const thumbnailUrl = await uploadImageToS3(formData, archiveId);
    res.json({
      message: "Video and thumbnail successfully uploaded to s3 and the database updated",
      s3Url: s3Url, thumbnailUrl: thumbnailUrl
    });
  } catch (error) {
    console.error('Error processing video data:', error);
    res.status(500).json({
      message: 'Failed to process video data',
      error: error.toString(),
    });
  }
};



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

//  const processVideoUpload = async (req, res) => {
//   const { archive_id } = req.params;
//   const formData = req.body;
  
//   // Validate inputs
//   validateInputs(archive_id, formData);

//   try {
//     // Define keys and paths
//     const videoKey = `videos/${archive_id}.mp4`;
//     const videoPath = `./utility/${archive_id}.mp4`;
//     const thumbnailKey = `thumbnails/${archive_id}.png`;
//     const thumbnailPath = `./utility/${archive_id}-thumbnail.png`;

//     // Perform uploads
//     const videoUrl = await uploadToS3(videoPath, videoKey, {title: formData.title});
//     const thumbnailUrl = await uploadToS3(thumbnailPath, thumbnailKey, {title: formData.title});

//     // Update database records
//     await updateVideoRecord(archive_id, {signed_url: videoUrl, thumbnail: thumbnailUrl});

//     res.json({
//       message: "Video and thumbnail successfully uploaded and record updated.",
//       videoUrl,
//       thumbnailUrl,
//     });
//   } catch (error) {
//     console.error('Error processing video upload:', error);
//     res.status(500).send('Failed to process video upload.');
//   }
// };



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




// Example of how you might define one of the utility functions
// async function downloadVideo(url, archiveId) {
//   const outputPath = path.join(__dirname, 'downloads', `${archiveId}.mp4`);
//   const response = await fetch(url);
//   if (!response.ok) throw new Error('Failed to download video');
//   await new Promise((resolve, reject) => {
//     const fileStream = fs.createWriteStream(outputPath);
//     response.body.pipe(fileStream);
//     response.body.on('error', reject);
//     fileStream.on('finish', resolve);
//   });
//   return outputPath;
// }






const stopVideoRecording = async (req, res) => {
  const { archiveId } = req.body;
  console.log(req.body)
  if (!archiveId) {
    return res.status(400).json({ message: 'archiveId is required' });
  }

  try {
    opentok.stopArchive(archiveId, async (error) => {
      if (error) {
        throw new Error(error.message || 'Internal Server Error');
      }

      console.log('[stopVideoRecording] Recording stopped successfully:', archiveId);
      try{
        const archive = await checkArchiveAvailability(archiveId);
        console.log(archive)
        let savedDetails = null;
        if (archive && archive.status === 'available') {
          const metaDataObject = {
            archive_id: archiveId,
            video_url: archive.url, 
          }; 
          savedDetails = await saveRecordingDetailsTodDb(metaDataObject);
        }
                  console.log("Before the saveDetails:", archive)
        console.log("saveRecordingDetails waiting for results:", archiveId);
      res.json({
        message: 'Recording stopped and metadata updated',savedDetails 
      });
    } catch (error) {
      throw new Error(`Error processing archive: ${error.message}`)
    }
    });
  } catch (error) {
    console.error('[stopVideoRecording] Error:', error);
    res.status(500).json({
      message: 'Failed to stop recording or fetch archive details',
      error: error.message
    });
  }
};