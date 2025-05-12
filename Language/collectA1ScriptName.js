// const fs = require("fs");
// const path = require("path");

// function getAllJsFiles(dirPath, fileList = []) {
//   const files = fs.readdirSync(dirPath);

//   files.forEach((file) => {
//     const filePath = path.join(dirPath, file);
//     const stat = fs.statSync(filePath);

//     if (stat.isDirectory()) {
//       getAllJsFiles(filePath, fileList); // 递归子目录
//     } else if (path.extname(file) === ".js") {
//       fileList.push({ path: filePath, name: file, newName: "" }); // 你也可以用 path.basename() 只取文件名
//     }
//   });

//   return fileList;
// }

// const constPath = "D:/git/a1-client/A1-client/assets/_script";

// // 指定目录（例如 ./assets/scripts）
// const targetDir = path.join(constPath);

// // 获取所有 JS 文件路径
// const jsFiles = getAllJsFiles(targetDir);

// // 写入 name.txt 到当前目录
// fs.writeFileSync("name.txt", jsFiles.join("\n"), "utf-8");

// console.log(`成功写入 ${jsFiles.length} 个 .js 文件名到 name.txt`);

////////////////////////////////

const fs = require("fs");
const path = require("path");

function getAllJsFiles(dirPath, fileList = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      getAllJsFiles(filePath, fileList); // 递归子目录
    } else if (path.extname(file) === ".js") {
      fileList.push({
        path: filePath,
        name: file,
        newName: file,
      });
    }
  });

  return fileList;
}

// 读取关卡数据
function readToJson(path) {
  const jsonString = fs.readFileSync(path, "utf8");
  if (jsonString.charCodeAt(0) === 0xfeff) {
    // Remove BOM from the jsonString
    return JSON.parse(jsonString.slice(1));
  }
  return JSON.parse(jsonString);
}

function readyNameList(data) {
  return new Promise((resolve, reject) => {
    // 读取指定路径的文件，和meta文件，改名称
    const filePath = data.path.replace(data.name, "");

    let name = data.name.replace(".js", "");
    let newName = data.newName.replace(".js", "");
    if (name === newName) {
      resolve();
      return;
    }

    let jsPath = path.join(filePath, name + ".js");
    let newJsPath = path.join(filePath, newName + ".js");
    let metaPath = path.join(filePath, name + ".js.meta");
    let newMetaPath = path.join(filePath, newName + ".js.meta");

    // 改成新的文件名
    fs.rename(jsPath, newJsPath, (err) => {
      if (err) {
        console.error("重命名失败:", err);
        resolve();
        return;
      }
      console.log("文件重命名成功");

      fs.rename(metaPath, newMetaPath, async (err) => {
        if (err) {
          console.error("重命名失败:", err);
          resolve();
          return;
        }

        // 搜索所有的ts和js脚本里面如果发现有同名的脚本名，直接替换
        await tryChangeScript(name, newName, targetDir).then(() => {
          resolve();
          console.log("文件重命名成功", name + "--" + newName);
        });
      });
    });
  });
}

// 尝试改变代码中的多语言函数
function tryChangeScript(keyword, newName, dirPath) {
  return new Promise(async (resolve, reject) => {
    const files = fs.readdirSync(dirPath); // 读取目录下的所有文件和文件夹

    for (let file of files) {
      const filePath = path.join(dirPath, file); // 文件的完整路径
      const stats = fs.statSync(filePath); // 获取文件信息

      // 如果是文件，则进行处理
      if (stats.isFile()) {
        if (
          filePath.indexOf("_script") === -1 &&
          (filePath.endsWith(".ts") || filePath.endsWith(".js"))
        ) {
          // 跳过
          continue;
        }

        // 后缀必须是.ts
        if (
          filePath.endsWith(".ts") ||
          filePath.endsWith(".js") ||
          filePath.endsWith(".prefab")
        ) {
          // 读取对应文本
          await new Promise((resolve2, reject2) => {
            let cb = (coding) => {
              fs.readFile(filePath, coding, async (err, data) => {
                if (err) {
                  consloe.error(err);

                  // 如果当前是utf16le格式，那就不用再试了
                  if (coding === "utf8") {
                    cb("utf16le");
                    return;
                  } else {
                    return resolve2(false);
                  }
                }

                if (
                  filePath.endsWith(".prefab") &&
                  filePath.indexOf("_UIBindings")
                ) {
                  data = data.replaceAll(keyword, newName);
                } else {
                  // 替换文件中的同名文件名称
                  data = data.replaceAll(keyword, newName);
                }

                // 文件写入
                fs.writeFile(filePath, data, (err) => {
                  if (err) {
                    consloe.error(err);
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
        }
      } else if (stats.isDirectory()) {
        // 如果是文件夹，则递归调用函数继续读取文件夹内的文件
        await tryChangeScript(keyword, newName, filePath);
      }
    }
    resolve(true);
  });
}

async function changeName(dirPath) {
  const nameJson = readToJson(dirPath);
  for (let data of nameJson) {
    await readyNameList(data);
  }
}

// 获取当前运行目录
const targetDir = "D:/git/a1-client/A1-client/assets";

changeName(__dirname + "\\name.json");

// 获取所有 JS 文件信息对象
// const jsFileInfoList = getAllJsFiles(targetDir);

// // 写入 name.json 到当前目录
// fs.writeFileSync(
//   path.join(__dirname, "name.json"),
//   JSON.stringify(jsFileInfoList, null, 2),
//   "utf-8"
// );

// console.log(`✅ 成功写入 ${jsFileInfoList.length} 条文件信息到 name.json`);
