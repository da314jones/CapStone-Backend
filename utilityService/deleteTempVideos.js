import fs from 'fs';

function deleteLocalFile(filePath) {
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error('Failed to delete local file', err);
    } else {
      console.log('Successfully deleted local file');
    }
  });
}
