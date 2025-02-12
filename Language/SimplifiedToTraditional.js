/*
 * @Author       : peng.li
 * @Date         : 2023-06-25 11:23:54
 * @LastEditors  : peng.li
 * @LastEditTime : 2023-12-24 13:41:03
 * @FilePath     : \vue_desktop\Language\ToLanguage.js
 * @Description  : 修改描述
 */

var fs = require("fs");
var flock = require("proper-lockfile");
var path = require("path");
const { isString } = require("util");
const ExcelJS = require("exceljs");
const { console } = require("inspector/promises");

const OpenCC = require("node-opencc");

// 创建一个新的工作簿对象
const workbook = new ExcelJS.Workbook();

// 获取当前文件所在目录的完整路径
var currentDirectoryPath = process.argv.slice(2) + "/";
var pathJson = __dirname + "/LanguageConfig.json";
var pathZ = currentDirectoryPath.replace("Language", "") + "JavaScripts";
var pahtExcel =
  currentDirectoryPath.replace("Language", "") +
  "Excels/Language_多语言表.xlsx";
var pathUI = currentDirectoryPath.replace("Language", "") + "UI";
var pathAllExcel = currentDirectoryPath.replace("Language", "") + "Excels";
var callBack = null;

// 需要收集的文件后缀
const canCollectSuffix = [".skel", ".atlas", ".png"];

// 脚本前缀
var prefix = "LanUtil.getLanguage";

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

// 尝试改变代码中的简体字
function tryChangeScript(dirPath) {
  return new Promise(async (resolve, reject) => {
    const files = fs.readdirSync(dirPath); // 读取目录下的所有文件和文件夹

    for (let file of files) {
      const filePath = path.join(dirPath, file); // 文件的完整路径
      const stats = fs.statSync(filePath); // 获取文件信息

      // 如果是文件，则进行处理
      if (stats.isFile()) {
        // 后缀必须是.ts
        if (!filePath.endsWith(".ts") && !filePath.endsWith(".xml")) continue;

        if (file.indexOf("package.xml") !== -1) continue;

        // 读取对应文本
        await new Promise((resolve2, reject2) => {
          let cb = (coding) => {
            fs.readFile(filePath, coding, async (err, data) => {
              if (err) {
                consoleError(err);

                // 如果当前是utf16le格式，那就不用再试了
                if (coding === "utf8") {
                  cb("utf16le");
                  return;
                } else {
                  return resolve2(false);
                }
              }

              // 检查data中是否有中文
              if (!hasChineseCharacters(data)) return resolve2(false);

              // // 去掉注释
              // const cleanContent = strip(content);

              // // 检查data中是否有中文
              // if (!hasChineseCharacters(cleanContent)) return resolve2(false);

              // 改成繁体
              const traditionalData = OpenCC.simplifiedToTraditional(data);

              // 文件写入
              fs.writeFile(filePath, traditionalData, (err) => {
                if (err) {
                  consoleError(err);
                  resolve2(false);
                  return;
                }

                resolve2(true);
              });
            });
          };

          // 先试试utf8
          cb("utf8");
        });
      } else if (stats.isDirectory()) {
        // 如果是文件夹，则递归调用函数继续读取文件夹内的文件
        await tryChangeScript(filePath);
      }
    }
    resolve(true);
  });
}

// 识别是否有中文
function hasChineseCharacters(text) {
  var chineseRegex = /[\u4e00-\u9fff]/;
  return chineseRegex.test(text);
}

