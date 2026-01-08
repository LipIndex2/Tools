// upload.js
const ci = require('miniprogram-ci');

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');

const simpleGit = require('simple-git');
// const git = simpleGit();

// 读取关卡数据
function readToJson(readPath) {
  const jsonString = fs.readFileSync(readPath, 'utf8');
  if (jsonString.charCodeAt(0) === 0xfeff) {
    // Remove BOM from the jsonString
    return JSON.parse(jsonString.slice(1));
  }
  return JSON.parse(jsonString);
}

// 压缩文件夹
function zipFolder(sourceDir, outPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`✅ 压缩完成: ${archive.pointer()} bytes`);
      resolve();
    });

    archive.on('error', reject);

    archive.pipe(output);

    const folderName = path.basename(sourceDir);
    archive.directory(sourceDir, folderName);

    archive.finalize();
  });
}

async function getGitBranchByFile(filePath) {
  try {
    const dir = path.dirname(filePath);
    const git = simpleGit(dir);

    const status = await git.status();
    return status.current;
  } catch (err) {
    console.error('获取 Git 分支失败:', err.message);
    return null;
  }
}

function buildCocos() {
  return new Promise((resolve, reject) => {
    console.log('🚀 开始构建 Cocos...');

    // const buildParam = ['configPath=' + BUILD_CONFIG_PATH].join(';');

    const child = spawn(
      wxploadConfig.cocosEnginePath, // CocosCreator.exe
      ['--project', PROJECT_PATH, '--build', 'configPath=' + BUILD_CONFIG_PATH],
      {
        shell: true,
        windowsHide: false,
      }
    );

    child.stdout.on('data', data => {
      process.stdout.write(data.toString());
    });

    child.stderr.on('data', data => {
      process.stderr.write(data.toString());
    });

    child.on('close', code => {
      if (code === 36) {
        console.log('✅ 构建完成');
        resolve();
      } else {
        reject(new Error(`❌ 构建失败，code=${code}`));
      }
    });

    child.on('error', err => {
      reject(err);
    });
  });
}

function runCosSyncer() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'cos_syncer.exe',
      [
        '-cos_dir',
        chooseCfg.cdnCode,
        '-remote_zip',
        ROMTE_ZIP_PATH,
        '-version',
        chooseCfg.cdnVersion,
      ],
      { shell: true }
    );

    // 输出信息
    child.stdout.on('data', data => process.stdout.write(data.toString()));
    child.stderr.on('data', data => process.stderr.write(data.toString()));

    child.on('close', code => {
      if (code === 0) {
        console.log('✅ cos_syncer 执行完成');
        resolve();
      } else {
        reject(new Error(`cos_syncer 执行失败，退出码 ${code}`));
      }
    });
  });
}

/**
 * 异步删除目录（递归）
 */
function removeDirAsync(dirPath) {
  return new Promise((resolve, reject) => {
    fs.rm(dirPath, { recursive: true, force: true }, err => {
      if (err) {
        reject(err);
      } else {
        console.log('目录已删除:', dirPath);
        resolve();
      }
    });
  });
}
// =================================================================logic=================================================================================

const branch = process.argv[2];

// 读取当前选择的配置
const wxploadConfig = readToJson(path.join(__dirname, 'wxploadConfig.json'));

const PROJECT_PATH = wxploadConfig.projectPath;

const WXUPLOAD_PATH = path.join(PROJECT_PATH, 'build/wechatgame');
const ROMTE_PATH = path.join(PROJECT_PATH, 'build/wechatgame/remote');
const ROMTE_ZIP_PATH = PROJECT_PATH + '/build/wechatgame/remote.zip';

const BUILD_CONFIG_PATH = path.join(PROJECT_PATH, 'buildConfig_wechatgame.json');

if (!wxploadConfig.gits[branch]) {
  console.error('无效分支:', branch);
  process.exit(1);
}

// 获取分支对应配置
const chooseCfg = wxploadConfig.gits[branch];
console.log('选择的分支配置:', chooseCfg);

getGitBranchByFile(PROJECT_PATH).then(async branch => {
  console.log('当前分支', branch);

  // 验证选择的分支名称是否
  if (branch !== branch) {
    console.error('选择的分支与当前的路径不匹配');
    process.exit(1);
  }

  // 如果有WXUPLOAD_PATH文件夹，先删除
  if (fs.existsSync(WXUPLOAD_PATH)) {
    await removeDirAsync(WXUPLOAD_PATH);
  }

  // 用法
  buildCocos()
    .then(async () => {
      console.log('➡️ 可以开始上传小程序了');

      // 压缩remote.zip
      await zipFolder(ROMTE_PATH, ROMTE_ZIP_PATH);

      // 开始上传cdn
      await runCosSyncer();

      // 删除remote
      await removeDirAsync(ROMTE_ZIP_PATH);
      await removeDirAsync(ROMTE_PATH);

      // 替换project.config.json里面的libVersion
      const projectConfigPath = path.join(WXUPLOAD_PATH, 'project.config.json');
      const projectConfig = readToJson(projectConfigPath);
      projectConfig.libVersion = wxploadConfig.libVersion;
      fs.writeFileSync(projectConfigPath, JSON.stringify(projectConfig, null, 2));

      const project = new ci.Project({
        appid: chooseCfg.appid,
        type: 'miniGame',
        projectPath: WXUPLOAD_PATH,
        privateKeyPath: chooseCfg.privateKeyPath,
      });

      ci.upload({
        project,
        version: chooseCfg.version,
        desc: chooseCfg.version + ' auto upload',
        setting: {
          es6: true,
          minify: true,
        },
      });
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
});
