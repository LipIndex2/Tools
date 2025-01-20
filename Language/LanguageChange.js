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
const { isString } = require('util');

// 获取当前文件所在目录的完整路径
var pathJson = __dirname + "/LanguageConfig.json";
var pathZ = "C:\\Users\\admin\\AppData\\MetaApp\\Editor_Win64\\MetaWorldSaved\\Saved\\MetaWorld\\Project\\Edit\\jellyrun2\\jellyrun2\\JavaScripts";

// 脚本前缀
var prefix = "LanguageUtil.getText";

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

// 创建正则表达式，使用捕获组括号 ()
const regexContent = new RegExp('GameConfig\\.Language\\.\\w+\\.\\w+', 'g');

// 尝试改变代码中的多语言函数
function tryChangeScript(dirPath) {
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

                            // 找出代码中所有的调用_LC的函数
                            const matchArr = data.match(regexContent);
                            if (matchArr) {
                                // "LanUtil.getLanguage("内容")";
                                for (let needChangeContext of matchArr) {
                                    // 筛选出带双引号的文本
                                    const regex = /GameConfig\.Language\.(\w+)\.Value/;


                                    // 取出内容
                                    const result = needChangeContext.match(regex)[1];

                                    data = data.replace(`GameConfig.Language.${result}.Value`, `${prefix}(\"` + result + "\")");
                                }
                            } else {
                                // 单引号
                                const singleQuote = new RegExp("GameConfig\\.Language\\.getElement\\('([^']+)'\\)\\.Value", 'g');

                                // 双引号
                                const doubleQuote = new RegExp('GameConfig\\.Language\\.getElement\\("([^"]+)"\\)\\.Value', 'g');

                                // 反引号
                                const backQuote = new RegExp('GameConfig\\.Language\\.getElement\\(`([^`]+)`\\)\\.Value', 'g');

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
                                        const singleRegex = "GameConfig\\.Language\\.getElement\\('([^']+)'\\)\\.Value";

                                        // 双引号
                                        const doubleRegex = 'GameConfig\\.Language\\.getElement\\("([^"]+)"\\)\\.Value';

                                        // 反引号
                                        const backRegex = 'GameConfig\\.Language\\.getElement\\(`([^`]+)`\\)\\.Value';

                                        // 取出内容
                                        let matchContent = needChangeContext.match(singleRegex);
                                        if (!matchContent) {
                                            matchContent = needChangeContext.match(doubleRegex);
                                            if (!matchContent) {
                                                matchContent = needChangeContext.match(backRegex);
                                            }
                                        }

                                        const result = matchContent[1];

                                        data = data.replace(`GameConfig.Language.getElement(\"` + result + "\").Value", `${prefix}(\"` + result + "\")");
                                        data = data.replace(`GameConfig.Language.getElement(\'` + result + "\').Value", `${prefix}(\"` + result + "\")");
                                        data = data.replace(`GameConfig.Language.getElement(\`` + result + "\`).Value", `${prefix}(\"` + result + "\")");
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
                    }

                    // 先试试utf8
                    cb('utf8');
                });
            } else if (stats.isDirectory()) {
                // 如果是文件夹，则递归调用函数继续读取文件夹内的文件
                await tryChangeScript(filePath);
            }
        }
        resolve(true);
    });
}

// ---------------------------------------------------------------执行逻辑分割线---------------------------------------------------------------------
// 转换脚本
tryChangeScript(pathZ).then(async () => {
});