function tryToJson(dirPath) {
  return new Promise(async (resolve, reject) => {
    const files = fs.readdirSync(dirPath); // 读取目录下的所有文件和文件夹

    for (let file of files) {
      const filePath = path.join(dirPath, file); // 文件的完整路径
      const stats = fs.statSync(filePath); // 获取文件信息

      // 如果是文件，则进行处理
      if (stats.isFile()) {
        // meta文件不处理
        if (filePath.indexOf(".meta") !== -1) continue;
        // 读取对应文本
        await new Promise((resolve2, reject2) => {
          // 读取 Excel 文件
          workbook.xlsx
            .readFile(filePath)
            .then(async () => {
              // 是否有Language_多语言表
              if (!fs.existsSync(filePath)) {
                console.error("Error reading file 1:" + filePath);
                resolve2(false);
                return;
              }

              let writeJson = {};

              workbook.eachSheet((worksheet, sheetId) => {
                writeJson[worksheet.name] = [];

                // 开始读取
                const rowArr = worksheet.getRow(1).values;
                let curTime = Date.now();

                worksheet.eachRow((row, rowNumber) => {
                  if (rowNumber === 1 || rowNumber === 2 || rowNumber === 3) {
                    return;
                  }
                  let jsonData = {};
                  let values2 = worksheet.getRow(2).values;
                  for (let i = 2; i < values2.length; i++) {
                    jsonData[values2[i]] = null;
                  }
                  let arr = [];
                  for (let i = 2; i < row.values.length; i++) {
                    if (rowArr[i] === "number") {
                      arr.push(row.values[i]);
                    } else {
                      if (
                        typeof row.values[i] == "string" &&
                        (row.values[i][0] == "{" || row.values[i][0] == "[")
                      ) {
                        let resTra = hasChineseCharacters(row.values[i])
                          ? OpenCC.simplifiedToTraditional(row.values[i])
                          : row.values[i];
                        row.getCell(i).value = resTra;
                        arr.push(JSON.parse(resTra));
                      } else {
                        let resTra = hasChineseCharacters(row.values[i])
                          ? OpenCC.simplifiedToTraditional(row.values[i])
                          : row.values[i];
                        row.getCell(i).value = resTra;
                        arr.push(resTra);
                      }
                    }
                  }

                  let indexLog = 0;
                  for (let rowKey in jsonData) {
                    jsonData[rowKey] = arr[indexLog];
                    indexLog += 1;
                  }
                  writeJson[worksheet.name].push(jsonData);
                });
                // console.log("endTime：" + (Date.now() - curTime)/ 1000);
              });

              // 写入
              workbook.xlsx
                .writeFile(filePath)
                .then(() => {
                  // const writeFilePath =
                  //   // __dirname.split("tools")[0] +
                  //   "D:\\ccs2\\wjszm-c\\" +
                  //   "assets\\resources" +
                  //   "\\config" +
                  //   filePath.split(dirPath)[1].split("\\" + file)[0] +
                  //   "\\" +
                  //   file.split(".xlsx")[0] +
                  //   ".json";
                  // const jsonStr = !isString(writeJson)
                  //   ? JSON.stringify(writeJson)
                  //   : writeJson;

                  // // 添加 UTF-8 BOM
                  // const bom = Buffer.from("\uFEFF", "utf8");
                  // const dataWithBom = Buffer.concat([
                  //   bom,
                  //   Buffer.from(jsonStr, "utf8"),
                  // ]);

                  // console.log(filePath);

                  // // 文件写入
                  // fs.writeFile(writeFilePath, dataWithBom, (err) => {
                  //   if (err) {
                  //     console.error(err);
                  //     resolve2(false);
                  //     return;
                  //   }
                  resolve2(true);
                  // });
                })
                .catch((error) => {
                  console.error("Error creating file:", error);
                  resolve2(true);
                });
            })
            .catch((err) => {
              // 处理读取文件时出现的错误
              console.error("Error reading file 2:" + err);
            });
        });
      } else if (stats.isDirectory()) {
        await tryToJson(filePath);
      }
    }
    resolve(true);
  });
}

var consoleLog;

// ---------------------------------------------------------------执行逻辑分割线---------------------------------------------------------------------

function run() {
  // tryChangeScript("D:\\ccs2\\wjszm-c\\assets\\script").then(() => {
  var checkPath =
    "D:\\ccs2\\wjszm-c\\" + "assets\\resources" + "\\excel_config";
  tryToJson(checkPath).then(() => {
    console.log("完成");
  });
  // });

  // tryChangeScript("D:\\ccs2\\wjszm-c\\FairyGUIPrj\\assets").then(() => {
  //   // var checkPath =
  //   //   "D:\\ccs2\\wjszm-c\\" + "assets\\resources" + "\\excel_config";
  //   // tryToJson(checkPath).then(() => {
  //   console.log("完成");
  //   // });
  // });
}
run();

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
