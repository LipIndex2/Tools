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
        if (
          filePath.endsWith('.prefab') ||
          filePath.endsWith('.fire') ||
          filePath.endsWith('.anim') ||
          filePath.endsWith('.plist') ||
          filePath.endsWith('.anim') ||
          filePath.endsWith('.atlas') ||
          filePath.endsWith('.json') ||
          filePath.endsWith('.particle') ||
          filePath.endsWith('.effect') ||
          filePath.endsWith('.mtl') ||
          filePath.endsWith('.material') ||
          filePath.endsWith('.tmx') ||
          filePath.endsWith('.tsx')
        ) {
          // 读取对应文本
          await new Promise((resolve2, reject2) => {
            // let data = fs.readFileSync(filePath, "utf-8");

            fs.readFile(filePath, 'utf8', async (err, data) => {
              // await sleep(100);
              if (err) {
                console.error('errrr');
              }
              if (!data) {
                data = fs.readFileSync(filePath, 'utf8');
              }
              if (!data) {
                console.error(filePath + 'ERROR!!!!!');
                return resolve2(false);
              }
              if (data.indexOf(keyword) === -1) {
                return resolve2(true);
              }
              // await sleep(100);
              data = data.replaceAll(keyword, newName);

              // 文件写入
              await fs.writeFileSync(filePath, data);
              // await sleep(100);
              return resolve2(true);
            });
          });

          // console.log('ded');
        }
      } else if (stats.isDirectory()) {
        // 如果是文件夹，则递归调用函数继续读取文件夹内的文件
        await tryChangeScript(keyword, newName, filePath);
      }
    }
    return resolve(true);
  });
}

var newuuidToOlduuidMap = {};

// 换uuid
async function updatePngFiles(dir) {
  return new Promise(async (resolve, reject) => {
    let files = fs.readdirSync(dir);
    for (let file of files) {
      const fullPath = path.join(dir, file);

      if (fs.statSync(fullPath).isDirectory()) {
        await updatePngFiles(fullPath);
      } else if (file.endsWith('.meta')) {
        let fileName = file.replace('.png.meta', '');
        let content = fs.readFileSync(fullPath, 'utf-8');
        let json = JSON.parse(content);

        let newUuid = uuidv4();
        let textUuid = uuidv4();

        // 针对图片资源
        if (json && json.importer === 'texture' && json.subMetas && json.subMetas[fileName]) {
          // newUuid才是被外部引用的需要把老的uuid都替换掉
          let oldUuid = json.subMetas[fileName].uuid;
          json.subMetas[fileName].uuid = newUuid;
          json.subMetas[fileName].rawTextureUuid = textUuid;

          newuuidToOlduuidMap[oldUuid] = newUuid;

          await fs.writeFileSync(fullPath, JSON.stringify(json, null, 2));
          // await sleep(100);

          // 遍历全部路径下的场景或者预制体，更改老uuid
          await tryChangeScript(oldUuid, newUuid, 'D:/git/a2-client/A2-client/assets');
          // await sleep(100);

          console.log(`Updated: ${fullPath}`);
        }
      }
    }
    resolve(newuuidToOlduuidMap);
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 检查遗漏的uuid
 */
async function checkOmitUuid(n2oMap) {
  for (let oldUuid in n2oMap) {
    // 全局搜索文件中是否有olduuid
    await tryChangeScript(oldUuid, n2oMap[oldUuid], 'D:/git/a2-client/A2-client/assets');
  }

  await sleep(200);

  for (let oldUuid in n2oMap) {
    // 全局搜索文件中是否有olduuid
    await tryChangeScript(oldUuid, n2oMap[oldUuid], 'D:/git/a2-client/A2-client/assets');
  }

  await sleep(200);

  for (let oldUuid in n2oMap) {
    // 全局搜索文件中是否有olduuid
    await tryChangeScript(oldUuid, n2oMap[oldUuid], 'D:/git/a2-client/A2-client/assets');
  }
  await sleep(200);

  for (let oldUuid in n2oMap) {
    // 全局搜索文件中是否有olduuid
    await tryChangeScript(oldUuid, n2oMap[oldUuid], 'D:/git/a2-client/A2-client/assets');
  }

  await sleep(200);

  for (let oldUuid in n2oMap) {
    // 全局搜索文件中是否有olduuid
    await tryChangeScript(oldUuid, n2oMap[oldUuid], 'D:/git/a2-client/A2-client/assets');
  }
}

// // 获取当前运行目录
// const targetDir = "D:/git/a1-client/A1-client/assets";
// const targetDir = 'D:/git/a2-client/A2-client/assets';
// const targetDir = 'D:/git/a2-client/A2-client/assets';

// updatePngFiles(targetDir).then(n2oMap => {
//   checkOmitUuid(n2oMap);
// });
