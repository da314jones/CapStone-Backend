\c tidbits_dev

-- Seed data for the users table
INSERT INTO users ("user_id", "firstName", "lastName", "email", "photo_url", created_at) VALUES
('firebaseuid1', 'Renee', 'Smith', 'user1@example.com', 'null', NOW()),
('firebaseuid2', 'Furious', 'Jones', 'user2@example.com', 'null', NOW());

-- Since user_id references are to be consistent, ensure the user IDs match actual IDs in users table.
-- For demonstration, assuming IDs 1 and 2 exist. Adjust if different.
INSERT INTO videos (user_id, archive_id, category, title, summary, ai_summary, signed_url, is_private, s3_key, thumbnail_key, source, created_at, updated_at) VALUES
('firebaseuid1', '7026e2a4-2615-4ee9-8e10-2b8412764c6f', 'The Nature of Code', 'An introduction to coding simulations of natural systems.', 'Comprehensive overview on simulating natural systems through code.', 'AI summary for The Nature of Code', 'http://example.com/the-nature-of-code-vonage.mp4', true, 'http://example.com/the-nature-of-code-s3.mp4', 'http://example.com/the-nature-of-code-s3.png', 'Vonage', NOW(), NOW()),
('firebaseuid2', 'ef15c1a7-1b69-4d35-92fc-9c75cd8e1093', 'AI for Everyone', 'A beginner’s guide to understanding AI and its implications.', 'Insightful summary on the basics of AI and its impact.', 'AI summary for AI for Everyone', 'http://example.com/ai-for-everyone-vonage.mp4',  false, 'http://example.com/ai-for-everyone-s3.mp4', 'http://example.com/ai-for-everyone-s3.png', 'Vonage', NOW(), NOW());

