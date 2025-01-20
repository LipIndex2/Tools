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
const xml2js = require("xml2js");

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

/**
 * 生成下一个id
 */
function genLocalizeId() {
  let languageConfig = readToJson(pathJson);
  languageConfig.genId += 1;
  writeToJson(pathJson, languageConfig);
  return languageConfig.genId;
}

// 尝试改变代码中的多语言函数
function tryChangeScript(dirPath, outResult = {}) {
  return new Promise(async (resolve, reject) => {
    const files = fs.readdirSync(dirPath); // 读取目录下的所有文件和文件夹

    for (let file of files) {
      // 如果是ui-generate跳过
      if (file.indexOf("ui-generate") !== -1) {
        continue;
      }

      const filePath = path.join(dirPath, file); // 文件的完整路径
      const stats = fs.statSync(filePath); // 获取文件信息

      // 如果是文件，则进行处理
      if (stats.isFile()) {
        // 后缀必须是.ts
        if (!filePath.endsWith(".ts")) continue;
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

              if (data.indexOf("(") === -1) return resolve2(false);

              // 找出代码中所有的调用_LC的函数
              const matchArr = data.match(
                new RegExp(`${prefix}\\([^)]+\\)`, "g")
              );
              if (matchArr) {
                // "LanUtil.getLanguage("内容")";
                for (let needChangeContext of matchArr) {
                  let nextId;

                  // 筛选出带双引号的文本
                  const regex = /"([^"]*)"/g;

                  // 单引号
                  const onlyRegex = /'([^"]*)'/g;

                  // 反引号
                  const backRegex = /`([^"]*)`/g;

                  // 取出内容
                  var matches = needChangeContext.match(regex);
                  if (!matches) {
                    matches = needChangeContext.match(onlyRegex);
                    if (!matches) {
                      matches = needChangeContext.match(backRegex);
                    }
                  }

                  // 这里报错一下
                  if (!matches) {
                    consoleError(
                      "内容匹配失败，本次收集只替换单引号和双引号！！！path: " +
                        filePath +
                        "  内容：" +
                        needChangeContext
                    );
                    consoleLog("程序会先跳过这个文件,继续执行....", "pick");
                    continue;
                  }

                  const result = matches.map((match) => match.slice(1, -1));

                  // 有没有中文就跳过  如果不是Language表里面的key，那还是要收集
                  if (
                    !hasChineseCharacters(result[0]) &&
                    checkLanguageKey(result[0])
                  )
                    continue;

                  // 如果表中有这个一样的内容，直接延用之前的内容
                  let resultCfg = checkLanguage(result[0]);
                  if (resultCfg) {
                    // 如果代码中有"LanUtil.getLanguage(" 这种的， 直接替换 单双引号都要替换
                    data = data.replace(
                      `${prefix}(\"` + result[0] + '")',
                      `${prefix}(\"` + resultCfg.key + '")'
                    );
                    data = data.replace(
                      `${prefix}(\'` + result[0] + "')",
                      `${prefix}(\"` + resultCfg.key + '")'
                    );
                    data = data.replace(
                      `${prefix}(\`` + result[0] + "`)",
                      `${prefix}(\"` + resultCfg.key + '")'
                    );
                  } else {
                    let isChange = false;
                    result[0] = result[0].replace(/\r\n/g, "\n");
                    for (let id in outResult) {
                      if (outResult[id] === result[0]) {
                        isChange = true;
                        nextId = id;
                      }
                    }

                    // 没有改变
                    if (!isChange) {
                      // 生成下一个id
                      nextId = genLocalizeId();

                      // 设置内容
                      outResult[nextId] = result[0];
                    }

                    // 如果代码中有"LanUtil.getLanguage(" 这种的， 直接替换 单双引号都要替换
                    data = data.replace(
                      `${prefix}(\"` + result[0] + '")',
                      `${prefix}(\"` + "STL_" + nextId + '")'
                    );
                    data = data.replace(
                      `${prefix}(\"` + result[0] + "')",
                      `${prefix}(\"` + "STL_" + nextId + '")'
                    );
                  }
                }
              }

              // 文件写入
              fs.writeFile(filePath, data, (err) => {
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
        await tryChangeScript(filePath, outResult);
      }
    }
    resolve(true);
  });
}

