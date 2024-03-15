-- Seed data for the users table
INSERT INTO users (firstName, lastName, email, firebase_uid, created_at) VALUES
('Renee', 'Smith', 'user1@example.com', 'firebaseuid1');


-- Since user_id references are to be consistent, ensure the user IDs match actual IDs in users table.
-- For demonstration, assuming IDs 1 and 2 exist. Adjust if different.
INSERT INTO videos (user_id, title, summary, ai_summary, video_url, is_private, duration, created_at) VALUES
(1, 'The Nature of Code', 'An introduction to coding simulations of natural systems.', 'Comprehensive overview on simulating natural systems through code.', 'http://example.com/the-nature-of-code.mp4', true, 3600, NOW()),
(2, 'AI for Everyone', 'A beginner’s guide to understanding AI and its implications.', 'Insightful summary on the basics of AI and its impact.', 'http://example.com/ai-for-everyone.mp4', false, 5400, NOW());

