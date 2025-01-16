import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer'
import exec from 'child_process';

// 指定路径
const zdPath = 'C:/MWEditor/MetaWorldSaved/Saved/MetaWorld/Project/Edit';

// 列出目标路径下的所有文件
const files = fs.readdirSync(zdPath);

// 提取文件名列表
const fileNames = files.filter(file => fs.statSync(path.join(zdPath, file)).isDirectory());

// 创建问题，用于选择文件
const fileQuestion = {
    type: 'list',
    name: 'selectedFile',
    message: 'Select a file:',
    choices: fileNames,
};

// 使用 path 模块规范化路径
var currentDir = path.dirname(new URL(import.meta.url).pathname);

// 指定要运行的 .bat 文件的路径
var batFilePath = currentDir.slice(1) + '/Language/ScriptToLanguage.bat';

// 提示用户选择文件
inquirer.prompt(fileQuestion)
    .then(answers => {
        const selectedFile = answers.selectedFile;
        console.log('You selected:', selectedFile);

        // 这里接入ToLanguage.bat
        // 运行 .bat 文件
        exec.exec(`start cmd /c "${batFilePath}"  ${zdPath + "/" + selectedFile} `, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error: ${error.message}`);
                return;
            }

            console.log(`打开ScriptToLanguage.bat成功！`);
        });
    })
    .catch(error => console.error('Error:', error));