// 尝试改变UI中的多语言
function tryChangeUI(dirPath, outResult = {}) {
  return new Promise(async (resolve, reject) => {
    const files = fs.readdirSync(dirPath); // 读取目录下的所有文件和文件夹

    for (let file of files) {
      const filePath = path.join(dirPath, file); // 文件的完整路径
      const stats = fs.statSync(filePath); // 获取文件信息

      // 如果是文件，则进行处理
      if (stats.isFile()) {
        // 后缀必须是.ui
        if (!filePath.endsWith(".ui")) continue;
        // 读取对应文本
        await new Promise((resolve2, reject2) => {
          let cb = (coding) => {
            fs.readFile(filePath, coding, async (err, data) => {
              if (err) {
                consoleError(err);

                // 如果当前是utf16le格式，那就不用再试了
                if (coding === "utf8") {
                  cb("utf-16le");
                  return;
                } else {
                  return resolve2(false);
                }
              }

              if (!data) {
                resolve2(false);
                return;
              }

              let isChange = false;

              // 递归遍历
              let repCb = (forData) => {
                for (let key in forData) {
                  if (key === "Text") {
                    // 如果发现有中文
                    if (hasChineseCharacters(forData[key])) {
                      // 如果表中有这个一样的内容，直接延用之前的内容
                      let result = checkLanguage(forData[key]);
                      let uiKey = "";
                      if (result) {
                        uiKey = result.key;
                      } else {
                        let isContentChange = false;
                        forData[key] = forData[key].replace(/\r\n/g, "\n");
                        for (let id in outResult) {
                          if (outResult[id] === forData[key]) {
                            isContentChange = true;
                            uiKey = "UTL_" + id;
                          }
                        }

                        // 没有改变
                        if (!isContentChange) {
                          // 收集文本，并且生成唯一key值
                          let nextId = genLocalizeId();
                          uiKey = "UTL_" + nextId;
                          outResult[nextId] = forData[key];
                        }
                      }
                      forData[key] = uiKey;
                      isChange = true;
                    }
                  } else if (typeof forData[key] === "object") {
                    repCb(forData[key]);
                  }
                }
              };

              let inputData;
              if (data.charCodeAt(0) === 0xfeff) {
                // Remove BOM from the jsonString
                inputData = JSON.parse(data.slice(1));
              } else {
                try {
                  inputData = JSON.parse(data);
                } catch (err) {
                  cb("utf-16le");
                  return;
                }
              }

              repCb(inputData);
              if (isChange) {
                const jsonStr = !isString(inputData)
                  ? JSON.stringify(inputData)
                  : inputData;

                // 添加 UTF-8 BOM
                const bom = Buffer.from("\uFEFF", "utf8");
                const dataWithBom = Buffer.concat([
                  bom,
                  Buffer.from(jsonStr, "utf8"),
                ]);

                // 文件写入
                fs.writeFile(filePath, dataWithBom, (err) => {
                  if (err) {
                    consoleError(err);
                    resolve2(false);
                    return;
                  }
                  resolve2(true);
                });
              } else {
                resolve2(true);
              }
            });
          };

          // 先试试utf8
          try {
            cb("utf8");
          } catch (err) {
            cb("utf-16le");
          }
        });
      } else if (stats.isDirectory()) {
        // 如果是文件夹，则递归调用函数继续读取文件夹内的文件
        await tryChangeUI(filePath, outResult);
      }
    }
    resolve(true);
  });
}

