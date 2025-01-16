
async function runFunc() {
    // 创建一个刷新按钮在inputPath中
    const para1Path = document.createElement("button");
    para1Path.className = "refresh"
    para1Path.addEventListener('click', () => {
        // 刷新路径和当前文件
        // window.electronAPI.changePath(paraP.value);
        window.electronAPI.openPathConfig();
    });
    const pathNode = document.createTextNode("开打配置文件夹");
    para1Path.appendChild(pathNode);
    const elementPath = document.getElementById("pathButton");
    elementPath.appendChild(para1Path);

    // 添加
    const pathConfig = await window.electronAPI.getConfig();

    // const paraP = document.createElement("input");
    // paraP.className = "inputClass"
    // paraP.value = pathConfig.path;
    // paraP.style.color = "green";
    // const inputPathDiv = document.getElementById("inputField");
    // inputPathDiv.appendChild(paraP);
    // inputPathDiv.scrollTop = inputPathDiv.scrollHeight;

    // // 创建一个刷新按钮在inputPath中
    // const para1 = document.createElement("button");
    // para1.className = "refresh"
    // para1.addEventListener('click', () => {
    //     // 刷新路径和当前文件
    //     // window.electronAPI.changePath(paraP.value);
    //     window.electronAPI.onSelectFolder(paraP.value);
    // });
    // const node = document.createTextNode("选择项目根路径..");
    // para1.appendChild(node);
    // const element = document.getElementById("refreshButton");
    // element.appendChild(para1);

    // 添加选择Excel路径
    const paraExcel = document.createElement("input");
    paraExcel.className = "inputClass"
    paraExcel.value = pathConfig.excelPath;
    paraExcel.style.color = "green";
    const inputExcelPathDiv = document.getElementById("excelField");
    inputExcelPathDiv.appendChild(paraExcel);
    inputExcelPathDiv.scrollTop = inputExcelPathDiv.scrollHeight;

    // 创建一个刷新按钮在inputPath中
    const paraSelectExcelPath = document.createElement("button");
    paraSelectExcelPath.className = "refresh"
    paraSelectExcelPath.addEventListener('click', () => {
        // 刷新路径和当前文件
        window.electronAPI.onSelectFolderExcel(paraExcel.value);
    });
    const nodeExcel = document.createTextNode("选择Excel路径..");
    paraSelectExcelPath.appendChild(nodeExcel);
    const elementExcel = document.getElementById("excelButton");
    elementExcel.appendChild(paraSelectExcelPath);

    // // 填写多语言表的名称
    // const paraLanguage = document.createElement("input");
    // paraLanguage.className = "prefixClass"
    // paraLanguage.value = pathConfig.languageExcelName;
    // paraLanguage.style.color = "green";
    // const languageField = document.getElementById("languageField");
    // languageField.appendChild(paraLanguage);
    // languageField.scrollTop = languageField.scrollHeight;

    // // 寻找多语言表
    // const paraLanguageBtn = document.createElement("button");
    // paraLanguageBtn.className = "stepBtn"
    // paraLanguageBtn.addEventListener('click', async () => {
    //     // 刷新路径和当前文件
    //     window.electronAPI.onSelectFolderLanguage(paraExcel.value);
    // });
    // const node3 = document.createTextNode("选择多语言表..");
    // paraLanguageBtn.appendChild(node3);
    // const element3 = document.getElementById("languageButton");
    // element3.appendChild(paraLanguageBtn);

    // 添加前缀
    const paraPrefix = document.createElement("input");
    paraPrefix.className = "prefixClass"
    paraPrefix.value = pathConfig.prefix;
    paraPrefix.style.color = "green";
    const prefixField = document.getElementById("prefixField");
    prefixField.appendChild(paraPrefix);
    prefixField.scrollTop = prefixField.scrollHeight;

    // 开始收集
    const paraBtn = document.createElement("button");
    paraBtn.className = "startBtn"
    paraBtn.addEventListener('click', async () => {
        const [config, filePath] = await window.electronAPI.openFile();

        // 先修改前缀
        await window.electronAPI.changePrefixAndLanName(paraPrefix.value, config.languageExcelName);

        // 再开始收集
        window.electronAPI.runProgram(paraPrefix.value, config.excelPath, config.languageExcelName);
    });
    const node2 = document.createTextNode("开始收集");
    paraBtn.appendChild(node2);
    const element2 = document.getElementById("stepButton");
    element2.appendChild(paraBtn);

    // const [config, filePath] = await window.electronAPI.openFile();
    // for (let i = 0; i < filePath.length; i++) {
    //     const para = document.createElement("button");
    //     para.addEventListener('click', () => {
    //         window.electronAPI.runProgram(config.path, filePath[i], config.prefix);
    //     });
    //     const node = document.createTextNode(filePath[i]);
    //     para.appendChild(node);
    //     const element = document.getElementById("buttons");
    //     element.appendChild(para);
    // }
    const selectCanvas = document.getElementById("selectCanvas");
    const rootPathConfig = await window.electronAPI.getPathConfig();
    const select = document.createElement("select");
    select.className = "selectClass";
    for (let cfg of rootPathConfig) {
        const option1 = document.createElement("option");
        option1.text = cfg.ProjectName;
        select.add(option1, null);
    }
    selectCanvas.appendChild(select);
    select.addEventListener("change", () => {
        // 刷新选择的项目
        window.electronAPI.changeProject(select.value);
    });
    const selectBtn = document.createElement("button");
    selectBtn.className = "selectBtn";
    selectCanvas.appendChild(selectBtn);
    const refreshText = document.createTextNode("刷新路径");
    selectBtn.addEventListener("click", () => {
        // 刷新路径
        window.electronAPI.reload();
    });
    selectBtn.appendChild(refreshText);

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

function onClickButton1() {

}

runFunc();