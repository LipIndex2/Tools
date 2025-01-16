const electron = require('electron');

const path = require('path');
// const npmInstall = require('electron-npm-install');
const { ipcMain } = require('electron');
const fs = require('fs');
const { runMultiMap } = require('./Language/ToLanguageMultiMap');
const { isString } = require('util');
const { dialog } = require('electron/main');
const { exec } = require('child_process');
const autoUpdater = require('update-electron-app');

const pathJson = "C:/Users/Public/Config/PathConfig.json";
let selectProjectName = "";

let mainWindow;

function createWindow() {
    mainWindow = new electron.BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            preload: path.join(__dirname, 'preload.js')
        },
        resizable: false
    });

    mainWindow.loadFile('./index.html');

    mainWindow.on('closed', function () {
        mainWindow = null;
    });

    ipcMain.on('message-from-renderer', (event, arg) => {
        console.log('Received message from renderer:', arg);

        // 在主进程中发送事件给渲染进程
        mainWindow.webContents.send('message-from-main', 'Hello from main process!');
    });

    ipcMain.handle('test', testFunc)

    ipcMain.handle("runProgram", runProgram)

    ipcMain.handle("changePath", changePath)

    ipcMain.handle("changePrefixAndLanName", changePrefixAndLanName)

    ipcMain.handle("getConfig", getConfig)
    ipcMain.handle("reload", reload)

    ipcMain.handle("openPathConfig", openPathConfig)
    ipcMain.handle("getPathConfig", getPathConfig)
    ipcMain.handle("changeProject", (event, projectName) => {
        selectProjectName = projectName;
    });

    ipcMain.handle("onShowAlert", (event, message) => {
        dialog.showErrorBox("错误", message.toString());
    });

    ipcMain.handle("onSelectFolder", (event, data) => {
        return showSelectFolderDialog().then(async (d) => {
            if (!d) return [new Error("请选择文件"), null];
            let filePath = d;
            changePath(null, filePath);

            // 如果当前根路径与当前的路径不相匹配,那么直接清空
            let config = await getConfig();
            if (config.excelPath.indexOf(filePath) === -1) {
                changeExcelPath(null, "");
            }
            return ["", null];
        })
    });

    ipcMain.handle("onShowAlertExcel", (event, message) => {
        dialog.showErrorBox("错误", message.toString());
    });

    ipcMain.handle("onSelectFolderExcel", (event, data) => {
        return showSelectFolderFileDialog().then(async (d, d2) => {
            if (!d) return [new Error("请选择文件"), null];
            let filePath = d;
            let fileName = "";
            try {
                // 使用path模块获取文件名
                fileName = path.basename(filePath);
            } catch (err) {
                consoleERROR(err);
            }

            const excelPath = filePath.replace("\\" + fileName, "");

            // 找个这个路径,获取当前文件名
            let result = await changeExcelPath(null, excelPath)
            result && changeLanguageName(null, fileName)
            return ["", null];
        })
    });

    getPathConfig().then(v => {
        selectProjectName = v[0].ProjectName;
    });
}

async function testFunc() {
    let config = readToJson(__dirname + "/config.json");

    console.log("config", config);

    return [config, ""];
}

async function runProgram(event, prefix, excelPath, languageExcelName) {
    // 如果传入的内容有一个为空那么都跑不了
    if (!prefix) {
        consoleERROR("传入的脚本前缀为空!!!");
        return;
    }

    if (!excelPath) {
        consoleERROR("传入的Excel路径为空!!!");
        return;
    }

    if (!languageExcelName) {
        consoleERROR("传入的多语言表名称为空!!!");
        return;
    }

    const pathConfig = await getPathConfig();
    const curSelectProject = pathConfig.find(v => v.ProjectName === selectProjectName);

    if (!fs.existsSync(curSelectProject.ProjectPath)) {
        consoleERROR("当前选择的 " + curSelectProject.ProjectName + " 项目路径不存在!!!");
        return;
    }

    // 开始真正的收集工作了
    runMultiMap(consoleTEXT, consoleERROR, prefix, curSelectProject.ProjectPath, excelPath.replace(/\\/g, '/'), languageExcelName, selectProjectName);

    // // 这里接入ToLanguage.bat
    // // 运行 .bat 文件
    // exec.exec(`start cmd /c "${batFilePath}"  ${realPath + "/" + fileName} `, (error, stdout, stderr) => {
    //     if (error) {
    //         console.error(`Error: ${error.message}`);
    //         return;
    //     }

    //     console.log(`打开ScriptToLanguage.bat成功！`);
    // });
}