// 尝试改变Excel中的多语言
function tryChangeExcel(dirPath, outResult = {}) {
  return new Promise(async (resolve, reject) => {
    const files = fs.readdirSync(dirPath); // 读取目录下的所有文件和文件夹

    for (let file of files) {
      const filePath = path.join(dirPath, file); // 文件的完整路径
      const stats = fs.statSync(filePath); // 获取文件信息

      // 如果是文件，则进行处理
      if (stats.isFile()) {
        // 后缀必须是.xlsx
        if (!filePath.endsWith(".xlsx")) continue;
        // 读取对应文本
        await new Promise((resolve2, reject2) => {
          if (filePath == pahtExcel) {
            return reject2(true);
          }

          workbook.xlsx
            .readFile(filePath)
            .then(() => {
              const worksheet = workbook.getWorksheet(1);

              const sheetData = worksheet.getSheetValues();
              let isChange = false;
              let chineseIndex = 0;
              const chineseSubfix = "中文备注";

              // 如果第4个有Language标注
              for (
                let index = 0;
                index < sheetData[2 + 1].length - 1;
                index++
              ) {
                if (!sheetData[3 + 1]) continue;
                let title = sheetData[3 + 1][index + 1];
                if (title === "Language") {
                  chineseIndex += 1;

                  // 如果有这个中文备注，直接赋值
                  let perfixC = "第" + index + "行的" + chineseSubfix;
                  let indexFind = sheetData[2 + 1].indexOf(perfixC);
                  let cIndex;
                  if (indexFind !== -1) {
                    // 不用加标题
                    cIndex = indexFind;
                  } else {
                    worksheet.getCell(2 + 1, sheetData[2].length).value =
                      perfixC;
                    cIndex = sheetData[2].length;
                  }

                  // 发现了标题为Language的列
                  for (let line = 4; line < sheetData.length - 1; line++) {
                    if (!sheetData[line + 1]) continue;
                    let content = sheetData[line + 1][index + 1];

                    // 备注
                    let remark;

                    // 如果是中文
                    if (hasChineseCharacters(content)) {
                      // 如果表中有这个一样的内容，直接延用之前的内容
                      let uiKey = "";
                      let result = checkLanguage(content);
                      remark = content;
                      if (result) {
                        uiKey = result.key;
                        remark = result.value;
                      } else {
                        let isContentChange = false;
                        const realContent = sheetData[line + 1][
                          index + 1
                        ].replace(/\r\n/g, "\n");
                        for (let id in outResult) {
                          if (outResult[id] === realContent) {
                            isContentChange = true;
                            uiKey = "ETL_" + id;
                          }
                        }

                        // 没有改变
                        if (!isContentChange) {
                          // 记录内容，更改内容
                          let nextId = genLocalizeId();
                          uiKey = "ETL_" + nextId;
                          outResult[nextId] = realContent;
                        }
                      }
                      worksheet.getCell(line + 1, index + 1).value = uiKey;
                      isChange = true;
                    } else {
                      let resultByKey = checkLanguageKey(content);
                      if (resultByKey) {
                        remark = resultByKey.value;
                      }
                    }

                    // 添加备注
                    if (remark) {
                      isChange = true;
                      worksheet.getCell(line + 1, cIndex).value = remark;
                    }
                  }
                }
              }

              // 改变了就写入
              if (isChange) {
                consoleLog(filePath);
                workbook.xlsx.writeFile(filePath).then(() => {
                  resolve2(true);
                });
              } else {
                resolve2(true);
              }
            })
            .catch((err) => {
              consoleError(err);
              resolve2(false);
            });
        });
      } else if (stats.isDirectory()) {
        // 如果是文件夹，则递归调用函数继续读取文件夹内的文件
        await tryChangeExcel(filePath, outResult);
      }
    }
    resolve(true);
  });
}

