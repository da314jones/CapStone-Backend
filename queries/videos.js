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

const getVideoByTitle = async (title) => {
  try {
    const videoByTitle = await db.one(
      "SELECT * FROM videos WHERE title =$1",
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

const updateVonageVideoMetadata = async (
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

const saveRecordingDetails = async ({ archive_id, user_id, title, summary, is_private, video_url }) => {
  try {
    // Assuming you want to insert new video details
    const newVideo = await db.one(
      `INSERT INTO videos (user_id, archive_id, title, summary, is_private, video_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [user_id, archive_id, title, summary, is_private, video_url]
    );
    return newVideo;
  } catch (error) {
    console.error("Error saving recording details:", error);
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
        user_id,
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

export {
  getAllVideos,
  getVideoByTitle,
  createVideo,
  createInitialVideoMetadata,
  updateVonageVideoMetadata,
  saveRecordingDetails,
  updateVideo,
  deleteVideo,
};
