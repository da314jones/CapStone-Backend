import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const users = express.Router();
import { getUserByEmail, createUser, getAllUsers } from "../queries/users.js";

// users.post('/authenticate', async (req, res) => {
//     const { token } = req.body;

//     try {
//         // Verify the token
//         const decodedToken = await admin.auth().verifyIdToken(token);
//         const uid = decodedToken.uid;

//         // Check if the user exists in your database
//         let user = await db.oneOrNone('SELECT * FROM users WHERE firebase_uid = $1', [uid]);

//         if (!user) {
//             // If the user doesn't exist, create a new user entry
//             // Adjust the SQL query and parameters according to your database schema and requirements
//             user = await db.one('INSERT INTO users (firebase_uid, email) VALUES ($1, $2) RETURNING *',
//                 [uid, decodedToken.email]);
// //         }

//         // Here, the user is either fetched or created in the database, and you can return a success response
//         res.json({ success: true, message: "User authenticated successfully", user });
//     } catch (error) {
//         console.error("Authentication failed:", error);
//         res.status(401).json({ success: false, message: "Authentication failed" });
//     }
// });

// registration Endpoint
users.post("/new-user", async (req, res) => {
  const { displayName, email, photoURL, uid } = req.body;
  const names = displayName.split(" ");
  const firstName = names[0];
  const lastName = names.slice(1).join(" ") || "";

  try {
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: "User already exists." });
    }

    const newUser = await createUser({
      firstName,
      lastName,
      email,
      photoURL,
      uid,
    });
    res
      .status(201)
      .json({ message: "User created successfully", user: newUser });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error creating user.", error: error.message });
  }
});

//login
users.post("/login", async (req, res) => {
  console.log(req.body);
  const { email, password } = req.body;
  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and password are required." });
  }

  try {
    const user = await db.oneOrNone("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    console.log("Login successful for:", email);
    res
      .status(200)
      .json({ message: "Login successful", token, email: user.email });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error logging in." });
  }
});

export default users;
