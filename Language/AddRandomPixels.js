const fs = require("fs");
const path = require("path");
const Jimp = require("jimp");
const crypto = require("crypto");

// 仅支持 .jpg/.jpeg/.png
const SUPPORTED_EXT = [".jpg", ".jpeg", ".png"];

async function addRandomPixelsAndOverwrite(filePath, numPixels = 3) {
  try {
    const image = await Jimp.Jimp.read(filePath);
    const width = image.bitmap.width;
    const height = image.bitmap.height;

    for (let i = 0; i < numPixels; i++) {
      const x = Math.floor(Math.random() * width);
      const y = Math.floor(Math.random() * height);
      const r = Math.floor(Math.random() * 10);
      const g = Math.floor(Math.random() * 10);
      const b = Math.floor(Math.random() * 10);
      const color = Jimp.rgbaToInt(r, g, b, 255);
      image.setPixelColor(color, x, y);
    }

    await image.write(filePath);

    const md5 = crypto
      .createHash("md5")
      .update(fs.readFileSync(filePath))
      .digest("hex");
    console.log(`✅ 修改完成：${filePath}`);
    console.log(`🔑 新 MD5：${md5}`);
  } catch (err) {
    console.warn(`⚠️ 跳过（无法处理）：${filePath}`);
  }
}

async function processPath(targetPath, numPixels = 3) {
  const stat = fs.statSync(targetPath);

  if (stat.isFile()) {
    const ext = path.extname(targetPath).toLowerCase();
    if (targetPath.endsWith(".png") || targetPath.endsWith(".jdg")) {
      await addRandomPixelsAndOverwrite(targetPath, numPixels);
    } else {
      console.log(`⛔️ 跳过不支持的文件类型：${targetPath}`);
    }
  } else if (stat.isDirectory()) {
    const files = fs.readdirSync(targetPath);
    for (const file of files) {
      const fullPath = path.join(targetPath, file);
      await processPath(fullPath, numPixels);
    }
  }
}

// CLI 入口
const inputPath = "D://git//a1-client//A1-client//assets";
const pixelCount = 2;

processPath(inputPath, pixelCount);
