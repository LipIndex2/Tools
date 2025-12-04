const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

function updateMetaFiles(dir) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);

    if (fs.statSync(fullPath).isDirectory()) {
      updateMetaFiles(fullPath);
    } else if (file.endsWith('.meta')) {
      let content = fs.readFileSync(fullPath, 'utf-8');
      let json = JSON.parse(content);

      // 针对图片资源
      if (json && (json.importer === 'texture' || json.importer === 'auto-atlas')) {
        const platforms = ['minigame', 'default', 'android', 'ios', 'web'];
        json.platformSettings = {};
        json.platformSettings['android'] = {
          formats: [
            {
              name: 'astc_8x8',
              quality: 'exhaustive',
            },
            {
              name: 'etc2_rgb',
              quality: 'fast',
            },
          ],
        };

        // platforms.forEach(platform => {
        //   if (!json.platformSettings) json.platformSettings = {};

        //   json.compressionLevel = 9;

        //   if (platform === 'android') {
        //     json.platformSettings[platform] = {
        //       formats: [
        //         {
        //           name: 'astc_8x8',
        //           quality: 'exhaustive',
        //         },
        //       ],
        //     };
        //   }
        // else {
        //   json.platformSettings[platform] = {
        //     // formats: [
        //     //   {
        //     //     name: "webp",
        //     //     quality: 80,
        //     //     // name: "astc_5x5",
        //     //     // quality: "medium",
        //     //   },
        //     // ],
        //   };
        // }
        // });

        fs.writeFileSync(fullPath, JSON.stringify(json, null, 2));
        console.log(`Updated: ${fullPath}`);
      }
    }
  });
}

// updateMetaFiles('D:/git/a1-client/A1-client/assets'); // 你项目资源的根路径
// updateMetaFiles("D:/git/a2-client/A2-client/assets"); // 你项目资源的根路径

// const fs = require("fs");
// const path = require("path");
// const ffmpeg = require("fluent-ffmpeg");
// const ffmpegPath = require("ffmpeg-static");
// ffmpeg.setFfmpegPath(ffmpegPath);

// const inputDir = "D:/git/a1-client/A1-client/assets/home/sound";
// const outputDir = "D:/feishuDownload/sound";

// if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

// fs.readdirSync(inputDir).forEach((file) => {
//   if (file.endsWith(".wav")) {
//     const inputPath = path.join(inputDir, file);
//     const outputPath = path.join(outputDir, file.replace(".wav", ".mp3"));

//     ffmpeg(inputPath)
//       .audioBitrate("96k")
//       .toFormat("mp3")
//       .on("end", () => console.log(`压缩完成: ${file}`))
//       .on("error", (err) => console.error(`出错: ${file}`, err))
//       .save(outputPath);
//   }
// });

