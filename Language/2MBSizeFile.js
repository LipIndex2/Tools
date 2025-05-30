const fs = require('fs');
const path = require('path');

const TARGET_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.bmp',
  '.mp3',
  '.wav',
  '.flac',
  '.aac',
];
const MIN_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

function findLargeMediaFiles(dir, results = []) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      findLargeMediaFiles(fullPath, results); // 递归子目录
    } else {
      const ext = path.extname(fullPath).toLowerCase();
      if (TARGET_EXTENSIONS.includes(ext) && stat.size > MIN_SIZE_BYTES) {
        results.push({
          path: fullPath,
          sizeMB: (stat.size / (1024 * 1024)).toFixed(2),
        });
      }
    }
  }

  return results;
}

// 修改为你要搜索的路径
const searchPath = 'D:/git/a2-client/A2-client/assets'; // 当前目录

const largeFiles = findLargeMediaFiles(searchPath);

console.log(`找到 ${largeFiles.length} 个大于 2MB 的图片或音频文件：`);
largeFiles.forEach(file => {
  console.log(`${file.path} - ${file.sizeMB} MB`);
});
