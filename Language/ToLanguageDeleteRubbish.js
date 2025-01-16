/*
 * @Author       : peng.li
 * @Date         : 2023-06-25 11:23:54
 * @LastEditors  : peng.li
 * @LastEditTime : 2023-12-24 13:41:03
 * @FilePath     : \vue_desktop\Language\ToLanguage.js
 * @Description  : 修改描述
 */

var fs = require('fs');
var path = require('path');
const xlsx = require('node-xlsx');
const { isString } = require('util');

// 获取当前文件所在目录的完整路径
var currentDirectoryPath = process.argv.slice(2) + "/";
var pathJson = __dirname + "/LanguageConfig.json";
var pathZ = currentDirectoryPath.replace("Language", "") + "JavaScripts";
var pahtExcel = currentDirectoryPath.replace("Language", "") + "Excels/Language_多语言表.xlsx";
var pathUI = currentDirectoryPath.replace("Language", "") + "UI";
var pathAllExcel = currentDirectoryPath.replace("Language", "") + "Excels";

// 脚本前缀
var prefix = "LanUtil.getLanguage";

// 读取关卡数据
function readToJson(path) {
    const jsonString = fs.readFileSync(path, "utf8");
    if (jsonString.charCodeAt(0) === 0xFEFF) {
        // Remove BOM from the jsonString
        return JSON.parse(jsonString.slice(1));
    }
    return JSON.parse(jsonString);
}

