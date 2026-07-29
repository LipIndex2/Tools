#!/usr/bin/env node

import fs from "fs";
import path from "path";

const cwd = process.cwd();
const REMOVE_DIR = path.join(cwd, "remove");

function printHelp() {
  console.log(`
清理指定路径下所有空文件夹工具

功能:
  递归扫描指定目录，删除其中所有空文件夹。
  默认不会删除传入的根目录本身，只清理根目录下面的空文件夹。
  会先模拟“子空目录删除后父目录是否也会变空”，避免嵌套空目录漏检。

用法:
  node js_script/cleanup-empty-dirs.mjs <目录路径> [选项]

选项:
  --dry-run       只扫描并输出报告，不实际删除
  --delete-root   如果根目录本身最终也为空，则允许删除根目录
  --help, -h      显示帮助

示例:
  node js_script/cleanup-empty-dirs.mjs "D:\\game\\Project\\assets"
  node js_script/cleanup-empty-dirs.mjs "D:\\game\\Project\\assets" --dry-run
  node js_script/cleanup-empty-dirs.mjs "D:\\game\\Project\\assets\\unused" --delete-root

输出:
  remove/cleanup-empty-dirs-report.json
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    targetPath: "",
    dryRun: false,
    deleteRoot: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--delete-root") {
      options.deleteRoot = true;
    } else if (!options.targetPath) {
      options.targetPath = arg;
    }
  }

  return options;
}

function normalizePath(filePath) {
  return path.resolve(filePath).replace(/\\/g, "/");
}

function displayPath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function validateTargetPath(targetPath) {
  if (!targetPath) {
    throw new Error("缺少目录路径。");
  }

  const resolved = path.resolve(targetPath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`路径不存在: ${resolved}`);
  }

  if (!fs.statSync(resolved).isDirectory()) {
    throw new Error(`目标路径不是目录: ${resolved}`);
  }

  return resolved;
}

function collectDirectoriesPostOrder(rootPath) {
  const directories = [];
  const failed = [];

  function walk(dirPath) {
    let entries = [];

    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (error) {
      failed.push({
        path: displayPath(dirPath),
        error: error.message,
      });
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      walk(path.join(dirPath, entry.name));
    }

    directories.push(dirPath);
  }

  walk(rootPath);
  return { directories, failed };
}

function getDirectoryEntries(dirPath) {
  try {
    return {
      entries: fs.readdirSync(dirPath, { withFileTypes: true }),
      error: null,
    };
  } catch (error) {
    return { entries: [], error };
  }
}

function findEmptyDirCandidates(rootPath, options) {
  const { directories, failed } = collectDirectoriesPostOrder(rootPath);
  const normalizedRoot = normalizePath(rootPath);
  const emptyDirSet = new Set();
  const candidates = [];

  for (const dirPath of directories) {
    const normalizedDir = normalizePath(dirPath);
    const isRoot = normalizedDir === normalizedRoot;
    const { entries, error } = getDirectoryEntries(dirPath);

    if (error) {
      failed.push({
        path: displayPath(dirPath),
        error: error.message,
      });
      continue;
    }

    let willBeEmpty = true;

    for (const entry of entries) {
      const childPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (!emptyDirSet.has(normalizePath(childPath))) {
          willBeEmpty = false;
          break;
        }
        continue;
      }

      willBeEmpty = false;
      break;
    }

    if (!willBeEmpty) {
      continue;
    }

    emptyDirSet.add(normalizedDir);

    if (isRoot && !options.deleteRoot) {
      continue;
    }

    candidates.push(dirPath);
  }

  // 删除必须子目录优先，避免父目录先删导致子目录路径不存在。
  candidates.sort((a, b) => b.length - a.length);

  return {
    scannedDirCount: directories.length,
    candidates,
    failed,
  };
}

function deleteEmptyDirCandidates(candidates) {
  const deleted = [];
  const failed = [];

  for (const dirPath of candidates) {
    try {
      if (!fs.existsSync(dirPath)) {
        continue;
      }

      const stat = fs.statSync(dirPath);
      if (!stat.isDirectory()) {
        continue;
      }

      const entries = fs.readdirSync(dirPath);
      if (entries.length > 0) {
        failed.push({
          path: displayPath(dirPath),
          error: "目录当前不是空目录，可能扫描后又产生了新文件",
        });
        continue;
      }

      fs.rmdirSync(dirPath);
      deleted.push(displayPath(dirPath));
    } catch (error) {
      failed.push({
        path: displayPath(dirPath),
        error: error.message,
      });
    }
  }

  return { deleted, failed };
}

function cleanupEmptyDirs(rootPath, options) {
  const scanResult = findEmptyDirCandidates(rootPath, options);

  if (options.dryRun) {
    return {
      scannedDirCount: scanResult.scannedDirCount,
      emptyDirs: scanResult.candidates.map(displayPath),
      deleted: [],
      failed: scanResult.failed,
    };
  }

  const deleteResult = deleteEmptyDirCandidates(scanResult.candidates);

  return {
    scannedDirCount: scanResult.scannedDirCount,
    emptyDirs: scanResult.candidates.map(displayPath),
    deleted: deleteResult.deleted,
    failed: [...scanResult.failed, ...deleteResult.failed],
  };
}

function writeReport(rootPath, options, result) {
  ensureDir(REMOVE_DIR);

  const report = {
    generatedAt: new Date().toISOString(),
    targetPath: displayPath(rootPath),
    dryRun: options.dryRun,
    deleteRoot: options.deleteRoot,
    summary: {
      scannedDirCount: result.scannedDirCount,
      emptyDirCount: result.emptyDirs.length,
      deletedDirCount: result.deleted.length,
      failedCount: result.failed.length,
    },
    emptyDirs: result.emptyDirs,
    deletedDirs: result.deleted,
    failed: result.failed,
  };

  const reportPath = path.join(REMOVE_DIR, "cleanup-empty-dirs-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  return reportPath;
}

function main() {
  const options = parseArgs(process.argv);

  if (options.help) {
    printHelp();
    return;
  }

  let rootPath;
  try {
    rootPath = validateTargetPath(options.targetPath);
  } catch (error) {
    console.error(`错误: ${error.message}`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  console.log(`开始扫描空文件夹: ${rootPath}`);
  if (options.dryRun) {
    console.log("当前为 --dry-run 模式，不会删除任何文件夹。");
  }
  if (options.deleteRoot) {
    console.log("已启用 --delete-root：如果根目录最终为空，也会删除根目录。");
  }

  const result = cleanupEmptyDirs(rootPath, options);
  const reportPath = writeReport(rootPath, options, result);

  console.log("");
  console.log("清理完成。");
  console.log(`扫描目录数: ${result.scannedDirCount}`);
  console.log(`发现空文件夹数: ${result.emptyDirs.length}`);
  console.log(`删除空文件夹数: ${result.deleted.length}`);
  console.log(`失败数: ${result.failed.length}`);

  if (result.failed.length > 0) {
    console.log("");
    console.log("失败列表:");
    for (const item of result.failed) {
      console.log(`- ${item.path}: ${item.error}`);
    }
  }

  console.log("");
  console.log(`报告已输出: ${reportPath}`);
}

main();