import { db } from "../db/dbConfig.js";


//for tokbox
//confirmed
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

//confirmed usage
const createVideoEntry = async (userId, archiveId) => {
  if (!userId || !archiveId) {
    console.error('Invalid input: Both userId and archiveId must be provided');
    return { error: "Invalid input: Both userId and archiveId must be provided" };
  }

  try {
    console.log('Attempting to create video entry');
    const createdVideo = await db.one(
      `INSERT INTO videos (user_id, "archiveId") VALUES ($1, $2) RETURNING *`,
      [userId, archiveId]
    );
    console.log("New video entry created:", createdVideo);
    return createdVideo;
  } catch (error) {
    console.error("Error creating video entry:", error);
    throw error;
  }
};

//confirmed
const getVideoByArchiveId = async (archiveId) => {
  try {
    const videoByArchiveId = await db.oneOrNone('SELECT * FROM videos WHERE "archiveId"=$1', [archiveId]);
    return videoByArchiveId;
  } catch (error) {
    console.error("Error fetching video by archiveId", error);
    throw error;
  }
};

//confirmed
const updateVideoRecord = async (archiveId, updates) => {
  const fields = Object.keys(updates)
    .map((field, index) => `"${field}" = $${index + 2}`)
    .join(", ");
  const values = Object.values(updates);
  const query = `UPDATE videos SET ${fields} WHERE "archiveId" = $1 RETURNING *`;
  try {
    const result = await db.oneOrNone(query, [archiveId, ...values]);
    console.log("Video record updated:", result);
    return result;
  } catch (error) {
    console.error("Error updating video record:", error);
    throw error;
  }
};

//confirmed
const updateArchiveIdForUser = async (userId, archiveId) => {
  try {
    const query = `
      WITH LatestVideo AS (
        SELECT id FROM videos
        WHERE user_id = $1 AND "archiveId" IS NULL
        ORDER BY created_at DESC
        LIMIT 1
      )
      UPDATE videos SET "archiveId" = $2 
      FROM LatestVideo
      WHERE videos.id = LatestVideo.id
      RETURNING *;
    `;
    const result = await db.one(query, [userId, archiveId]); 
    console.log("Most recent video's archive ID updated successfully for user:", userId);
    return result;
  } catch (error) {
    console.error("Error updating the most recent archive ID for user:", userId, error);
    throw error;
  }
};

//confirmed
const updateDatabaseWithVideoAndThumbnail = async (archiveId, videoS3Key, thumbnailS3Key, formData) => {
  const title = formData.title || 'Untitled';
  const summary = formData.summary || 'Summary not available';
  const isPrivate = formData.isPrivate !== undefined ? formData.isPrivate : true;
  const category = formData.category || 'Untitled'; 
  try {
    const query = `
      UPDATE videos
      SET
        s3_key = $1,
        thumbnail_key = $2,
        title = $3,
        summary = $4,
        is_private = $5,
        category = $6,
        updated_at = NOW()
      WHERE "archiveId" = $7
      RETURNING *; 
    `;
    const params = [videoS3Key, thumbnailS3Key, title, summary, isPrivate, category, archiveId];
    const updatedRecord = await db.oneOrNone(query, params);
    console.log('Database update successful:', updatedRecord);
    return updatedRecord;
  } catch (err) {
    console.error('Error updating database:', err);
    throw err;
  }
};



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



const createInitialVideoMetadata = async ({
  user_id,
  archiveId, 
  title = "Untitled",
  summary = "No summary",
  is_private = true,
}) => {
  try {
    // Ensure user exists before attempting to create video metadata
    await createUserIfNotExists(user_id);

    // Validate that archiveId is not overly long for the database constraints
    if (archiveId && archiveId.length > 255) {
      throw new Error("Archive ID is too long for the database field.");
    }

    // Insert the video metadata into the database
    const createdVideo = await db.one(
      `INSERT INTO videos (user_id, archiveId, title, summary, is_private) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [user_id, archiveId, title, summary, is_private]
    );
    return createdVideo;
  } catch (error) {
    console.error("Error creating initial video metadata:", error);
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













async function getVideoMetadata(archiveId) {
  try {
      const videoDetails = await getVideoByArchiveId(archiveId);
      if (!videoDetails) {
          throw new Error("No video found for the given archive ID");
      }
      
      return {
          userId: videoDetails.user_id,
          archiveId: videoDetails.archiveId,
          category: videoDetails.category,
          title: videoDetails.title,
          summary: videoDetails.summary,
          aiSummary: videoDetails.ai_summary,
          isPrivate: videoDetails.is_private.toString(),  
          source: videoDetails.source || 'Vonage', 
          createdAt: videoDetails.created_at ? videoDetails.created_at.toISOString() : new Date().toISOString(),
          updatedAt: videoDetails.updated_at ? videoDetails.updated_at.toISOString() : new Date().toISOString()
      };
  } catch (error) {
      console.error("Error fetching video metadata:", error);
      throw error;
  }
}


// Adapted to use updateVideoRecord
const updateForVonageVideoMetadataUpload = async (
  archiveId,
  { title, summary, is_private, signed_url }
) => {
  try {
    await updateVideoRecord(archiveId, {
      title,
      summary,
      is_private,
      signed_url,
      archiveId,
    });
    console.log("Vonage video metadata updated for:", archiveId);
  } catch (error) {
    console.error("Error updating video metadata:", error);
    throw error;
  }
};

// Adapted to use updateVideoRecord
const updateDatabaseWithVideoS3Url = async (archiveId, formData, s3Key) => {
  const s3_url = `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${s3Key}`;
  try {
    // Assuming `formData` contains the other data like category, title, summary, etc.
    // Make sure to map formData to the correct column names as well.
    await updateVideoRecord(archiveId, {
      ...formData,
      is_private: formData.is_private, // Make sure formData uses the correct property names
      archiveId: archiveId, // Corrected from archiveId to archiveId
      s3_url, // Assuming this is correct and matches your column name
    });
    console.log("Database updated with S3 URL for:", archiveId);
  } catch (error) {
    console.error("Error updating video with S3 URL:", error);
    throw error;
  }
};

// Assuming this function is similar to updateDatabaseWithS3Url
const updateDatabaseWithThumbnailS3Url = async (
  archiveId,
  formData,
  thumbnailKey
) => {
  const thumbnail_url = `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${thumbnailKey}`;
  try {
    await updateVideoRecord(archiveId, { ...formData, thumbnail_url });
    console.log("Database updated with thumbnail URL for:", archiveId);
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
  createUserIfNotExists,
  createVideoEntry,
  getVideoByArchiveId,
  updateVideoRecord,
  updateArchiveIdForUser,
  updateDatabaseWithVideoAndThumbnail,
  getAllVideos,
  getVideoByTitle,
  createVideo,
  createInitialVideoMetadata,
  getVideoMetadata,
  updateForVonageVideoMetadataUpload,
  updateDatabaseWithVideoS3Url,
  updateDatabaseWithThumbnailS3Url,
  updateVideo,
  deleteVideo,
};
