import { db } from "../db/dbConfig.js";

const getAllVideos = async () => {
  try {
    const allVideos = await db.any("SELECT * FROM videos");
  } catch (error) {
    console.error("Error fetching all videos:", error);
    throw error;
  }
};

const getVideoById = async (id) => {
  try {
    const videoById = await db.one("SELECT * FROM videos WHERE id =$1", id);
  } catch (error) {
    console.error("Error fetching videos by id:", error);
    throw error;
  }
};

const createVideo = async (video) => {
  const { userId, title, summary, video_url, isPrivate, duration } = video;
  try {
    console.log({video})
    console.log({video_url})
    const createdVideo = await db.one(
      "INSERT INTO videos (user_id, title, summary, video_url, is_private, duration) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [userId, title, summary, video_url, isPrivate, duration]
    );
    console.log("Video created:", createVideo);
    return createdVideo;
  } catch (error) {
    console.error("Error creating video", error);
    throw error;
  }
};

const updateVideo = async (id, video) => {
  try {
    const { user_id, title, summary, video_url, duration, created_at } = video;
    const updatedVideo = await db.one(
      "UPDATE videos SET user_id=$1, title=$2, summary=$3, video_url=$4, duration=$5, created_at=$6 WHERE id=$7 RETURNING *",
      [
        video.user_id,
        video.title,
        video.summary,
        video.video_url,
        video.is_private,
        video.duration,
        video.created_at,
        id,
      ]
    );
    return updatedVideo;
  } catch (error) {
    console.error("Error creating video:", error);
    throw error;
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

export { getAllVideos, getVideoById, createVideo, updateVideo, deleteVideo };
