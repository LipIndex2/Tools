/*
 * @Author       : peng.li
 * @Date         : 2023-06-25 11:23:54
 * @LastEditors  : peng.li
 * @LastEditTime : 2023-12-24 13:41:03
 * @FilePath     : \vue_desktop\Language\ToLanguage.js
 * @Description  : 修改描述
 */

var fs = require('fs');
var flock = require('proper-lockfile');
var path = require('path');
const { isString } = require('util');
const ExcelJS = require('exceljs');

// 创建一个新的工作簿对象
const workbook = new ExcelJS.Workbook();

// 获取当前文件所在目录的完整路径
var currentDirectoryPath = process.argv.slice(2) + "/";
var pathJson = __dirname + "/LanguageConfig.json";
var pathZ = currentDirectoryPath.replace("Language", "") + "JavaScripts";
var pahtExcel = currentDirectoryPath.replace("Language", "") + "Excels/Language_多语言表.xlsx";
var pathUI = currentDirectoryPath.replace("Language", "") + "UI";
var pathAllExcel = currentDirectoryPath.replace("Language", "") + "Excels";
var callBack = null;

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

const CanvasTemplate = {
    "Cliping": true,
    "Transform": {
        "Position": {
            "X": -17.974939346313477,
            "Y": 34.046745300292969
        },
        "Size": {
            "X": 197.90476989746094,
            "Y": 37.523834228515625
        }
    },
    "AutoSizePack": {},
    "Constraint": {},
    "AutoLayoutChildPadding": {},
    "Name": "CanvasRoll",
    "RenderPivot": {},
    "RenderShear": {},
    "RenderScale": {},
    "ID": "344291E4",
    "Stretch_Padding": {},
    "ImageMatchSize": false,
}


// 尝试改变UI中的多语言
function tryChangeUI(dirPath) {
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

                            if (!data) {
                                resolve2(false);
                                return;
                            }

                            let isChange = false;

                            const id = "344291E4";
                            let idCount = 0;

                            // 递归遍历
                            let repCb = (forData, parentKey) => {
                                const parent = forData;
                                for (let key in forData) {
                                    const child = forData[key];

                                    if (key.indexOf("MW") === -1) {
                                        continue;
                                    }

                                    let textIsGood = false;

                                    // 找到控件
                                    if (key.indexOf("MWTextBlock") !== -1) {
                                        // 检查自身有没有问题 关闭自适应文本框 关闭垂直自动大小 水平自动大小 是否逐字显示的文本 打开不裁剪
                                        if (!child["TextAutoAdjust"]
                                            && (!child["AutoSizePack"] || (!child["AutoSizePack"]["HorizontalAutoSize"] && !child["AutoSizePack"]["VerticalAutoSize"]))
                                            && child["TextShowMode"] && child["TextShowMode"] === 2
                                        ) {
                                            // 文本没问题
                                            textIsGood = true;
                                        }

                                        if (!textIsGood) {
                                            continue;
                                        }

                                        const childPos = !child["Transform"] || !child["Transform"]["Position"] ? { "X": 0, "Y": 0 } : child["Transform"]["Position"];
                                        const childSize = !child["Transform"] || !child["Transform"]["Size"] ? { "X": 100, "Y": 100 } : child["Transform"]["Size"];

                                        // 如果父类是MWCanvas 并且打开了溢出隐藏 并且不水平自动大小 不是垂直自动大小 没有开启自动布局
                                        if (parentKey.indexOf("MWCanvas") !== 1
                                            && parent["Cliping"]
                                            && (!parent["AutoSizePack"] || (!parent["AutoSizePack"]["HorizontalAutoSize"] && !parent["AutoSizePack"]["VerticalAutoSize"])
                                                && (!parent["AutoLayoutEnable"] && (!parent["AutoLayout"] || !parent["AutoLayout"]["AutoLayout"])))) {
                                            // 如果父类的大小与文本差距大于5就有问题
                                            if (Math.abs(childSize["X"] - parent["Transform"]["Size"]["X"]) > 5 || Math.abs(childSize["Y"] - parent["Transform"]["Size"]["Y"]) > 5
                                                || (childPos["X"] > 3 || childPos["Y"] > 3)) {
                                                // 新建一个Canvas
                                                isChange = true;

                                                // 删除子类
                                                delete parent[key];
                                                idCount++;
                                                let newKey = "MWCanvas_" + id + idCount;
                                                let newCanvas = JSON.parse(JSON.stringify(CanvasTemplate));
                                                parent[newKey] = newCanvas;
                                                newCanvas.Transform.Position.X = childPos["X"] || 0;
                                                newCanvas.Transform.Position.Y = childPos["Y"] || 0;
                                                newCanvas.Transform.Size.X = childSize["X"] || 100;
                                                newCanvas.Transform.Size.Y = childSize["Y"] || 100;
                                                if (child["Transform"] && child["Transform"]["Position"]) {
                                                    delete child["Transform"]["Position"];
                                                }
                                                newCanvas[key] = child;
                                                newCanvas.Name = "RollCanvas_" + idCount;
                                            } else {
                                                // 原有的父类没问题
                                                continue;
                                            }
                                        } else {
                                            // 新建一个Canvas
                                            isChange = true;

                                            // 删除子类
                                            delete parent[key];
                                            idCount++;
                                            let newKey = "MWCanvas_" + id + idCount;
                                            let newCanvas = JSON.parse(JSON.stringify(CanvasTemplate));
                                            parent[newKey] = newCanvas;
                                            newCanvas.Transform.Position.X = childPos["X"] || 0;
                                            newCanvas.Transform.Position.Y = childPos["Y"] || 0;
                                            newCanvas.Transform.Size.X = childSize["X"] || 100;
                                            newCanvas.Transform.Size.Y = childSize["Y"] || 100;
                                            if (child["Transform"] && child["Transform"]["Position"]) {
                                                delete child["Transform"]["Position"];
                                            }
                                            newCanvas[key] = child;
                                            newCanvas.Name = "RollCanvas_" + idCount;
                                        }
                                    } else {
                                        repCb(forData[key], key);
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

                            repCb(inputData, "Root");
                            if (isChange) {
                                const jsonStr = !isString(inputData) ? JSON.stringify(inputData) : inputData;

                                // 添加 UTF-8 BOM
                                const bom = Buffer.from('\uFEFF', 'utf8');
                                const dataWithBom = Buffer.concat([bom, Buffer.from(jsonStr, 'utf8')]);

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
                        cb('utf8');
                    } catch (err) {
                        cb('utf-16le');
                    }
                });
            } else if (stats.isDirectory()) {
                // 如果是文件夹，则递归调用函数继续读取文件夹内的文件
                await tryChangeUI(filePath);
            }
        }
        resolve(true);
    });
}

var consoleLog;

function runMulti(consoleTEXT, consoleERROR, inPrefix, rootPath, excelPath, languageExcelPath, callBack) {
    try {
        prefix = inPrefix;
        consoleLog = consoleTEXT;
        consoleError = consoleERROR;
        currentDirectoryPath = rootPath.replace(/\\/g, '/') + "/";
        pathJson = __dirname + "/LanguageConfig.json";
        pathZ = currentDirectoryPath.replace("Language", "") + "JavaScripts";
        pathAllExcel = excelPath.replace(/\\/g, '/');
        pahtExcel = languageExcelPath.replace(/\\/g, '/');
        pathUI = currentDirectoryPath.replace("Language", "") + "UI";

        tryChangeUI(pathUI).then(async () => {
            consoleLog("UI 改写完成");
            callBack && callBack();
            callBack = null;
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
    runMulti: runMulti,
}

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