async function changePath(event, path) {
    console.log("path", path);
    let configPath = readToJson(__dirname + "/config.json");
    configPath.path = path;
    writeToJson(__dirname + "/config.json", configPath);

    mainWindow.webContents.send("update-path", path, "green");

    // 刷新本地
    mainWindow.reload();
}

async function changePrefixAndLanName(event, prefix, languageExcelName) {
    console.log("prefix", prefix);
    let configPath = readToJson(__dirname + "/config.json");
    configPath.prefix = prefix;
    configPath.languageExcelName = languageExcelName;
    writeToJson(__dirname + "/config.json", configPath);

    mainWindow.webContents.send("update-prefix", prefix, "green");
}

async function changeExcelPath(event, excelPath) {
    console.log("excelPath", excelPath);
    let configPath = readToJson(__dirname + "/config.json");

    configPath.excelPath = excelPath;
    writeToJson(__dirname + "/config.json", configPath);

    mainWindow.webContents.send("update-excel", excelPath, "green");

    // 刷新本地
    mainWindow.reload();

    return true;
}

async function changeLanguageName(event, languageExcelName) {
    console.log("languageExcelName", languageExcelName);
    let configPath = readToJson(__dirname + "/config.json");
    configPath.languageExcelName = languageExcelName;
    writeToJson(__dirname + "/config.json", configPath);
}

async function getConfig() {
    return readToJson(__dirname + "/config.json");
}

async function getPathConfig() {
    return readToJson(pathJson);
}

function openPathConfig() {
    // 没有json文件创建一个
    if (!fs.existsSync(pathJson)) {
        fs.writeFileSync(pathJson, JSON.stringify([]));
    }

    // 使用explorer命令打开文件资源管理器并指定文件夹路径
    exec(`explorer C:\\Users\\Public\\Config`, (error, stdout, stderr) => {
        if (error) {
            console.error(`执行命令时出错: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`命令执行产生错误输出: ${stderr}`);
            return;
        }
        console.log(`命令执行成功: ${stdout}`);
    });
}

electron.app.on('ready', createWindow);

function reload() {
    // 刷新本地
    mainWindow.reload();
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

// 写入对应路径
function writeToJson(path, data) {
    const jsonStr = !isString(data) ? JSON.stringify(data) : data;

    // 添加 UTF-8 BOM
    const bom = Buffer.from('\uFEFF', 'utf8');
    const dataWithBom = Buffer.concat([bom, Buffer.from(jsonStr, 'utf8')]);

    console.log("dataWithBom", dataWithBom);

    // 写入文件
    fs.writeFileSync(path, dataWithBom);
}

async function showSelectFolderDialog() {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    })
    if (canceled) {
        return null;
    } else {
        return filePaths[0]
    }
}

async function showSelectFolderFileDialog() {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile']
    })
    if (canceled) {
        return null;
    } else {
        return filePaths[0]
    }
}

// electron.ipcMain.on('install-and-open', async (event) => {
//     try {
//         // 在这里执行 electron-npm-install 操作
//         await npmInstall({ path: __dirname });

//         // 安装完成后执行打开窗口操作
//         mainWindow.webContents.send('open-window');
//     } catch (error) {
//         console.error('Error installing dependencies:', error);
//     }
// });


function consoleTEXT(log, color = "black") {
    mainWindow.webContents.send("update-message", JSON.stringify(log), color);
}

function consoleERROR(log) {
    mainWindow.webContents.send("update-message", JSON.stringify(log), "red");
}
