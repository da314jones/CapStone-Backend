import ffmpeg from 'fluent-ffmpeg';

function generateThumbnail(videoPath, thumbnailPath) {
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
        folder: '/thumbnails',
        size: '320x240',
        filename: 'thumbnail-%b.png'
      });
  });
}
