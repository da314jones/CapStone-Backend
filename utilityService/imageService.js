import dotenv from "dotenv";
dotenv.config();
import ffmpeg from 'fluent-ffmpeg';

const videoPath = process.env.VIDEO_PATH;
const thumbnailPath = process.env.THUMBNAIL_PATH;

export function generateThumbnail(videoPath, archiveId, thumbnailPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .on('end', function() {
        console.log('Thumbnail generated successfully');
        resolve(thumbnailPath);
      })
      .on('error', function(err) {
        console.error('Error generating thumbnail', err);
        reject(err);
      })
      .screenshots({
        count: 1,
        folder: './thumbnails',
        size: '320x240',
        filename: `${archiveId}.png`
      });
  });
}

