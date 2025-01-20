/*
 * @Author       : peng.li
 * @Date         : 2023-06-25 11:23:54
 * @LastEditors  : peng.li
 * @LastEditTime : 2023-12-24 13:41:03
 * @FilePath     : \vue_desktop\Language\ToLanguage.js
 * @Description  : 修改描述
 */

var fs = require("fs");
var path = require("path");
const { isString } = require("util");
const { console } = require("inspector/promises");
const crypto = require("crypto");

// 读取关卡数据
function readToJson(path) {
  const jsonString = fs.readFileSync(path, "utf8");
  if (jsonString.charCodeAt(0) === 0xfeff) {
    // Remove BOM from the jsonString
    return JSON.parse(jsonString.slice(1));
  }
  return JSON.parse(jsonString);
}

// 写入对应路径
function writeToJson(path, data) {
  const jsonStr = !isString(data) ? JSON.stringify(data) : data;

  // 添加 UTF-8 BOM
  const bom = Buffer.from("\uFEFF", "utf8");
  const dataWithBom = Buffer.concat([bom, Buffer.from(jsonStr, "utf8")]);

  // 写入文件
  fs.writeFileSync(path, dataWithBom);
}

// 识别是否有中文
function hasChineseCharacters(text) {
  if (!text) return false;
  var chineseRegex = /[\u4e00-\u9fff]/;
  return chineseRegex.test(text);
}

/**
 * 确保文件存在，如果不存在就创建它
 * @param {string} filePath - 文件路径
 */
function ensureFileExists(filePath) {
  const dir = path.dirname(filePath);

  // 确保目录存在
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // 确保文件存在
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "", "utf-8");
    console.log(`File created at: ${filePath}`);
  } else {
    console.log(`File already exists at: ${filePath}`);
  }
}

function checkUICXLabel(dirPath, copyFilesPathInfo) {
  return new Promise(async (resolve, reject) => {
    const files = fs.readdirSync(dirPath); // 读取目录下的所有文件和文件夹

    // 检查文件里面有没有.skel后缀文件，找到后开始找.png和.atlas文件
    for (let file of files) {
      const filePath = path.join(dirPath, file); // 文件的完整路径
      const stats = fs.statSync(filePath); // 获取文件信息

      if (filePath.endsWith(".meta")) continue;

      // 如果是文件，则进行处理
      if (stats.isFile()) {
        if (hasChineseCharacters(file)) continue;
        if (filePath.endsWith(".png") || filePath.endsWith(".jpg")) {
          const md5_1 = calculateMD5(filePath);

          // 根据文件名称筛选指定路径图片,如果没有返回这个图片路径
          let result = await checkCcsImage(
            "D:/cocosProject/xb-client/xibu3/assets/textures",
            md5_1
          );
          if (!result) {
            result = await checkCcsImage(
              "D:/cocosProject/xb-client/xibu3/assets/resources/images",
              md5_1
            );
          }
          if (!result) {
            copyFilesPathInfo[file] = filePath.replaceAll("\\", "/");
          }
        }
      } else if (stats.isDirectory()) {
        // 如果是文件夹，则递归调用函数继续读取文件夹内的文件
        await checkUICXLabel(filePath, copyFilesPathInfo);
      }
    }
    resolve(true);
  });
}

function checkCcsImage(dirPath, md5String) {
  return new Promise(async (resolve, reject) => {
    const files = fs.readdirSync(dirPath); // 读取目录下的所有文件和文件夹

    // 检查文件里面有没有.skel后缀文件，找到后开始找.png和.atlas文件
    for (let file of files) {
      const filePath = path.join(dirPath, file); // 文件的完整路径
      const stats = fs.statSync(filePath); // 获取文件信息

      if (filePath.endsWith(".meta") || hasChineseCharacters(file)) continue;

      // 如果是文件，则进行处理
      if (stats.isFile()) {
        if (calculateMD5(filePath) === md5String) {
          resolve(true);
        }
      } else if (stats.isDirectory()) {
        // 如果是文件夹，则递归调用函数继续读取文件夹内的文件
        let result = await checkCcsImage(filePath, md5String);
        if (result) {
          resolve(true);
          return;
        }
      }
    }
    resolve(false);
  });
}

function calculateMD5(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash("md5");
    hashSum.update(fileBuffer);
    return hashSum.digest("hex");
  } catch (err) {
    return null;
  }
}

var spineCollectPathInfo = {};
var rootPath = "D:/美术doc/AAAAA船新版本美术资源/船新UI2.0";

var curTime = Date.now();

// 先收集替换的文件路径
checkUICXLabel(rootPath, spineCollectPathInfo).then(async (result) => {
  let arr = [];

  const pathJson = "C:/Users/Public/Config/UnUseImage.json";
  ensureFileExists(pathJson);

  writeToJson(pathJson, spineCollectPathInfo);
  console.log(spineCollectPathInfo);
  console.log("一共用时:" + (Date.now() - curTime) / 1000 + "秒");
  // changeSpine("D:/ccs/wjszm-c/assets/res", spineCollectPathInfo);
});

// 使用node运行 测试代码
// var config = {
//     "path": "C:\\MWEditor\\MetaWorldSaved\\Saved\\MetaWorld\\Project\\Edit\\totalmetadramacamp",
//     "prefix": "CUtils.getLanguage",
//     "excelPath": "C:\\MWEditor\\MetaWorldSaved\\Saved\\MetaWorld\\Project\\Edit\\totalmetadramacamp\\Excel",
//     "languageExcelName": "Language_多语言.xlsx"
// };
// run(console.log, console.error, config.prefix, config.path, config.excelPath, config.languageExcelName);

module.exports = {};

// let signPath = "C:\\Users\\admin\\AppData\\MetaApp\\Editor_Win64\\MetaWorldSaved\\Saved\\MetaWorld\\Project\\Edit\\jellyrun\\jellyrun\\Excel\\SignIn_签到表.xlsx"
// // 读取 Excel 文件
// workbook.xlsx.readFile(signPath)
//     .then(() => {
//         // 读取第一个工作表
//         const worksheet = workbook.getWorksheet(1);

//         worksheet.sheetData
//         worksheet.getCell(6, 1).value = 9;
//         worksheet.getCell(14, 1).value = 94;

//         workbook.xlsx.writeFile(signPath);
//     })
//     .catch(err => {
//         // 处理读取文件时出现的错误
//         console.error('Error reading file:', err);
//     });
