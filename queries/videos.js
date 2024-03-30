import { db } from "../db/dbConfig.js";

// sS3 ready
const getAllVideos = async () => {
  try {
    const allVideos = await db.any("SELECT * FROM videos");
    return allVideos;
  } catch (error) {
    console.error("Error fetching all videos:", error);
    throw error;
  }
};

const getVideoByArchiveId = async (archive_id) => {
  try {
    const videoByArchiveId = await db.oneOrNone("SELECT user_id FROM videos WHERE archive_id=$1", [archive_id]);
    return videoByArchiveId;
  } catch (error) {
    console.error('Error fetching video by archiveId', error);
    throw error;
  }
};



const getVideoByTitle = async (title) => {
  try {
    const videoByTitle = await db.one(
      "SELECT * FROM videos WHERE title=$1",
      title
    );
    return videoByTitle;
  } catch (error) {
    console.error("Error fetching videos by id:", error);
    throw error;
  }
};


//final schema ready / local machine
const createVideo = async (video) => {
  const {
    user_id,
    title,
    summary,
    category,
    video_url,
    is_private,
    s3_key,
    source,
  } = video;

  try {
    const createdVideo = await db.one(
      `INSERT INTO videos (user_id, title, summary, category, video_url, is_private, s3_key, source) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [user_id, title, summary, category, video_url, is_private, s3_key, source]
    );
    return createdVideo;
  } catch (error) {
    console.error("Error creating video", error);
    throw error;
  }
};

//for tokbox
const createInitialVideoMetadata = async ({
  user_id,
  archive_id,
  title = "Untitled",
  summary = "No summary",
  is_private = true,
}) => {
  try {
    const createdVideo = await db.one(
      `INSERT INTO videos (user_id, archive_id, title, summary, is_private) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [user_id, archive_id, title, summary, is_private]
    );
    return createdVideo;
  } catch (error) {
    console.error("Error creating initial video metadata:", error);
    throw error;
  }
};

const saveRecordingDetailsTodDb = async ({ archive_id, video_url }) => {
  try {
    const updateVideo = await db.one(`UPDATE videos SET video_url = $2 WHERE archive_id = $1 RETURNING *`,
    [archive_id, video_url,]);
    return updateVideo;
  } catch (error) {
    console.error("Error saving recording details:", error);
    throw error;
  }
};

const updateForVonageVideoMetadataUpload = async (
  archive_id,
  { title, summary, is_private, video_url }
) => {
  try {
    const updatedVideo = await db.oneOrNone(
      `UPDATE videos SET title=$1, summary=$2, is_private=$3, video_url=$4 WHERE archive_id=$5 RETURNING *`,
      [title, summary, is_private, video_url, archive_id]
    );
    return updatedVideo;
  } catch (error) {
    console.error("Error updating video metadata:", error);
    throw error;
  }
};

const updateDatabaseWithS3Url = async (archiveId, formData, s3Key) => {
  try {
    // Update the record with the S3 URL and any other formData fields
    // Adjust the SQL query placeholders and array as necessary to match your schema and formData structure
    const result = await db.oneOrNone(
      `UPDATE videos 
       SET video_url = $1, title = $2, summary = $3, category = $4, is_private = $5, s3_key = $6, user_id = $7 
       WHERE archive_id = $8 
       RETURNING *`,
      [
        `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${s3Key}`, // s3_url
        formData.title,
        formData.summary,
        formData.category,
        formData.isPrivate,
        s3Key, 
        formData.user_id,
        archiveId,
      ]
    );
    console.log("Update result:", result);
    return result;
  } catch (error) {
    console.error("Error updating video with S3 URL:", error);
    throw error;
  }
};

// only for replacement no 'video editing' full replacement
const updateVideo = async (id, video) => {
  const { title, summary, category, video_url, is_private, s3_key, source } =
    video;
  try {
    const updatedVideo = await db.one(
      `UPDATE videos SET title=$1, summary=$2, category=$3, video_url=$4, is_private=$5, s3_key=$6, source=$7 WHERE id=$8 RETURNING *`,
      [
        title,
        summary,
        category,
        video_url,
        is_private,
        s3_key,
        source,
        id,
      ]
    );
    return updatedVideo;
  } catch (error) {
    return error;
  }
};

const deleteVideo = async (id) => {
  try {
    const deletedVideo = await db.one(
      "DELETE FROM videos WHERE id=$1 RETURNING *",
      [id]
    );
    return deletedVideo;
  } catch (error) {
    console.error("Error deleting video:", error);
    throw error;
  }
};

async function updateVideoMetadataWithThumbnailUrl(videoId, thumbnailUrl) {
  
  const query = `UPDATE videos SET thumbnail_url = $1 WHERE id = $2 RETURNING *`;
  try {
    const result = await db.query(query, [thumbnailUrl, videoId]);
    console.log('Video metadata updated with thumbnail URL:', result.rows[0]);
    return result.rows[0];
  } catch (error) {
    console.error('Error updating video metadata with thumbnail URL:', error);
    throw error;
  }
}


export {
  getAllVideos,
  getVideoByArchiveId,
  getVideoByTitle,
  createVideo,
  createInitialVideoMetadata,
  saveRecordingDetailsTodDb,
  updateForVonageVideoMetadataUpload,
  updateDatabaseWithS3Url,
  updateVideo,
  deleteVideo,
};