// 替换Language标识
function tryReplaceTagExcel(dirPath) {
  return new Promise(async (resolve, reject) => {
    const files = fs.readdirSync(dirPath); // 读取目录下的所有文件和文件夹

    for (let file of files) {
      const filePath = path.join(dirPath, file); // 文件的完整路径
      const stats = fs.statSync(filePath); // 获取文件信息

      // 如果是文件，则进行处理
      if (stats.isFile()) {
        // 后缀必须是.xlsx
        if (!filePath.endsWith(".xlsx")) continue;
        // 读取对应文本
        await new Promise((resolve2, reject2) => {
          if (filePath == pahtExcel) {
            return reject2(true);
          }

          workbook.xlsx
            .readFile(filePath)
            .then(() => {
              const worksheet = workbook.getWorksheet(1);

              const sheetData = worksheet.getSheetValues();
              let isChange = false;

              // 如果第4个有Language标注
              for (
                let index = 0;
                index < sheetData[2 + 1].length - 1;
                index++
              ) {
                if (!sheetData[3 + 1]) continue;
                let title = sheetData[3 + 1][index + 1];
                if (title === "Language") {
                  worksheet.getCell(3 + 1, index + 1).value = "LanguageCollect";
                  isChange = true;
                }
              }

              // 改变了就写入
              if (isChange) {
                consoleLog(filePath);
                workbook.xlsx.writeFile(filePath).then(() => {
                  resolve2(true);
                });
              } else {
                resolve2(true);
              }
            })
            .catch((err) => {
              consoleError(err);
              resolve2(false);
            });
        });
      } else if (stats.isDirectory()) {
        // 如果是文件夹，则递归调用函数继续读取文件夹内的文件
        await tryChangeExcel(filePath);
      }
    }
    resolve(true);
  });
}

// 创建正则表达式，使用捕获组括号 ()
const regexContent = new RegExp("GameConfig\\.Language\\.\\w+\\.\\w+", "g");

