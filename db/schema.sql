DROP DATABASE IF EXISTS tidbits_dev;
CREATE DATABASE tidbits_dev;

\c tidbits_dev


-- Recreate the users table
CREATE TABLE users (
    user_id VARCHAR(255) PRIMARY KEY,
    "firstName" VARCHAR(255),
    "lastName" VARCHAR(255),
    "email" VARCHAR(255) UNIQUE NOT NULL,
    photo_url VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE videos (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) REFERENCES users(user_id) ON DELETE CASCADE ON UPDATE CASCADE,
    archive_id VARCHAR(255),
    category VARCHAR(255),
    title VARCHAR(255),
    summary TEXT,
    ai_summary TEXT,
    signed_url TEXT, 
    is_private BOOLEAN DEFAULT FALSE, 
    s3_key TEXT,
    thumbnail VARCHAR (255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);




-- Recreate the closed_captions table
-- CREATE TABLE closed_captions (
--     id SERIAL PRIMARY KEY,
--     video_id INTEGER REFERENCES videos(id) ON DELETE CASCADE,
--     timestamp INT NOT NULL, 
--     text TEXT NOT NULL
-- );

-- -- Additional tables as needed, uncommented and corrected from your submission
-- CREATE TABLE messages (
--     id SERIAL PRIMARY KEY,
--     sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
--     recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
--     message TEXT NOT NULL,
    -- video_id INTEGER REFERENCES videos(id) ON DELETE CASCADE, -- Optional, if messages are specific to a video

--     sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
-- );

-- CREATE TABLE favorites (
--     id SERIAL PRIMARY KEY,
--     user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
--     video_id INTEGER REFERENCES videos(id) ON DELETE CASCADE,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
--     UNIQUE(user_id, video_id) -- Prevents duplicate entries
-- );

-- CREATE TABLE video_views (
--     id SERIAL PRIMARY KEY,
--     user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
--     video_id INTEGER REFERENCES videos(id) ON DELETE CASCADE,
--     viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
-- );
