#!/usr/bin/env node

import fs from "fs";
import path from "path";

const cwd = process.cwd();
const REMOVE_DIR = path.join(cwd, "remove");

const TEXT_SCAN_EXTENSIONS = new Set([
  ".meta",
  ".fire",
  ".prefab",
  ".scene",
  ".anim",
  ".animation",
  ".controller",
  ".material",
  ".effect",
  ".json",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".txt",
  ".plist",
  ".atlas",
  ".asset",
]);

const IGNORE_DIR_NAMES = new Set([
  ".git",
  ".svn",
  ".hg",
  "node_modules",
  "library",
  "local",
  "temp",
  "tmp",
  "build",
  "dist",
  "out",
  "packages",
  "remove",
]);

const MIN_UUID_LENGTH = 8;

function printHelp() {
  console.log(`
Cocos 资源关联递归删除工具

功能:
  传入一个路径后自动判断：
  1. 如果是 direct-delete.txt 这类删除列表文件，读取每行第一个资源路径，逐个删除资源及对应 .meta，不需要人工确认。
  2. 如果是单个资源路径，递归查找 UUID 引用关系连通分量，然后删除这些资源及对应 .meta，不需要人工确认。

用法:
  node js_script/delete-cocos-asset-relations.mjs <资源路径或删除列表txt路径> [选项]

选项:
  --root=<路径>              指定扫描根目录，建议传 Cocos assets 路径
  --include-dirs=a,b,c       额外包含默认忽略目录
  --dry-run                  只分析并输出报告，不删除
  --help, -h                 显示帮助

示例:
  node js_script/delete-cocos-asset-relations.mjs "remove\\direct-delete.txt"
  node js_script/delete-cocos-asset-relations.mjs "D:\\game\\Project\\assets\\textures\\unused.png"
  node js_script/delete-cocos-asset-relations.mjs "D:\\game\\Project\\assets\\prefabs\\Role.prefab" --root="D:\\game\\Project\\assets"
  node js_script/delete-cocos-asset-relations.mjs "D:\\game\\Project\\assets\\textures\\unused.png" --dry-run

输出:
  remove/delete-relations-report.json   本次待删除资源和引用关系报告

注意:
  这是高风险工具。现在不会二次确认，删除前请确保已经提交 Git 或完成备份。
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    targetPath: "",
    rootPath: "",
    includeDirs: new Set(),
    dryRun: false,
  };

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg.startsWith("--root=")) {
      options.rootPath = arg.slice("--root=".length).replace(/^"|"$/g, "");
    } else if (arg.startsWith("--include-dirs=")) {
      const names = arg
        .slice("--include-dirs=".length)
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);
      for (const name of names) {
        options.includeDirs.add(name.toLowerCase());
      }
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

function toRelative(filePath, basePath) {
  return displayPath(path.relative(basePath, filePath) || ".");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function shouldIgnoreDir(dirName, options) {
  const lower = dirName.toLowerCase();
  return IGNORE_DIR_NAMES.has(lower) && !options.includeDirs.has(lower);
}

function walkFiles(rootDir, options, files = []) {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      if (!shouldIgnoreDir(entry.name, options)) {
        walkFiles(fullPath, options, files);
      }
      continue;
    }

    if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function readTextSafely(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > 20 * 1024 * 1024) {
      return "";
    }
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function stripBom(content) {
  return content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;
}

function isValidCocosUuid(uuid) {
  return typeof uuid === "string" && uuid.length >= MIN_UUID_LENGTH && !/\s/.test(uuid);
}

function collectUuidValues(value, uuids) {
  if (!value || typeof value !== "object") {
    return;
  }

  if (typeof value.uuid === "string" && isValidCocosUuid(value.uuid)) {
    uuids.add(value.uuid);
  }

  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        collectUuidValues(item, uuids);
      }
    } else if (child && typeof child === "object") {
      collectUuidValues(child, uuids);
    }
  }
}

function extractUuidsFromMeta(metaPath) {
  const content = stripBom(readTextSafely(metaPath));
  if (!content) {
    return [];
  }

  try {
    const json = JSON.parse(content);
    const uuids = new Set();
    collectUuidValues(json, uuids);
    return Array.from(uuids);
  } catch {
    // 解析失败时用正则兜底。
  }

  const uuids = new Set();
  const uuidRegex = /"uuid"\s*:\s*"([^"]+)"/g;
  let matched = uuidRegex.exec(content);

  while (matched) {
    if (isValidCocosUuid(matched[1])) {
      uuids.add(matched[1]);
    }
    matched = uuidRegex.exec(content);
  }

  return Array.from(uuids);
}

function getAssetPathFromMeta(metaPath) {
  return metaPath.endsWith(".meta") ? metaPath.slice(0, -".meta".length) : metaPath;
}

function getAssetKind(assetPath) {
  if (!fs.existsSync(assetPath)) {
    return "meta-only";
  }

  const stat = fs.statSync(assetPath);
  if (stat.isDirectory()) {
    return "directory";
  }
  if (stat.isFile()) {
    return "file";
  }

  return "unknown";
}

function isTextScannable(filePath) {
  return TEXT_SCAN_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function findAssetsRoot(targetPath) {
  const resolved = path.resolve(targetPath);
  const parts = resolved.split(path.sep);

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (parts[index].toLowerCase() === "assets") {
      return parts.slice(0, index + 1).join(path.sep);
    }
  }

  let current = fs.existsSync(resolved) && fs.statSync(resolved).isDirectory() ? resolved : path.dirname(resolved);

  while (current && current !== path.dirname(current)) {
    const assetsPath = path.join(current, "assets");
    if (fs.existsSync(assetsPath) && fs.statSync(assetsPath).isDirectory()) {
      return assetsPath;
    }
    current = path.dirname(current);
  }

  return fs.existsSync(resolved) && fs.statSync(resolved).isDirectory() ? resolved : path.dirname(resolved);
}

function isDeleteListFile(filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }

  if (path.extname(filePath).toLowerCase() !== ".txt") {
    return false;
  }

  const content = readTextSafely(filePath);
  return /\buuid=/.test(content) || /直接删除列表|建议删除列表|考虑删除列表/.test(content);
}

function parseDeleteListFile(listPath) {
  const content = readTextSafely(listPath);
  const assetPaths = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("数量:") || line.includes("删除列表")) {
      continue;
    }

    const [assetPath] = line.split("\t");
    const normalizedAssetPath = assetPath.trim();
    if (normalizedAssetPath) {
      assetPaths.push(path.resolve(normalizedAssetPath));
    }
  }

  return Array.from(new Set(assetPaths.map(item => normalizePath(item)))).map(item => path.resolve(item));
}

function validateSingleAssetPaths(options) {
  if (!options.targetPath) {
    throw new Error("缺少资源路径。");
  }

  const targetPath = path.resolve(options.targetPath);

  if (!fs.existsSync(targetPath)) {
    throw new Error(`资源路径不存在: ${targetPath}`);
  }

  const rootPath = options.rootPath ? path.resolve(options.rootPath) : findAssetsRoot(targetPath);

  if (!fs.existsSync(rootPath) || !fs.statSync(rootPath).isDirectory()) {
    throw new Error(`扫描根目录不存在或不是目录: ${rootPath}`);
  }

  const normalizedTarget = normalizePath(targetPath);
  const normalizedRoot = normalizePath(rootPath);

  if (!normalizedTarget.startsWith(normalizedRoot)) {
    throw new Error(`资源路径不在扫描根目录内。资源: ${targetPath}，根目录: ${rootPath}`);
  }

  return { targetPath, rootPath };
}

function collectAssets(files, rootPath) {
  const assets = [];
  const byAssetPath = new Map();
  const byMetaPath = new Map();
  const byUuid = new Map();

  for (const filePath of files) {
    if (!filePath.endsWith(".meta")) {
      continue;
    }

    const uuids = extractUuidsFromMeta(filePath);
    if (uuids.length === 0) {
      continue;
    }

    const assetPath = getAssetPathFromMeta(filePath);
    const asset = {
      id: assets.length,
      uuid: uuids[0],
      uuids,
      assetPath,
      metaPath: filePath,
      kind: getAssetKind(assetPath),
      ext: path.extname(assetPath).toLowerCase(),
      relativeAssetPath: toRelative(assetPath, rootPath),
      relativeMetaPath: toRelative(filePath, rootPath),
      outgoingIds: new Set(),
      incomingIds: new Set(),
      outgoingReasons: [],
      incomingReasons: [],
    };

    assets.push(asset);
    byAssetPath.set(normalizePath(assetPath), asset);
    byMetaPath.set(normalizePath(filePath), asset);

    for (const uuid of uuids) {
      if (!byUuid.has(uuid)) {
        byUuid.set(uuid, []);
      }
      byUuid.get(uuid).push(asset);
    }
  }

  return { assets, byAssetPath, byMetaPath, byUuid };
}

function findOwnerAsset(filePath, byAssetPath, byMetaPath) {
  const normalized = normalizePath(filePath);

  if (byMetaPath.has(normalized)) {
    return byMetaPath.get(normalized);
  }

  if (byAssetPath.has(normalized)) {
    return byAssetPath.get(normalized);
  }

  const metaPath = `${normalized}.meta`;
  if (byMetaPath.has(metaPath)) {
    return byMetaPath.get(metaPath);
  }

  return null;
}

function buildReferenceGraph(files, assetIndex, rootPath) {
  const { byUuid, byAssetPath, byMetaPath } = assetIndex;
  const uuids = Array.from(byUuid.keys());

  for (const filePath of files) {
    if (!isTextScannable(filePath)) {
      continue;
    }

    const owner = findOwnerAsset(filePath, byAssetPath, byMetaPath);
    if (!owner) {
      continue;
    }

    const content = readTextSafely(filePath);
    if (!content) {
      continue;
    }

    for (const uuid of uuids) {
      if (!content.includes(uuid)) {
        continue;
      }

      const targets = byUuid.get(uuid) || [];
      for (const target of targets) {
        // 忽略资源自己的 meta 中声明的 uuid。
        if (normalizePath(filePath) === normalizePath(target.metaPath)) {
          continue;
        }

        if (owner.id === target.id) {
          continue;
        }

        owner.outgoingIds.add(target.id);
        target.incomingIds.add(owner.id);

        const reason = {
          from: owner.relativeAssetPath,
          to: target.relativeAssetPath,
          uuid,
          file: toRelative(filePath, rootPath),
        };

        owner.outgoingReasons.push(reason);
        target.incomingReasons.push(reason);
      }
    }
  }
}

function findStartAsset(targetPath, assetIndex) {
  const normalizedTarget = normalizePath(targetPath);
  const normalizedMeta = normalizedTarget.endsWith(".meta") ? normalizedTarget : `${normalizedTarget}.meta`;

  if (assetIndex.byAssetPath.has(normalizedTarget)) {
    return assetIndex.byAssetPath.get(normalizedTarget);
  }

  if (assetIndex.byMetaPath.has(normalizedTarget)) {
    return assetIndex.byMetaPath.get(normalizedTarget);
  }

  if (assetIndex.byMetaPath.has(normalizedMeta)) {
    return assetIndex.byMetaPath.get(normalizedMeta);
  }

  return null;
}

function collectConnectedAssets(startAsset, assets) {
  const selected = new Set([startAsset.id]);
  const queue = [startAsset.id];

  while (queue.length > 0) {
    const currentId = queue.shift();
    const current = assets[currentId];
    const neighbors = new Set([...current.outgoingIds, ...current.incomingIds]);

    for (const nextId of neighbors) {
      if (!selected.has(nextId)) {
        selected.add(nextId);
        queue.push(nextId);
      }
    }
  }

  return Array.from(selected)
    .map(id => assets[id])
    .sort((a, b) => a.relativeAssetPath.localeCompare(b.relativeAssetPath, "zh-CN"));
}

function makeReport(targetPath, rootPath, startAsset, selectedAssets) {
  const selectedIds = new Set(selectedAssets.map(asset => asset.id));
  const relations = [];

  for (const asset of selectedAssets) {
    for (const reason of asset.outgoingReasons) {
      const targetAsset = selectedAssets.find(item => item.relativeAssetPath === reason.to);
      if (targetAsset && selectedIds.has(targetAsset.id)) {
        relations.push(reason);
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    targetPath: displayPath(targetPath),
    rootPath: displayPath(rootPath),
    startAsset: {
      uuid: startAsset.uuid,
      uuids: startAsset.uuids,
      assetPath: displayPath(startAsset.assetPath),
      metaPath: displayPath(startAsset.metaPath),
      relativeAssetPath: startAsset.relativeAssetPath,
      kind: startAsset.kind,
    },
    summary: {
      deleteAssetCount: selectedAssets.length,
      fileCount: selectedAssets.filter(asset => asset.kind === "file").length,
      directoryCount: selectedAssets.filter(asset => asset.kind === "directory").length,
      metaOnlyCount: selectedAssets.filter(asset => asset.kind === "meta-only").length,
      relationCount: relations.length,
    },
    assets: selectedAssets.map(asset => ({
      uuid: asset.uuid,
      uuids: asset.uuids,
      assetPath: displayPath(asset.assetPath),
      metaPath: displayPath(asset.metaPath),
      relativeAssetPath: asset.relativeAssetPath,
      relativeMetaPath: asset.relativeMetaPath,
      kind: asset.kind,
      ext: asset.ext,
      referencedBy: asset.incomingReasons.map(item => ({
        from: item.from,
        file: item.file,
        uuid: item.uuid,
      })),
      references: asset.outgoingReasons.map(item => ({
        to: item.to,
        file: item.file,
        uuid: item.uuid,
      })),
    })),
    relations,
  };
}

function writeReport(report) {
  ensureDir(REMOVE_DIR);
  const reportPath = path.join(REMOVE_DIR, "delete-relations-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  return reportPath;
}

function printDeletePreview(report) {
  console.log("");
  console.log("即将删除以下资源及对应 .meta：");
  console.log(`扫描根目录: ${report.rootPath}`);
  console.log(`起始资源: ${report.startAsset.relativeAssetPath}`);
  console.log(`资源数量: ${report.summary.deleteAssetCount}`);
  console.log(`引用关系数量: ${report.summary.relationCount}`);
  console.log("");

  for (const asset of report.assets) {
    console.log(`- ${asset.relativeAssetPath}`);
    console.log(`  uuid: ${asset.uuids.join(",")}`);
    console.log(`  类型: ${asset.kind}${asset.ext ? ` ${asset.ext}` : ""}`);
    if (asset.references.length > 0) {
      console.log(`  引用了: ${asset.references.map(item => item.to).join(", ")}`);
    }
    if (asset.referencedBy.length > 0) {
      console.log(`  被引用: ${asset.referencedBy.map(item => item.from).join(", ")}`);
    }
  }

  console.log("");
}

function createAssetForPath(assetPath) {
  const resolvedAssetPath = path.resolve(assetPath);
  const metaPath = resolvedAssetPath.endsWith(".meta") ? resolvedAssetPath : `${resolvedAssetPath}.meta`;
  const realAssetPath = resolvedAssetPath.endsWith(".meta") ? getAssetPathFromMeta(resolvedAssetPath) : resolvedAssetPath;

  return {
    assetPath: realAssetPath,
    metaPath,
    kind: getAssetKind(realAssetPath),
  };
}

function deleteAssetPaths(assetPaths) {
  return deleteAssetFiles(assetPaths.map(createAssetForPath));
}

function makeListDeleteReport(listPath, assetPaths, result, dryRun) {
  return {
    generatedAt: new Date().toISOString(),
    mode: "delete-list",
    listPath: displayPath(listPath),
    dryRun,
    summary: {
      assetCount: assetPaths.length,
      deletePathCount: result.deleted.length,
      failedCount: result.failed.length,
      cleanedEmptyDirCount: result.cleanedEmptyDirs?.length || 0,
      cleanupFailedCount: result.cleanupFailed?.length || 0,
    },
    assets: assetPaths.map(assetPath => {
      const asset = createAssetForPath(assetPath);
      return {
        assetPath: displayPath(asset.assetPath),
        metaPath: displayPath(asset.metaPath),
        kind: asset.kind,
      };
    }),
    deleteResult: result,
  };
}

function isSubPath(childPath, parentPath) {
  const relative = path.relative(parentPath, childPath);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function cleanupEmptyParentDirs(assets) {
  const cleanedEmptyDirs = [];
  const cleanupFailed = [];
  const candidates = new Set();

  for (const asset of assets) {
    const rootPath = findAssetsRoot(asset.assetPath);
    const paths = [asset.assetPath, asset.metaPath];

    for (const itemPath of paths) {
      let current = path.dirname(itemPath);

      while (
        current
        && current !== path.dirname(current)
        && normalizePath(current) !== normalizePath(rootPath)
        && isSubPath(current, rootPath)
      ) {
        candidates.add(current);
        current = path.dirname(current);
      }
    }
  }

  const sortedCandidates = Array.from(candidates)
    .sort((a, b) => b.length - a.length);

  for (const dirPath of sortedCandidates) {
    try {
      if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
        continue;
      }

      if (fs.readdirSync(dirPath).length > 0) {
        continue;
      }

      fs.rmdirSync(dirPath);
      cleanedEmptyDirs.push(displayPath(dirPath));
    } catch (error) {
      cleanupFailed.push({
        path: displayPath(dirPath),
        error: error.message,
      });
    }
  }

  return { cleanedEmptyDirs, cleanupFailed };
}

function deleteAssetFiles(assets) {
  const deleted = [];
  const failed = [];

  // 先删文件，再删目录，避免目录提前删除导致重复报错。
  const sorted = assets.slice().sort((a, b) => {
    if (a.kind === "directory" && b.kind !== "directory") return 1;
    if (a.kind !== "directory" && b.kind === "directory") return -1;
    return b.assetPath.length - a.assetPath.length;
  });

  for (const asset of sorted) {
    const targets = [];

    if (asset.kind === "file" || asset.kind === "directory") {
      targets.push(asset.assetPath);
    }
    targets.push(asset.metaPath);

    for (const target of targets) {
      try {
        if (!fs.existsSync(target)) {
          continue;
        }

        fs.rmSync(target, { recursive: true, force: true });
        deleted.push(displayPath(target));
      } catch (error) {
        failed.push({
          path: displayPath(target),
          error: error.message,
        });
      }
    }
  }

  const cleanupResult = cleanupEmptyParentDirs(sorted);

  return {
    deleted,
    failed,
    cleanedEmptyDirs: cleanupResult.cleanedEmptyDirs,
    cleanupFailed: cleanupResult.cleanupFailed,
  };
}

function handleDeleteList(listPath, options) {
  const assetPaths = parseDeleteListFile(listPath);
  console.log(`删除列表: ${listPath}`);
  console.log(`读取资源路径数: ${assetPaths.length}`);

  const result = options.dryRun ? { deleted: [], failed: [] } : deleteAssetPaths(assetPaths);

  const report = makeListDeleteReport(listPath, assetPaths, result, options.dryRun);
  const reportPath = writeReport(report);

  if (options.dryRun) {
    console.log("当前为 --dry-run 模式，不会删除任何文件。");
  } else {
    console.log(`删除完成。成功删除路径数: ${result.deleted.length}`);
    if (result.failed.length > 0) {
      console.log(`删除失败路径数: ${result.failed.length}`);
      for (const item of result.failed) {
        console.log(`- ${item.path}: ${item.error}`);
      }
    }
    if (result.cleanedEmptyDirs?.length > 0) {
      console.log(`清理空文件夹数: ${result.cleanedEmptyDirs.length}`);
    }
    if (result.cleanupFailed?.length > 0) {
      console.log(`空文件夹清理失败数: ${result.cleanupFailed.length}`);
      for (const item of result.cleanupFailed) {
        console.log(`- ${item.path}: ${item.error}`);
      }
    }
  }

  console.log(`删除报告已输出: ${reportPath}`);
}

async function main() {
  const options = parseArgs(process.argv);

  if (options.help) {
    printHelp();
    return;
  }

  const inputPath = path.resolve(options.targetPath || "");

  if (options.targetPath && isDeleteListFile(inputPath)) {
    try {
      handleDeleteList(inputPath, options);
    } catch (error) {
      console.error(`错误: ${error.message}`);
      process.exitCode = 1;
    }
    return;
  }

  let targetPath;
  let rootPath;

  try {
    const validated = validateSingleAssetPaths(options);
    targetPath = validated.targetPath;
    rootPath = validated.rootPath;
  } catch (error) {
    console.error(`错误: ${error.message}`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  console.log(`扫描根目录: ${rootPath}`);
  console.log(`目标资源: ${targetPath}`);

  const files = walkFiles(rootPath, options);
  console.log(`扫描文件数: ${files.length}`);

  const assetIndex = collectAssets(files, rootPath);
  console.log(`发现带 UUID 的资源 meta 数: ${assetIndex.assets.length}`);

  const startAsset = findStartAsset(targetPath, assetIndex);
  if (!startAsset) {
    console.error("错误: 没有找到目标资源对应的 .meta 或 UUID，无法建立引用关系。");
    process.exitCode = 1;
    return;
  }

  buildReferenceGraph(files, assetIndex, rootPath);

  const selectedAssets = collectConnectedAssets(startAsset, assetIndex.assets);
  const report = makeReport(targetPath, rootPath, startAsset, selectedAssets);
  const reportPath = writeReport(report);

  printDeletePreview(report);
  console.log(`报告已输出: ${reportPath}`);

  if (options.dryRun) {
    console.log("当前为 --dry-run 模式，不会删除任何文件。");
    return;
  }

  const result = deleteAssetFiles(selectedAssets);
  report.deletedAt = new Date().toISOString();
  report.deleteResult = result;
  writeReport(report);

  console.log("");
  console.log(`删除完成。成功删除路径数: ${result.deleted.length}`);
  if (result.failed.length > 0) {
    console.log(`删除失败路径数: ${result.failed.length}`);
    for (const item of result.failed) {
      console.log(`- ${item.path}: ${item.error}`);
    }
  }
  if (result.cleanedEmptyDirs?.length > 0) {
    console.log(`清理空文件夹数: ${result.cleanedEmptyDirs.length}`);
  }
  if (result.cleanupFailed?.length > 0) {
    console.log(`空文件夹清理失败数: ${result.cleanupFailed.length}`);
    for (const item of result.cleanupFailed) {
      console.log(`- ${item.path}: ${item.error}`);
    }
  }
  console.log(`删除报告已更新: ${reportPath}`);
}

main();