// 写入对应路径
function writeToJson(path, data) {
    const jsonStr = !isString(data) ? JSON.stringify(data) : data;

    // 添加 UTF-8 BOM
    const bom = Buffer.from('\uFEFF', 'utf8');
    const dataWithBom = Buffer.concat([bom, Buffer.from(jsonStr, 'utf8')]);

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
                                if (coding === 'utf8') {
                                    cb('utf16le');
                                    return;
                                } else {
                                    return resolve2(false);
                                }
                            }

                            if (data.indexOf('(') === -1) return resolve2(false);

                            // 找出代码中所有的调用_LC的函数
                            const matchArr = data.match(new RegExp(`${prefix}\\([^)]+\\)`, 'g'));
                            if (matchArr) {
                                // "LanUtil.getLanguage("内容")";
                                for (let needChangeContext of matchArr) {
                                    let nextId;

                                    // 筛选出带双引号的文本
                                    const regex = /"([^"]*)"/g;

                                    // 单引号
                                    const onlyRegex = /'([^"]*)'/g;

                                    // 取出内容
                                    var matches = needChangeContext.match(regex);
                                    if (!matches) {
                                        matches = needChangeContext.match(onlyRegex);
                                    }

                                    // 这里报错一下
                                    if (!matches) {
                                        consoleError("内容匹配失败，本次收集只替换单引号和双引号！！！path: " + filePath + "  内容：" + needChangeContext);
                                        consoleLog("程序会先跳过这个文件,继续执行....", "pick");
                                        continue;
                                    }

                                    const result = matches.map(match => match.slice(1, -1));

                                    // 如果不是Language表里面的key，那还是要收集
                                    let value = checkLanguage(result[0]);
                                    if (value) {
                                        outResult[value.key] = value.value;
                                    }
                                }
                            }

                            resolve2(true);

                            // // 文件写入
                            // fs.writeFile(filePath, data, (err) => {
                            //     if (err) {
                            //         consoleError(err);
                            //         resolve2(false);
                            //         return;
                            //     }

                            //     resolve2(true);
                            // });
                        });
                    }

                    // 先试试utf8
                    cb('utf8');
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
                                if (coding === 'utf8') {
                                    cb('utf-16le');
                                    return;
                                } else {
                                    return resolve2(false);
                                }
                            }

                            let isChange = false;

                            // 递归遍历
                            let repCb = (forData) => {
                                for (let key in forData) {
                                    if (key === "Text") {
                                        // 如果发现有中文
                                        // 如果表中有这个一样的内容，直接延用之前的内容
                                        let result = checkLanguage(forData[key]);
                                        if (result) {
                                            outResult[result.key] = result.value;
                                        }
                                        isChange = true;
                                    } else if (typeof forData[key] === "object") {
                                        repCb(forData[key]);
                                    }
                                }
                            }

                            let inputData;
                            if (data.charCodeAt(0) === 0xFEFF) {
                                // Remove BOM from the jsonString
                                inputData = JSON.parse(data.slice(1));
                            }
                            else {
                                try {
                                    inputData = JSON.parse(data);
                                } catch (err) {
                                    cb('utf-16le');
                                    return;
                                }
                            }

                            repCb(inputData);
                            if (isChange) {
                                const jsonStr = !isString(inputData) ? JSON.stringify(inputData) : inputData;

                                // 添加 UTF-8 BOM
                                const bom = Buffer.from('\uFEFF', 'utf8');
                                const dataWithBom = Buffer.concat([bom, Buffer.from(jsonStr, 'utf8')]);

                                resolve2(true);
                                // // 文件写入
                                // fs.writeFile(filePath, dataWithBom, (err) => {
                                //     if (err) {
                                //         consoleError(err);
                                //         resolve2(false);
                                //         return;
                                //     }
                                //     resolve2(true);
                                // });
                            } else {
                                resolve2(true);
                            }
                        });
                    };

                    // 先试试utf8
                    try {
                        cb('utf8');
                    } catch (err) {
                        cb('utf-16le');
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
                    const workSheetsFromFile = xlsx.parse(filePath);
                    if (!workSheetsFromFile) return;
                    let sheet = workSheetsFromFile[0];
                    let sheetData = sheet.data;
                    let isChange = false;
                    let chineseIndex = 0;
                    const chineseSubfix = "中文备注";

                    // 如果第4个有Language标注
                    for (let index = 0; index < sheetData[2].length; index++) {
                        let title = sheetData[3][index];
                        if (title === "Language") {
                            chineseIndex += 1;

                            // 如果有这个中文备注，直接赋值
                            let perfixC = "第" + index + "行的" + chineseSubfix;
                            let indexFind = sheetData[2].indexOf(perfixC);
                            let cIndex;
                            if (indexFind !== -1) {
                                // 不用加标题
                                cIndex = indexFind;
                            } else {
                                sheetData[2].push(perfixC);
                                cIndex = sheetData[2].length - 1;
                            }

                            // 发现了标题为Language的列
                            for (let line = 4; line < sheetData.length; line++) {
                                let content = sheetData[line][index];

                                // 如果表中有这个一样的内容，直接延用之前的内容
                                let result = checkLanguage(content);
                                if (result) {
                                    outResult[result.key] = result.value;
                                }
                                isChange = true;
                            }
                        }
                    }

                    // 改变了就写入
                    if (isChange) {
                        consoleLog(filePath);
                        let need = [{ name: sheet.name, data: sheetData }];
                        const buffer = xlsx.build(need);
                        // fs.writeFileSync(filePath, buffer);
                        resolve2(true);
                    } else {
                        resolve2(true);
                    }
                });
            } else if (stats.isDirectory()) {
                // 如果是文件夹，则递归调用函数继续读取文件夹内的文件
                await tryChangeExcel(filePath, outResult);
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
    const workSheetsFromFile = xlsx.parse(pahtExcel);
    if (!workSheetsFromFile) return;
    let sheet = workSheetsFromFile[0];
    let sheetData = sheet.data;

    // 多语言表的最后一位的id
    let id = 0;
    for (let info of sheetData) {
        if (info.length > 0 && typeof info[0] === "number" && info[0] > id) {
            id = info[0];
        }
    }
    let languageConfig = readToJson(pathJson);
    languageConfig.genId = id;
    writeToJson(pathJson, languageConfig);
}

// 写入Language表
function wirteToLanguage(keyPrefix, result, isEnd = false) {
    const workSheetsFromFile = xlsx.parse(pahtExcel);
    if (!workSheetsFromFile) return;
    let sheet = workSheetsFromFile[0];
    const sheetName = sheet.name;
    let sheetData = sheet.data;

    // 代码中编号对应的内容替换表中的
    let info = {};
    for (let index = 4; index < sheetData.length; index++) {
        let context = sheetData[index];
        info[context[0]] = context;
    }

    // 找到中文翻译的索引
    let chineseIndex = sheetData[2].findIndex(value => value && value.indexOf("中文") !== -1);
    if (chineseIndex === -1) {
        consoleERROR("没有找到中文备注，请检查！！！");
        return;
    }
    for (let idx in result) {
        if (info[idx]) {
            info[idx][chineseIndex] = result[idx];
        } else {
            let key = keyPrefix + idx;
            let arr = [+idx, key, "", ""];
            arr[chineseIndex] = result[idx];
            sheetData.push(arr);
        }
    }

    let need = [{ name: sheet.name, data: sheetData }];
    const buffer = xlsx.build(need);
    fs.writeFileSync(pahtExcel, buffer);

    if (!isEnd) {
        consoleLog("写入表格成功，还没有结束，请等待。。。");
    } else {
        consoleLog("写入表格成功，全部结束", "green");
    }
}

