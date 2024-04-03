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
    const videoByArchiveId = await db.oneOrNone(
      "SELECT user_id FROM videos WHERE archive_id=$1",
      [archive_id]
    );
    return videoByArchiveId;
  } catch (error) {
    console.error("Error fetching video by archiveId", error);
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
    category,
    title,
    summary,
    ai_summary,
    signed_url,
    is_private,
    s3_key,
    thumbnail,
    source,
  } = video;

  try {
    const createdVideo = await db.one(
      `INSERT INTO videos (user_id, title, summary, category, signed_url, is_private, s3_key, source) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        user_id,
        category,
        title,
        summary,
        ai_summary,
        signed_url,
        is_private,
        s3_key,
        thumbnail,
        source,
      ]
    );
    return createdVideo;
  } catch (error) {
    console.error("Error creating video", error);
    throw error;
  }
};

//for tokbox
const createUserIfNotExists = async (
  userId,
  firstName = "",
  lastName = "",
  email = "",
  photoUrl = ""
) => {
  // Check if user exists
  const userExists = await db.oneOrNone(
    "SELECT 1 FROM users WHERE user_id = $1",
    [userId]
  );
  if (!userExists) {
    // Insert user with the exact casing for column names
    await db.none(
      'INSERT INTO users ("user_id", "firstName", "lastName", "email", "photo_url") VALUES ($1, $2, $3, $4, $5)',
      [userId, firstName, lastName, email, photoUrl]
    );
    console.log(`User ${userId} created.`);
  }
};

const createInitialVideoMetadata = async ({
  user_id,
  archive_id,
  title = "Untitled",
  summary = "No summary",
  is_private = true,
}) => {
  try {
    await createUserIfNotExists(user_id);

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

const updateVideoRecord = async (archive_Id, updates) => {
  const fields = Object.keys(updates)
    .map((field, index) => `${field} = $${index + 2}`)
    .join(", ");
  const values = Object.values(updates);

  const query = `UPDATE videos SET ${fields} WHERE archive_id = $1 RETURNING *`;

  try {
    const result = await db.oneOrNone(query, [archive_Id, ...values]);
    console.log("Video record updated:", result);
    return result;
  } catch (error) {
    console.error("Error updating video record:", error);
    throw error;
  }
};

// Simplified to use updateVideoRecord
const saveRecordingDetailsTodDb = async ({ archive_id, signed_url }) => {
  try {
    await updateVideoRecord(archive_id, { signed_url });
    console.log("Recording details saved for:", archive_id);
  } catch (error) {
    console.error("Error saving recording details:", error);
    throw error;
  }
};

// Adapted to use updateVideoRecord
const updateForVonageVideoMetadataUpload = async (
  archive_id,
  { title, summary, is_private, signed_url }
) => {
  try {
    await updateVideoRecord(archive_id, {
      title,
      summary,
      is_private,
      signed_url,
    });
    console.log("Vonage video metadata updated for:", archive_id);
  } catch (error) {
    console.error("Error updating video metadata:", error);
    throw error;
  }
};

// Adapted to use updateVideoRecord
const updateDatabaseWithS3Url = async (archiveId, formData, s3Key) => {
  const s3_url = `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${s3Key}`;
  try {
    // Assuming `formData` contains the other data like category, title, summary, etc.
    // Make sure to map formData to the correct column names as well.
    await updateVideoRecord(archiveId, {
      ...formData,
      is_private: formData.is_private, // Make sure formData uses the correct property names
      archive_id: archiveId, // Corrected from archiveId to archive_id
      s3_url, // Assuming this is correct and matches your column name
    });
    console.log("Database updated with S3 URL for:", archiveId);
  } catch (error) {
    console.error("Error updating video with S3 URL:", error);
    throw error;
  }
};

// Assuming this function is similar to updateDatabaseWithS3Url
const updateDatabaseWithVideoThumbnailUrl = async (
  archive_id,
  formData,
  thumbnailKey
) => {
  const thumbnail_url = `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${thumbnailKey}`;
  try {
    await updateVideoRecord(archive_id, { ...formData, thumbnail_url });
    console.log("Database updated with thumbnail URL for:", archive_id);
  } catch (error) {
    console.error("Error updating thumbnail URL:", error);
    throw error;
  }
};

// only for replacement no 'video editing' full replacement
const updateVideo = async (id, video) => {
  const { title, summary, category, signed_url, is_private, s3_key, source } =
    video;
  try {
    const updatedVideo = await db.one(
      `UPDATE videos SET title=$1, summary=$2, category=$3, signed_url=$4, is_private=$5, s3_key=$6, source=$7 WHERE id=$8 RETURNING *`,
      [title, summary, category, signed_url, is_private, s3_key, source, id]
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
};
