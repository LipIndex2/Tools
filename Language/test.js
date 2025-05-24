const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

function updateMetaFiles(dir) {
  fs.readdirSync(dir).forEach((file) => {
    const fullPath = path.join(dir, file);

    if (fs.statSync(fullPath).isDirectory()) {
      updateMetaFiles(fullPath);
    } else if (file.endsWith(".meta")) {
      let content = fs.readFileSync(fullPath, "utf-8");
      let json = JSON.parse(content);

      // 针对图片资源
      if (
        json &&
        (json.importer === "texture" || json.importer === "auto-atlas")
      ) {
        const platforms = ["minigame", "default", "android", "ios", "web"];
        platforms.forEach((platform) => {
          if (!json.platformSettings) json.platformSettings = {};

          json.compressionLevel = 9;

          if (platform === "minigame") {
            json.platformSettings[platform] = {
              formats: [
                // {
                //   // name: "webp",
                //   // quality: 80,
                //   name: "astc_8x8",
                //   quality: "exhaustive",
                // },
                {
                  name: "png",
                  quality: 50,
                },
              ],
            };
          } else {
            json.platformSettings[platform] = {
              // formats: [
              //   {
              //     name: "webp",
              //     quality: 80,
              //     // name: "astc_5x5",
              //     // quality: "medium",
              //   },
              // ],
            };
          }
        });

        fs.writeFileSync(fullPath, JSON.stringify(json, null, 2));
        console.log(`Updated: ${fullPath}`);
      }
    }
  });
}

updateMetaFiles("D:/git/a1-client/A1-client/assets"); // 你项目资源的根路径

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

// javascript-obfuscator "D:/git/a1-client/A1-client/build/wechatgame/src/scripts/common/index.js" --output "D:/git/a1-client/A1-client/build/wechatgame/src/scripts/common/index-obfuscated.js" --compact true --control-flow-flattening true --control-flow-flattening-threshold 0.2 --dead-code-injection true --dead-code-injection-threshold 0.2 --string-array true --transform-object-keys true --self-defending true
// javascript-obfuscator "D:/git/a1-client/A1-client/build/wechatgame/src/scripts/excel/index.js" --output "D:/git/a1-client/A1-client/build/wechatgame/src/scripts/excel/index-obfuscated.js" --compact true --control-flow-flattening true --control-flow-flattening-threshold 0.2 --dead-code-injection true --dead-code-injection-threshold 0.2 --string-array true --transform-object-keys true --self-defending true
// javascript-obfuscator "D:/git/a1-client/A1-client/build/wechatgame/src/scripts/game/index.js" --output "D:/git/a1-client/A1-client/build/wechatgame/src/scripts/game/index-obfuscated.js" --compact true --control-flow-flattening true --control-flow-flattening-threshold 0.2 --dead-code-injection true --dead-code-injection-threshold 0.2 --string-array true --transform-object-keys true --self-defending true
// javascript-obfuscator "D:/git/a1-client/A1-client/build/wechatgame/src/scripts/main/index.js" --output "D:/git/a1-client/A1-client/build/wechatgame/src/scripts/main/index-obfuscated.js" --compact true --control-flow-flattening true --control-flow-flattening-threshold 0.2 --dead-code-injection true --dead-code-injection-threshold 0.2 --string-array true --transform-object-keys true --self-defending true
// javascript-obfuscator "D:/git/a1-client/A1-client/build/wechatgame/src/scripts/primary/index.js" --output "D:/git/a1-client/A1-client/build/wechatgame/src/scripts/primary/index-obfuscated.js" --compact true --control-flow-flattening true --control-flow-flattening-threshold 0.2 --dead-code-injection true --dead-code-injection-threshold 0.2 --string-array true --transform-object-keys true --self-defending true
// javascript-obfuscator "D:/git/a1-client/A1-client/build/wechatgame/src/scripts/resources/index.js" --output "D:/git/a1-client/A1-client/build/wechatgame/src/scripts/resources/index-obfuscated.js" --compact true --control-flow-flattening true --control-flow-flattening-threshold 0.2 --dead-code-injection true --dead-code-injection-threshold 0.2 --string-array true --transform-object-keys true --self-defending true
// javascript-obfuscator "D:/git/a1-client/A1-client/build/wechatgame/src/scripts/sound/index.js" --output "D:/git/a1-client/A1-client/build/wechatgame/src/scripts/sound/index-obfuscated.js" --compact true --control-flow-flattening true --control-flow-flattening-threshold 0.2 --dead-code-injection true --dead-code-injection-threshold 0.2 --string-array true --transform-object-keys true --self-defending true

// console.log(uuidv4());

// 尝试改变代码中的多语言函数
function tryChangeScript(keyword, newName, dirPath) {
  return new Promise(async (resolve, reject) => {
    const files = fs.readdirSync(dirPath); // 读取目录下的所有文件和文件夹

    for (let file of files) {
      const filePath = path.join(dirPath, file); // 文件的完整路径
      const stats = fs.statSync(filePath); // 获取文件信息

      // 如果是文件，则进行处理
      if (stats.isFile()) {
        // 后缀必须是.ts
        if (filePath.endsWith(".prefab") || filePath.endsWith(".fire")) {
          // 读取对应文本
          await new Promise((resolve2, reject2) => {
            // let data = fs.readFileSync(filePath, "utf-8");

            fs.readFile(filePath, "utf8", async (err, data) => {
              if (err) {
                console.error("errrr");
              }
              if (!data) {
                data = fs.readFileSync(filePath, "utf8");
              }
              if (!data) {
                console.error(filePath + "ERROR!!!!!");
                resolve2(false);
                return;
              }
              if (data.indexOf(keyword) === -1) {
                resolve2(true);
                return;
              }
              data = data.replaceAll(keyword, newName);

              // 文件写入
              fs.writeFile(filePath, data, (err) => {
                if (err) {
                  consloe.error(err);
                  resolve2(false);
                  return;
                }

                resolve2(true);
              });
            });
          });
        }
      } else if (stats.isDirectory()) {
        // 如果是文件夹，则递归调用函数继续读取文件夹内的文件
        await tryChangeScript(keyword, newName, filePath);
      }
    }
    resolve(true);
  });
}

// 换uuid
async function updatePngFiles(dir) {
  let files = fs.readdirSync(dir);
  for (let file of files) {
    const fullPath = path.join(dir, file);

    if (fs.statSync(fullPath).isDirectory()) {
      updatePngFiles(fullPath);
    } else if (file.endsWith(".meta")) {
      let fileName = file.replace(".png.meta", "");
      let content = fs.readFileSync(fullPath, "utf-8");
      let json = JSON.parse(content);

      let newUuid = uuidv4();
      let textUuid = uuidv4();

      // 针对图片资源
      if (
        json &&
        json.importer === "texture" &&
        json.subMetas &&
        json.subMetas[fileName]
      ) {
        // newUuid才是被外部引用的需要把老的uuid都替换掉
        let oldUuid = json.subMetas[fileName].uuid;
        json.subMetas[fileName].uuid = newUuid;
        json.subMetas[fileName].rawTextureUuid = textUuid;

        // 遍历全部路径下的场景或者预制体，更改老uuid
        await tryChangeScript(oldUuid, newUuid, targetDir);

        fs.writeFileSync(fullPath, JSON.stringify(json, null, 2));
        console.log(`Updated: ${fullPath}`);
      }
    }
  }
}

// // 获取当前运行目录
// const targetDir = "D:/git/a1-client/A1-client/assets";

// updatePngFiles(targetDir);
