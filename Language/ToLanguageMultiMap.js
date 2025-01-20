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
const { runMulti } = require('./ToLanguage');

const ExcelJS = require('exceljs');

// 创建一个新的工作簿对象
const workbook = new ExcelJS.Workbook();



// 获取当前文件所在目录的完整路径
var currentDirectoryPath = process.argv.slice(2) + "/";
var pathAllExcel = currentDirectoryPath.replace("Language", "") + "Excels";
var selectProjectName = "";

// 脚本前缀
var prefix = "LanUtil.getLanguage";

// 多场景需要忽略的文件夹名称
const ignoreFloderName = [".git", "DBCache"]

// 尝试改变代码中的多语言函数
function tryReadMultiMap(dirPath) {
    return new Promise(async (resolve, reject) => {
        const files = fs.readdirSync(dirPath); // 读取目录下的所有文件和文件夹
        let runFiles = [];
        let count = 0;
        let cb = () => {
            if (files.length <= 0) {
                // // 单项目改写完成，把本地的Language.xlsx替换最新
                // const languageExcelPathArr = getAllLanguageExcelPath();

                // // 读取 Excel 文件
                // workbook.xlsx.readFile(pahtExcel)
                //     .then(() => {
                //         // 读取第一个工作表
                //         const worksheet = workbook.getWorksheet(1);

                //         // 开始替换所有改动过场景的Language.xlsx
                //         for (let f of languageExcelPathArr) {
                //             workbook.xlsx.writeFile(f);
                //         }

                //         consoleLog("写入多场景，全部结束,一共写入" + count + "个项目", "green");
                //         resolve(true);
                //     })
                //     .catch(err => {
                //         // 处理读取文件时出现的错误
                //         consoleError('Error reading file:' + err);
                //     });
                consoleLog("写入多场景，全部结束,一共写入" + count + "个项目", "green");
                return;
            }

            const file = files.shift();

            // 如果是ui-generate跳过
            let isIgnore = false
            for (let name of ignoreFloderName) {
                if (file.indexOf(name) !== -1) {
                    isIgnore = true;
                    break;
                }
            }
            if (isIgnore) {
                cb();
                return;
            };

            const filePath = path.join(dirPath, file); // 文件的完整路径
            const stats = fs.statSync(filePath); // 获取文件信息
            const excelPath = getExcelPath(file);
            if (!excelPath) {
                cb();
                return;
            }

            if (!fs.existsSync(excelPath)) {
                consoleError("Excel路径不存在：" + excelPath);
                cb();
                return;
            }

            // 开始收集当前项目的多语言
            if (stats.isDirectory() && fs.existsSync(filePath + "/JavaScripts") && fs.existsSync(filePath + "/UI")) {
                consoleLog("开始写入多场景：" + file, "red");
                count += 1;
                runFiles.push(filePath);
                runMulti(consoleLog, consoleError, prefix, filePath, excelPath, pahtExcel, () => {
                    cb();
                });
            } else {
                cb();
            }
        }

        cb();
    });
}

// 读取关卡数据
function readToJson(path) {
    const jsonString = fs.readFileSync(path, "utf8");
    if (jsonString.charCodeAt(0) === 0xFEFF) {
        // Remove BOM from the jsonString
        return JSON.parse(jsonString.slice(1));
    }
    return JSON.parse(jsonString);
}

/**
 * 获取Excel路径
 */
function getExcelPath(name) {
    let ExcelPathArr = readToJson(pathJson);
    const project = ExcelPathArr.find(v => v.ProjectName === selectProjectName);
    const result = project.Projects.find(v => v.Name === name);
    if (!result) return null;

    return result.ExcelPath;
}

/**
 * 获取所有Language的Excel路径
 */
function getAllLanguageExcelPath() {
    let ExcelPathArr = readToJson(pathJson);
    const project = ExcelPathArr.find(v => v.ProjectName === selectProjectName);
    return project ? project.Projects.map(v => v.LanguagePath) : [];
}

var consoleLog;

// ---------------------------------------------------------------执行逻辑分割线---------------------------------------------------------------------
function runMultiMap(consoleTEXT, consoleERROR, inPrefix, rootPath, excelPath, languageExcelName, projectName) {
    try {
        prefix = inPrefix;
        consoleLog = consoleTEXT;
        consoleError = consoleERROR;
        currentDirectoryPath = rootPath.replace(/\\/g, '/');
        pathJson = "C:/Users/Public/Config/PathConfig.json";
        selectProjectName = projectName;

        pahtExcel = excelPath + "/" + languageExcelName;

        // 找出对应路径里面的文件夹,去掉忽略的文件
        tryReadMultiMap(currentDirectoryPath);
    } catch (err) {
        consoleError(err);
    }
}

// 使用node运行 测试代码
// var config = {
//     /** 根项目路径 */
//     "path": "C:\\Users\\admin\\AppData\\MetaApp\\Editor_Win64\\MetaWorldSaved\\Saved\\MetaWorld\\Project\\Edit\\jellyrun",
//     "prefix": "CUtils.getLanguage",
//     "excelPath": "C:\\Users\\admin\\AppData\\MetaApp\\Editor_Win64\\MetaWorldSaved\\Saved\\MetaWorld\\Project\\Edit\\jellyrun\\jellyrun\\Excel",
//     "languageExcelName": "Language.xlsx"
// };
// runMultiMap(console.log, console.error, config.prefix, config.path, config.excelPath, config.languageExcelName, config.projectName);

module.exports = {
    runMultiMap: runMultiMap,
}