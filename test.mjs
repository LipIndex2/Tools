import { from } from 'responselike';
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import npmInstall from 'electron-npm-install';

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
        },
    });

    mainWindow.loadFile('index.html');

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

app.on('ready', createWindow);

ipcMain.on('install-and-open', async (event) => {
    try {
        // 在这里执行 electron-npm-install 操作
        await npmInstall({ path: __dirname });

        // 安装完成后执行打开窗口操作
        mainWindow.webContents.send('open-window');
    } catch (error) {
        console.error('Error installing dependencies:', error);
    }
});
