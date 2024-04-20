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
    "archiveId" VARCHAR(255),
    category VARCHAR(255) DEFAULT 'Untitled',
    title VARCHAR(255) DEFAULT 'Untitled',
    summary TEXT DEFAULT 'Summary not available',
    ai_summary TEXT DEFAULT 'Summary not available',
    thumbnail_signed_url TEXT, 
    is_private BOOLEAN DEFAULT TRUE, 
    s3_key VARCHAR (255),
    thumbnail_key VARCHAR (255),
    source VARCHAR DEFAULT 'Vonage',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

