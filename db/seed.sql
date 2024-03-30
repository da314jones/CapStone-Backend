\c tidbits_dev

-- Seed data for the users table
INSERT INTO users ("user_id", "firstName", "lastName", "email", "photo_url", created_at) VALUES
('firebaseuid1', 'Renee', 'Smith', 'user1@example.com', 'null', NOW()),
('firebaseuid2', 'Furious', 'Jones', 'user2@example.com', 'null', NOW());

-- Seed data for the videos table
INSERT INTO videos (user_id, title, summary, category, video_url, thumbnail_url, is_private, s3_key, source)
VALUES 
('1', 'First Video', 'A summary of the first video.', 'Tutorial', 'http://example.com/firstvideo.mp4', 'http://example.com/thumbnails/firstvideo.png', false, 'some-s3-key-for-first-video', 'Vonage'),
('2', 'Second Video', 'A summary of the second video.', 'Educational', 'http://example.com/secondvideo.mp4', 'http://example.com/thumbnails/secondvideo.png', true, 'some-s3-key-for-second-video', 'Vonage'),
('3', 'Third Video', 'A summary of the third video.', 'Entertainment', 'http://example.com/thirdvideo.mp4', 'http://example.com/thumbnails/thirdvideo.png', false, 'some-s3-key-for-third-video', 'Vonage');
