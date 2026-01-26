const fs = require('fs');
try {
  const watcher = fs.watch(__filename, (eventType, filename) => {
    console.log(`event type is: ${eventType}`);
    if (filename) {
      console.log(`filename provided: ${filename}`);
    } else {
      console.log('filename not provided');
    }
  });
  console.log('Watch started successfully.');
  setTimeout(() => {
    watcher.close();
    console.log('Watch closed.');
  }, 1000);
} catch (err) {
  console.error('Watch failed:', err);
}
