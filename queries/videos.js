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

const createVideo = async (video, idOnly) => {
  console.log("Attempting to create video with data:", video);

  const { user_id, title, summary, signed_url, isPrivate, duration, archive_id } = video;
  try {
    console.log("Received video metadata:", video)
    let query = "";
    if (idOnly) {
    query = "INSERT INTO videos (user_id, title, summary, signed_url, is_private, duration, archive_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id";
    } else {
      query = "INSERT INTO videos (user_id, title, summary, signed_url, is_private, duration, archive_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *";
    }
    const createdVideo = await db.one(query, [user_id, title, summary, signed_url, isPrivate, duration, archive_id]);
    console.log("Video created:", createdVideo);
    return createdVideo;
  } catch (error) {
    console.error("Error creating video", error);
    throw error;
  }
};

const updateVideo = async (id, video) => {
  try {
    const { firebase_uid, title, summary, signed_url, duration, created_at } = video;
    const updatedVideo = await db.one(
      "UPDATE videos SET firebase_uid=$1, title=$2, summary=$3, signed_url=$4, duration=$5, created_at=$6 WHERE id=$7 RETURNING *",
      [
        video.firebase_uid,
        video.title,
        video.summary,
        video.signed_url,
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