// 1: {id: 1, key: UI_1001, value: "你好"}
var languageConfigData = {};

// 读Language表
function readLanguage() {
    const workSheetsFromFile = xlsx.parse(pahtExcel);
    if (!workSheetsFromFile) return;
    let sheet = workSheetsFromFile[0];
    let sheetData = sheet.data;

    // 代码中编号对应的内容替换表中的
    let info = {};
    for (let index = 4; index < sheetData.length; index++) {
        let context = sheetData[index];
        info[context[0]] = context;
    }

    for (let i = 4; i < sheetData.length; i++) {
        if (!sheetData[i][0]) continue;
        let chineaseIndex = sheetData[i].findIndex(value => hasChineseCharacters(value));
        languageConfigData[sheetData[i][0]] = { id: sheetData[i][0], key: sheetData[i][1], value: chineaseIndex !== -1 ? sheetData[i][chineaseIndex] : sheetData[i][3] };
    }
}

// 多语言表中是否有当前内容一致的
function checkLanguage(content) {
    if (!content) return null;

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
function run(consoleTEXT, consoleERROR, inPrefix, rootPath, excelPath, languageExcelName) {
    try {
        prefix = inPrefix;
        consoleLog = consoleTEXT;
        consoleError = consoleERROR;
        currentDirectoryPath = rootPath.replace(/\\/g, '/') + "/";
        pathJson = __dirname + "/LanguageConfig.json";
        pathZ = currentDirectoryPath.replace("Language", "") + "JavaScripts";
        pathAllExcel = excelPath.replace(/\\/g, '/');
        pahtExcel = pathAllExcel + "/" + languageExcelName;
        pathUI = currentDirectoryPath.replace("Language", "") + "UI";

        // 先找到配置表,去掉没有内容的行
        const data = xlsx.parse(pahtExcel);
        for (let i = 0; i < data[0].data.length; i++) {
            if (data[0].data[i].length <= 0) {
                data[0].data.splice(i, 1);
                i--;
            }
        }

        const buffer = xlsx.build(data);
        fs.writeFileSync(pahtExcel, buffer);

        // 是否有Language_多语言表
        if (!fs.existsSync(pahtExcel)) {

            // 创建一个包含数据的数组
            const data = [
                ['Int', 'string', 'string', 'string'],
                ['id', 'name', 'Value', 'Value_C'],
                ['ID', '字段名', '英文', '中文'],
                ['', 'Key|ReadByName', 'MainLanguage', 'ChildLanguage'],
            ];

            // 使用 node-xlsx 的 build 方法创建 Excel 文件
            const buffer = xlsx.build([{ name: 'Sheet1', data: data }]);

            // 将文件保存到磁盘
            fs.writeFileSync(pahtExcel, buffer);
        }

        // 初始化多语言的id
        initLanguageId();

        readLanguage();

        // 检查本地ui、excel、脚本中是否有对应的key

        // // 结构 {1: "你好"}
        var collectUILanguage = {};
        tryChangeUI(pathUI, collectUILanguage).then(() => {
            // consoleLog("UI 新收集的文本：" + JSON.stringify(collectUILanguage), "blue");

            // 写入Language_多语言表.xlsx
            // wirteToLanguage("UTL_", collectUILanguage);

            // readLanguage();

            // var collectExcelLanguage = {};
            tryChangeExcel(pathAllExcel, collectUILanguage).then(() => {
                // consoleLog("Excel 新收集的文本：" + JSON.stringify(collectUILanguage), "blue");

                // 写入Language_多语言表.xlsx
                // wirteToLanguage("ETL_", collectExcelLanguage);

                // readLanguage();

                // 读取文件，写入文本
                // var collectScroptResult = {};

                // 转换脚本
                tryChangeScript(pathZ, collectUILanguage).then(() => {
                    consoleLog("Script 新收集的文本：" + JSON.stringify(collectUILanguage), "blue");
                    // wirteToLanguage("STL_", collectScroptResult, true);


                });
            });
        });
    } catch (err) {
        consoleError(err);
    }
}

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
}