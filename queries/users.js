// queries/users.js
import { db } from "../db/dbConfig.js";

const createUser = async ({ firstName, lastName, email, photo_url, firebase_uid }) => {
  try {
    return await db.one(
      `INSERT INTO users ("firstName", "lastName", "email", photo_url, "firebase_uid") VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [firstName, lastName, email, photo_url, firebase_uid]);
  } catch (error) {
    throw new Error(`Error creating user: ${error}`);
  }
};

const getUserByEmail = async (email) => {
  const userByEmail = await db.oneOrNone("SELECT * FROM users WHERE email = $1", [email]);
  return userByEmail;
};

const getAllUsers = async () => {
  const allUsers = await db.any("SELECT * FROM users");
  return allUsers;
};

const removeUserByEmail = async (email) => {
  const removeUser = await db.one("DELETE FROM users WHERE email = $1", [email]);
  return removeUser.rowCount;
};

export { createUser, getUserByEmail, getAllUsers, removeUserByEmail };
