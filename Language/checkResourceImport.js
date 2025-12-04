const fs = require('fs');
const path = require('path');
let isImport = false;
function findAllFileImport(uuid, dirPath) {
  return new Promise(async (resolve, reject) => {
    const files = fs.readdirSync(dirPath); // 读取目录下的所有文件和文件夹

    for (let file of files) {
      const filePath = path.join(dirPath, file); // 文件的完整路径
      const stats = fs.statSync(filePath); // 获取文件信息

      // 如果是文件，则进行处理
      if (stats.isFile()) {
        // 后缀必须是.ts
        if (
          filePath.endsWith('.prefab') ||
          filePath.endsWith('.fire') ||
          filePath.endsWith('.anim') ||
          filePath.endsWith('.plist') ||
          filePath.endsWith('.anim') ||
          filePath.endsWith('.atlas') ||
          filePath.endsWith('.json') ||
          filePath.endsWith('.particle') ||
          filePath.endsWith('.effect') ||
          filePath.endsWith('.mtl') ||
          filePath.endsWith('.material') ||
          filePath.endsWith('.tmx') ||
          filePath.endsWith('.tsx') ||
          filePath.endsWith('.scene')
        ) {
          // 读取对应文本
          await new Promise((resolve2, reject2) => {
            // let data = fs.readFileSync(filePath, "utf-8");

            fs.readFile(filePath, 'utf8', async (err, data) => {
              // await sleep(100);
              if (err) {
                console.error('errrr');
              }
              if (!data) {
                data = fs.readFileSync(filePath, 'utf8');
              }
              if (!data) {
                console.error(filePath + 'ERROR!!!!!');
                return resolve2(false);
              }
              if (data.indexOf(uuid) === -1) {
                return resolve2(true);
              }
              isImport = true;

              // await sleep(100);
              return resolve2(true);
            });
          });

          // console.log('ded');
        }
      } else if (stats.isDirectory()) {
        // 如果是文件夹，则递归调用函数继续读取文件夹内的文件
        await findAllFileImport(uuid, filePath);
      }
    }
    return resolve(true);
  });
}

function checkResourceImport(dir) {
  return new Promise(async (resolve, reject) => {
    let files = fs.readdirSync(dir);
    for (let file of files) {
      const fullPath = path.join(dir, file);

      if (!fs.statSync(fullPath).isDirectory()) {
        if (fullPath.indexOf('.png.meta') === -1) {
          continue;
        }
        let content = fs.readFileSync(fullPath, 'utf-8');

        let pjson = JSON.parse(content);
        let findUUid;
        for (let sbId in pjson.subMetas) {
          const newInfo = pjson.subMetas[sbId];
          if (newInfo['importer'] === 'sprite-frame') {
            findUUid = newInfo.uuid;
            break;
          }
        }
        isImport = false;

        // 找到后开始查找全部文件引用
        await findAllFileImport(findUUid, ROOT_PATH);

        if (!isImport) {
          logNotImportPathArr.push(fullPath.replace('.png.meta', '').replaceAll('\\', '/'));
          console.log('没有引用', path.join(fullPath, file));
        }
      } else {
        await checkResourceImport(fullPath);
      }
    }
    resolve();
  });
}

let logNotImportPathArr = [];
// const ROOT_PATH = 'E:/Codes/IAAGames/K1/B1-Client/assets';
const ROOT_PATH = 'D:/git/a3-client/A3-Client/assets';
checkResourceImport(ROOT_PATH).then(() => {
  console.log('done');

  // 把文件写入本地
  fs.writeFileSync(
    path.join(__dirname, 'logNotImportPathArr.txt'),
    JSON.stringify(logNotImportPathArr, null, 2)
  );
});
