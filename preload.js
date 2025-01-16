
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('myAPI', {
    desktop: true
})

window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector)
        if (element) element.innerText = text
    }

    for (const type of ['chrome', 'node', 'electron']) {
        replaceText(`${type}-version`, process.versions[type])
    }

    // const textarea = document.getElementById("textarea");
    // ipcRenderer.on("update-message", (event, text) => {
    //     if (textarea.innerHTML == "") {
    //         textarea.innerHTML = text;
    //         return;
    //     }
    //     textarea.innerHTML += "\n\r" + text;
    //     textarea.scrollTop = textarea.scrollHeight;
    // });

    const outputDiv = document.getElementById("output");
    ipcRenderer.on("update-message", (event, text, color) => {
        const para = document.createElement("p");
        para.className = "myText";
        para.textContent = text;
        para.style.color = color;
        outputDiv.appendChild(para);
        outputDiv.scrollTop = outputDiv.scrollHeight;
    });
})

contextBridge.exposeInMainWorld('electronAPI', {
    openFile: () => ipcRenderer.invoke('test'),
    runProgram: (path, prefix, excelPath, languageExcelName) => ipcRenderer.invoke('runProgram', path, prefix, excelPath, languageExcelName),
    changePath: (path) => ipcRenderer.invoke('changePath', path),
    changePrefixAndLanName: (prefix, languageExcelName) => ipcRenderer.invoke('changePrefixAndLanName', prefix, languageExcelName),
    getConfig: () => ipcRenderer.invoke('getConfig'),
    onShowAlert: (message) => ipcRenderer.invoke('onShowAlert', message),
    onSelectFolder: (data) => ipcRenderer.invoke('onSelectFolder', data),
    onShowAlertExcel: (message) => ipcRenderer.invoke('onShowAlertExcel', message),
    onSelectFolderExcel: (data) => ipcRenderer.invoke('onSelectFolderExcel', data),
    openPathConfig: () => ipcRenderer.invoke('openPathConfig'),
    getPathConfig: () => ipcRenderer.invoke('getPathConfig'),
    changeProject: (projectName) => ipcRenderer.invoke('changeProject', projectName),
    reload: () => ipcRenderer.invoke('reload'),
});