// 尝试改变代码中的多语言函数
function tryReplaceScript(dirPath) {
  return new Promise(async (resolve, reject) => {
    const files = fs.readdirSync(dirPath); // 读取目录下的所有文件和文件夹

    for (let file of files) {
      // 如果是ui-generate跳过
      if (file.indexOf("ui-generate") !== -1) {
        continue;
      }

      const filePath = path.join(dirPath, file); // 文件的完整路径
      const stats = fs.statSync(filePath); // 获取文件信息

      // 如果是文件，则进行处理
      if (stats.isFile()) {
        // 后缀必须是.ts
        if (!filePath.endsWith(".ts")) continue;
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

              // 找出代码中所有的调用_LC的函数
              const matchArr = data.match(regexContent);
              if (matchArr) {
                // "LanUtil.getLanguage("内容")";
                for (let needChangeContext of matchArr) {
                  // 筛选出带双引号的文本
                  const regex = /GameConfig\.Language\.(\w+)\.Value/;

                  // 取出内容
                  const result = needChangeContext.match(regex)[1];

                  data = data.replace(
                    `GameConfig.Language.${result}.Value`,
                    `${prefix}(\"` + result + '")'
                  );
                }
              } else {
                // 单引号
                const singleQuote = new RegExp(
                  "GameConfig\\.Language\\.getElement\\('([^']+)'\\)\\.Value",
                  "g"
                );

                // 双引号
                const doubleQuote = new RegExp(
                  'GameConfig\\.Language\\.getElement\\("([^"]+)"\\)\\.Value',
                  "g"
                );

                // 反引号
                const backQuote = new RegExp(
                  "GameConfig\\.Language\\.getElement\\(`([^`]+)`\\)\\.Value",
                  "g"
                );

                let matchArr = data.match(singleQuote);
                if (!matchArr) {
                  matchArr = data.match(doubleQuote);
                  if (!matchArr) {
                    matchArr = data.match(backQuote);
                  }
                }

                if (matchArr) {
                  for (let needChangeContext of matchArr) {
                    // 筛选出带双引号的文本
                    const singleRegex =
                      "GameConfig\\.Language\\.getElement\\('([^']+)'\\)\\.Value";

                    // 双引号
                    const doubleRegex =
                      'GameConfig\\.Language\\.getElement\\("([^"]+)"\\)\\.Value';

                    // 反引号
                    const backRegex =
                      "GameConfig\\.Language\\.getElement\\(`([^`]+)`\\)\\.Value";

                    // 取出内容
                    let matchContent = needChangeContext.match(singleRegex);
                    if (!matchContent) {
                      matchContent = needChangeContext.match(doubleRegex);
                      if (!matchContent) {
                        matchContent = needChangeContext.match(backRegex);
                      }
                    }

                    const result = matchContent[1];

                    data = data.replace(
                      `GameConfig.Language.getElement(\"` + result + '").Value',
                      `${prefix}(\"` + result + '")'
                    );
                    data = data.replace(
                      `GameConfig.Language.getElement(\'` + result + "').Value",
                      `${prefix}(\"` + result + '")'
                    );
                    data = data.replace(
                      `GameConfig.Language.getElement(\`` + result + "`).Value",
                      `${prefix}(\"` + result + '")'
                    );
                  }
                }
              }

              // 文件写入
              fs.writeFile(filePath, data, (err) => {
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

// 初始化当前的id
function initLanguageId() {
  return new Promise((resolve, reject) => {
    workbook.xlsx
      .readFile(pahtExcel)
      .then(() => {
        // 读取第一个工作表
        const worksheet = workbook.getWorksheet(1);

        // 代码中编号对应的内容替换表中的
        let info = {};
        const sheetValues = worksheet.getSheetValues();

        let id = 0;
        sheetValues.forEach((context, index) => {
          if (context[1] && typeof context[1] === "number" && context[1] > id) {
            id = context[1];
          }
        });

        let languageConfig = readToJson(pathJson);
        languageConfig.genId = id;
        writeToJson(pathJson, languageConfig);
        resolve(true);
      })
      .catch((err) => {
        // 处理读取文件时出现的错误
        consoleError("Error reading file 4:" + err);
        resolve(false);
      });
  });
}

// 写入Language表
function wirteToLanguage(keyPrefix, result, isEnd = false) {
  return new Promise((resolve, reject) => {
    workbook.xlsx
      .readFile(pahtExcel)
      .then(() => {
        // 读取第一个工作表
        const worksheet = workbook.getWorksheet(1);

        // 代码中编号对应的内容替换表中的
        let info = {};
        const sheetValues = worksheet.getSheetValues();
        for (let index = 4; index < sheetValues.length - 1; index++) {
          let context = sheetValues[index + 1];
          if (!context) continue;
          info[context[1]] = context;
        }

        // 找到中文翻译的索引
        let chineseIndex = sheetValues[2 + 1].findIndex(
          (value) => value && value.indexOf("中文") !== -1
        );
        if (chineseIndex === -1) {
          consoleError("没有找到中文备注，请检查！！！");
          return;
        }
        for (let idx in result) {
          if (info[idx]) {
            info[idx][chineseIndex - 1] = result[idx];
          } else {
            let key = keyPrefix + idx;
            let arr = [+idx, key, "", ""];
            arr[chineseIndex - 1] = result[idx];
            worksheet.addRow(arr);
          }
        }

        workbook.xlsx.writeFile(pahtExcel).then(() => {
          if (!isEnd) {
            consoleLog("写入表格成功，还没有结束，请等待。。。");
          } else {
            consoleLog("当前项目收集结束，等待其他项目收集", "green");
          }
          resolve(true);
        });
      })
      .catch((err) => {
        // 处理读取文件时出现的错误
        consoleError("Error reading file 5:" + err);
        resolve(false);
      });
  });
}

// 1: {id: 1, key: UI_1001, value: "你好"}
var languageConfigData = {};

// 读Language表
async function readLanguage() {
  return new Promise((resolve, reject) => {
    workbook.xlsx
      .readFile(pahtExcel)
      .then(() => {
        // 读取第一个工作表
        const worksheet = workbook.getWorksheet(1);

        // 代码中编号对应的内容替换表中的
        const sheetValues = worksheet.getSheetValues();

        sheetValues.forEach((context, index) => {
          if (typeof context[1] === "number") {
            let chineaseIndex = context.findIndex((value) =>
              hasChineseCharacters(value)
            );
            languageConfigData[context[1]] = {
              id: context[1],
              key: context[2],
              value: chineaseIndex !== -1 ? context[chineaseIndex] : context[4],
            };
          }
        });
        resolve(true);
      })
      .catch((err) => {
        // 处理读取文件时出现的错误
        consoleError("Error reading file 1:" + err);
        resolve(false);
      });
  });
}

// 多语言表中是否有当前内容一致的
function checkLanguage(content) {
  // 如果这个里面有\r\n，就替换成\n
  content = content.replace(/\r\n/g, "\n");
  for (let id in languageConfigData) {
    if (languageConfigData[id].value === content) {
      return languageConfigData[id];
    }
  }
  return null;
}

// 多语言表中是否有当前可以是否一致的
function checkLanguageKey(key) {
  if (!key) {
    return;
  }
  if (!key.replace) {
    return;
  }
  // 如果这个里面有\r\n，就替换成\n
  key = key.replace(/\r\n/g, "\n");
  for (let id in languageConfigData) {
    if (languageConfigData[id].key === key) {
      return languageConfigData[id];
    }
  }
  return null;
}

var consoleLog;

// ---------------------------------------------------------------执行逻辑分割线---------------------------------------------------------------------
function run(
  consoleTEXT,
  consoleERROR,
  inPrefix,
  rootPath,
  excelPath,
  languageExcelName,
  callBack
) {
  try {
    prefix = inPrefix;
    consoleLog = consoleTEXT;
    consoleError = consoleERROR;
    currentDirectoryPath = rootPath.replace(/\\/g, "/") + "/";
    pathJson = __dirname + "/LanguageConfig.json";
    pathZ = currentDirectoryPath.replace("Language", "") + "JavaScripts";
    pathAllExcel = excelPath.replace(/\\/g, "/");
    pahtExcel = pathAllExcel + "/" + languageExcelName;
    pathUI = currentDirectoryPath.replace("Language", "") + "UI";

    // 读取 Excel 文件
    workbook.xlsx
      .readFile(pahtExcel)
      .then(async () => {
        // 读取第一个工作表
        const worksheet = workbook.getWorksheet(1);

        // 是否有Language_多语言表
        if (!fs.existsSync(pahtExcel)) {
          worksheet.addRow(["Int", "string", "string", "string"]);
          worksheet.addRow(["id", "name", "Value", "Value_C"]);
          worksheet.addRow(["ID", "字段名", "英文", "中文"]);
          worksheet.addRow([
            "",
            "Key|ReadByName",
            "MainLanguage",
            "ChildLanguage",
          ]);

          // 写入
          worksheet.writeFile(pahtExcel);
        }

        // 初始化多语言的id
        await initLanguageId();

        await readLanguage();

        // 结构 {1: "你好"}
        var collectUILanguage = {};
        tryChangeUI(pathUI, collectUILanguage).then(async () => {
          consoleLog(
            "UI 新收集的文本：" + JSON.stringify(collectUILanguage),
            "blue"
          );

          // 写入Language_多语言表.xlsx
          await wirteToLanguage("UTL_", collectUILanguage);

          await readLanguage();

          var collectExcelLanguage = {};
          tryChangeExcel(pathAllExcel, collectExcelLanguage).then(async () => {
            consoleLog(
              "Excel 新收集的文本：" + JSON.stringify(collectExcelLanguage),
              "blue"
            );

            // 写入Language_多语言表.xlsx
            await wirteToLanguage("ETL_", collectExcelLanguage);

            await readLanguage();

            // 读取文件，写入文本
            var collectScroptResult = {};

            // 转换脚本
            tryChangeScript(pathZ, collectScroptResult).then(async () => {
              consoleLog(
                "Script 新收集的文本：" + JSON.stringify(collectScroptResult),
                "blue"
              );
              await wirteToLanguage("STL_", collectScroptResult, true);
              callBack && callBack();
              callBack = null;
            });
          });
        });
      })
      .catch((err) => {
        // 处理读取文件时出现的错误
        consoleERROR("Error reading file 2:" + err);
      });
  } catch (err) {
    consoleError(err);
  }
}

function runMulti(
  consoleTEXT,
  consoleERROR,
  inPrefix,
  rootPath,
  excelPath,
  languageExcelPath,
  callBack
) {
  try {
    prefix = inPrefix;
    consoleLog = consoleTEXT;
    consoleError = consoleERROR;
    currentDirectoryPath = rootPath.replace(/\\/g, "/") + "/";
    pathJson = __dirname + "/LanguageConfig.json";
    pathZ = currentDirectoryPath.replace("Language", "") + "JavaScripts";
    pathAllExcel = excelPath.replace(/\\/g, "/");
    pahtExcel = languageExcelPath.replace(/\\/g, "/");
    pathUI = currentDirectoryPath.replace("Language", "") + "UI";

    // // 读取 Excel 文件
    // workbook.xlsx.readFile(pahtExcel)
    //     .then(async () => {
    //         // 读取第一个工作表
    //         const worksheet = workbook.getWorksheet(1);

    //         // 代码中编号对应的内容替换表中的
    //         const sheetValues = worksheet.getSheetValues();

    //         let removeIndexArr = [];

    //         let needWrite = false;

    //         // 先找到配置表,去掉没有内容的行
    //         sheetValues.forEach((context, index) => {
    //             if (!context || context.length <= 0) {
    //                 removeIndexArr.push(index);
    //                 needWrite = true;
    //             } else {
    //                 if (typeof context[1] === "number") {
    //                     let chineaseIndex = context.findIndex(value => hasChineseCharacters(value));
    //                     languageConfigData[context[1]] = { id: context[1], key: context[2], value: chineaseIndex !== -1 ? context[chineaseIndex] : context[4] };
    //                 }
    //             }
    //         });

    //         for (let index of removeIndexArr) {
    //             worksheet.spliceRows(index, 1);
    //         }

    //         // 是否有Language_多语言表
    //         if (!fs.existsSync(pahtExcel)) {
    //             worksheet.addRow(['Int', 'string', 'string', 'string']);
    //             worksheet.addRow(['id', 'name', 'Value', 'Value_C']);
    //             worksheet.addRow(['ID', '字段名', '英文', '中文']);
    //             worksheet.addRow(['', 'Key|ReadByName', 'MainLanguage', 'ChildLanguage']);
    //             needWrite = true;
    //         }

    //         if (needWrite) {
    //             // 写入
    //             await workbook.xlsx.writeFile(pahtExcel)
    //         }

    //         // 初始化多语言的id
    //         await initLanguageId();

    //         await readLanguage();

    //         // 结构 {1: "你好"}
    //         var collectUILanguage = {};
    //         tryChangeUI(pathUI, collectUILanguage).then(async () => {
    //             consoleLog("UI 新收集的文本：" + JSON.stringify(collectUILanguage), "blue");

    //             // 写入Language_多语言表.xlsx
    //             await wirteToLanguage("UTL_", collectUILanguage);

    //             await readLanguage();

    //             var collectExcelLanguage = {};
    //             tryChangeExcel(pathAllExcel, collectExcelLanguage).then(async () => {
    //                 consoleLog("Excel 新收集的文本：" + JSON.stringify(collectExcelLanguage), "blue");

    //                 // 写入Language_多语言表.xlsx
    //                 await wirteToLanguage("ETL_", collectExcelLanguage);

    //                 await readLanguage();

    //                 // 读取文件，写入文本
    //                 var collectScroptResult = {};

    //                 // 转换脚本
    //                 tryChangeScript(pathZ, collectScroptResult).then(async () => {
    //                     consoleLog("Script 新收集的文本：" + JSON.stringify(collectScroptResult), "blue");
    //                     await wirteToLanguage("STL_", collectScroptResult, true);
    //                     callBack && callBack();
    //                     callBack = null;
    //                 });
    //             });
    //         });
    //     })
    //     .catch(err => {
    //         // 处理读取文件时出现的错误
    //         consoleERROR('Error reading file 3:' + err);
    //     });
    // const buffer = xlsx.build(data);
    // fs.writeFileSync(pahtExcel, buffer);

    tryReplaceScript(pathZ).then(async () => {
      consoleLog("替换代码完成", "blue");

      tryReplaceTagExcel(pathAllExcel).then(async () => {
        consoleLog("替换tag完成", "blue");
        callBack && callBack();
        callBack = null;
      });
    });
  } catch (err) {
    consoleError(err);
  }
}

function collectSpine(dirPath, copyFilesPathInfo) {
  return new Promise(async (resolve, reject) => {
    const files = fs.readdirSync(dirPath); // 读取目录下的所有文件和文件夹

    // 检查文件里面有没有.skel后缀文件，找到后开始找.png和.atlas文件
    for (let file of files) {
      const filePath = path.join(dirPath, file); // 文件的完整路径
      const stats = fs.statSync(filePath); // 获取文件信息

      if (filePath.endsWith(".meta")) continue;

      // 如果是文件，则进行处理
      if (stats.isFile()) {
        if (filePath.endsWith(".prefab")) {
          for (let file2 of files) {
            if (file2.endsWith(".meta")) continue;

            // 找到同名文件先收集对应文件全路径
            if (file2.split(".")[0] === file.split(".")[0]) {
              const filePath2 = path.join(dirPath, file2);
              copyFilesPathInfo[file2] = filePath2;
            }
          }
        }
      } else if (stats.isDirectory()) {
        // 如果是文件夹，则递归调用函数继续读取文件夹内的文件
        await collectSpine(filePath, copyFilesPathInfo);
      }
    }
    resolve(true);
  });
}

function changeSpine(dirPath, spineInfo) {
  return new Promise(async (resolve, reject) => {
    const files = fs.readdirSync(dirPath); // 读取目录下的所有文件和文件夹

    // 检查文件里面有没有.skel后缀文件，找到后开始找.png和.atlas文件
    for (let file of files) {
      const filePath = path.join(dirPath, file); // 文件的完整路径
      const stats = fs.statSync(filePath); // 获取文件信息

      if (filePath.endsWith(".meta")) continue;

      // 如果是文件，则进行处理
      if (stats.isFile()) {
        // 如果名字一样
        if (spineInfo[file]) {
          // 开始替换
          fs.copyFileSync(spineInfo[file], filePath);
        }
      } else if (stats.isDirectory()) {
        // 如果是文件夹，则递归调用函数继续读取文件夹内的文件
        await changeSpine(filePath, spineInfo);
      }
    }
    resolve(true);
  });
}

fs.readFile("D:/Downloads/hunting.svg", "utf8", (err, data) => {
  if (err) throw err;
  xml2js.parseString(data, (err, result) => {
    if (err) throw err;
    console.log(result); // 输出解析后的 JSON 对象
  });
});

// 使用node运行 测试代码
// var config = {
//     "path": "C:\\MWEditor\\MetaWorldSaved\\Saved\\MetaWorld\\Project\\Edit\\totalmetadramacamp",
//     "prefix": "CUtils.getLanguage",
//     "excelPath": "C:\\MWEditor\\MetaWorldSaved\\Saved\\MetaWorld\\Project\\Edit\\totalmetadramacamp\\Excel",
//     "languageExcelName": "Language_多语言.xlsx"
// };
// run(console.log, console.error, config.prefix, config.path, config.excelPath, config.languageExcelName);

module.exports = {
  run: run,
  runMulti: runMulti,
};

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
