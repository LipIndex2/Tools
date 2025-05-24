const fs = require("fs");
const path = require("path");

const fileName = "AutoAtlas.pac";
const defaultContent = JSON.stringify({ __type__: "cc.SpriteAtlas" }, null, 4);
const imageExtensions = [".png", ".jpg", ".jpeg", ".webp"];

// 判断是否是图片文件
function isImageFile(fileName) {
  return imageExtensions.includes(path.extname(fileName).toLowerCase());
}

// 递归处理目录
function processDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  let hasAutoAtlas = false;
  let imageCount = 0;

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      processDirectory(fullPath);
    } else if (entry.isFile()) {
      if (entry.name === fileName) {
        hasAutoAtlas = true;
      } else if (isImageFile(entry.name)) {
        imageCount++;
      }
    }
  }

  if (!hasAutoAtlas && imageCount > 3) {
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, defaultContent, "utf8");
    console.log(
      `✅ 添加 AutoAtlas.pac 到目录: ${dir} （共 ${imageCount} 张图片）`
    );
  }
}

// 设置根目录（当前目录为例）
const rootDir = "D:/git/a2-client/A2-client/assets"; // 可替换为其他目录
processDirectory(rootDir);
