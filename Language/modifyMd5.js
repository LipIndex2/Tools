const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const Jimp = require("jimp");

function getFileMD5(path) {
  const fileBuffer = fs.readFileSync(path);
  return crypto.createHash("md5").update(fileBuffer).digest("hex");
}

function appendJunkAndCompareMD5(filePath) {
  try {
    const beforeMD5 = getFileMD5(filePath);
    console.log(`修改前 MD5：${beforeMD5}`);

    // 追加 junk 数据
    const junk = Buffer.from(
      `<!--md5-variant:${Math.random().toString(36).slice(2)}-->`
    );
    fs.appendFileSync(filePath, junk);

    const afterMD5 = getFileMD5(filePath);
    console.log(`修改后 MD5：${afterMD5}`);

    if (beforeMD5 === afterMD5) {
      console.log("❌ MD5 没有发生变化，可能追加数据失败或被忽略");
    } else {
      console.log("✅ MD5 成功发生变化，且文件未损坏");
    }
  } catch (err) {
    console.error(`❌ 发生错误：${err.message}`);
  }
}

async function processPath(targetPath) {
  const stat = fs.statSync(targetPath);

  if (stat.isFile()) {
    const ext = path.extname(targetPath).toLowerCase();
    if (targetPath.endsWith(".png") || targetPath.endsWith(".jdg")) {
      appendJunkAndCompareMD5(targetPath);
    } else {
      // console.log(`⛔️ 跳过不支持的文件类型：${targetPath}`);
    }
  } else if (stat.isDirectory()) {
    const files = fs.readdirSync(targetPath);
    for (const file of files) {
      const fullPath = path.join(targetPath, file);
      processPath(fullPath);
    }
  }
}

// const inputPath = "D://git//a1-client//A1-client//assets";
const inputPath = "D:/git/a1-client/A1-client/assets";

// 示例调用
processPath(inputPath);
