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
  const userExists = await db.oneOrNone(
    "SELECT 1 FROM users WHERE user_id = $1",
    [userId]
  );
  if (!userExists) {
    await db.none(
      'INSERT INTO users ("user_id", "firstName", "lastName", "email", "photo_url") VALUES ($1, $2, $3, $4, $5)',
      [userId, firstName, lastName, email, photoUrl]
    );
    console.log(`User ${userId} created.`);
  }
};


const getUserById = async (userId) => {
  try {
    const user = await db.oneOrNone(
      `SELECT user_id, "firstName", "lastName", email, photo_url, created_at FROM users WHERE user_id = $1`,
      [userId]
    );
    console.log('Retrieved:', user);
    return user;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw error;
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


async function createS3UsersVideoEntry(videoData) {
  try {
    const insertedVideo = await db.one(
      `INSERT INTO videos (user_id, "archiveId", category, title, summary, s3_key, thumbnail_key, is_private) VALUES 
      ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [videoData.user_id, videoData.archiveId, videoData.category, videoData.title, videoData.summary, videoData.s3_key, videoData.thumbnail_key, videoData.is_private]
    );
    console.log("New video entry created:", insertedVideo);
    return insertedVideo;
  } catch (error) {
    console.error("Error creating video entry:", error);
    throw error;
  }
}

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

const checkAndInsertUser = async (userData) => {
  const { user_id, firstName, lastName, email, photo_url, created_at } = JSON.parse(userData);
  const userExists = await db.oneOrNone('SELECT 1 FROM users WHERE user_id = $1', [user_id]);
  if (!userExists) {
    await db.none(
      'INSERT INTO users (user_id, "firstName", "lastName", email, photo_url, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [user_id, firstName, lastName, email, photo_url, created_at]
    );
    console.log(`Inserted new user with ID: ${user_id}`);
  } else {
    console.log(`User with ID: ${user_id} already exists.`);
  }
}


const insertVideoMetadata = async (videoData) => {
  const { user_id, category, title, summary, isprivate, source, s3_key, thumbnail_key } = videoData;
  await db.none(
    `INSERT INTO videos (user_id, category, title, summary, is_private, source, s3_key, thumbnail_key, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [user_id, category, title, summary, isprivate === 'true', source, s3_key, thumbnail_key]
  );
  console.log(`Video metadata inserted for user ID: ${user_id}`);
}

export async function getSignedUrlsForPng(db) {
  try {
      const query = `
          SELECT s3_key
          FROM videos
          WHERE s3_key LIKE '%.png';
      `;
      const result = await db.any(query);
      const s3Keys = result.map(row => row.s3_key);
      return s3Keys;
  } catch (error) {
      console.error("Error fetching S3 keys for PNG files:", error);
      throw error; 
  }
}






//confirmed for local
const getAllVideos = async () => {
  try {
    const allVideos = await db.any("SELECT * FROM videos");
    return allVideos;
  } catch (error) {
    console.error("Error fetching all videos:", error);
    throw error;
  }
};


//
const getAllThumbnails = async () => {
  try {
    const allThumbnails = await db.any("SELECT * FROM videos WHERE thumbnail_key IS NOT NULL");
    return allThumbnails;
  } catch (error) {
    console.error("Error fetching all videos:", error);
    throw error;
  }
};


const ensureUserInDatabase = async (metadata) => {
  const userId = metadata.user_id;
  try {
    const userExists = await db.oneOrNone('SELECT user_id FROM users WHERE user_id = $1', [userId]);
    if (!userExists) {
      await addUserToDatabase(metadata);
      console.log(`User ${userId} added to the database.`);
    } else {
      console.log(`User ${userId} already exists in the database.`);
    }
  } catch (error) {
    console.error(`Error ensuring user ${userId} in the database:`, error);
    throw error;
  }
};




const insertVideoEntry = async (videoData) => {
  const {
      userId,
      archiveId = null,
      category = 'Tutorial', 
      title = 'Untitled',
      summary = 'No summary provided',
      ai_summary = 'AI summary not available',
      isPrivate = true,
      s3Key,
      thumbnailKey,
      source = 'Vonage', 
      signedUrl = null 
  } = videoData;

  try {
      const query = `
          INSERT INTO videos (
              user_id, archiveId, category, title, summary, ai_summary,
              is_private, s3_key, thumbnail_key, source, signed_url, created_at, updated_at
          ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          ) RETURNING *;`;

      const params = [
          userId, archiveId, category, title, summary, ai_summary,
          isPrivate, s3Key, thumbnailKey, source, signedUrl
      ];
      const result = await db.one(query, params);
      console.log('Video entry created:', result);
      return result;
  } catch (error) {
      console.error('Failed to insert video entry:', error);
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
  getUserById,
  createVideoEntry,
  createS3UsersVideoEntry,
  getVideoByArchiveId,
  updateVideoRecord,
  updateArchiveIdForUser,
  updateDatabaseWithVideoAndThumbnail,
  getAllThumbnails,
  checkAndInsertUser,
  insertVideoMetadata,
  getAllVideos,
  insertVideoEntry,
  ensureUserInDatabase,
  getVideoByTitle,
  createVideo,
  createInitialVideoMetadata,
  updateVideo,
  deleteVideo,
};