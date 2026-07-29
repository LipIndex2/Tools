#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const cwd = process.cwd();
const REMOVE_DIR = path.join(cwd, "remove");

const SAFE_DIRECT_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".tga",
  ".mp3",
  ".wav",
  ".ogg",
  ".m4a",
  ".plist",
  ".atlas",
  ".txt",
  ".csv",
]);

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".tga",
]);

const SUGGESTED_EXTENSIONS = new Set([
  ".prefab",
  ".fire",
  ".scene",
  ".anim",
  ".animation",
  ".material",
  ".mtl",
  ".effect",
  ".spriteatlas",
  ".ttf",
  ".fnt",
  ".font",
  ".json",
]);

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

const DYNAMIC_PATH_KEYWORDS = ["resources", "resource", "bundle", "bundles", "remote", "dynamic", "load", "preload", "res"];

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
const DEFAULT_DIRECT_DELETE_BEFORE = "2026-05-30";

function printHelp() {
  console.log(`
Cocos 资源 UUID 未引用检查工具

用法:
  node js_script/check-cocos-unused-assets.mjs <Cocos项目路径或assets路径> [选项]

选项:
  --include-dirs=a,b,c       额外包含目录名，默认会忽略 library/local/temp/build 等目录
  --no-delete-bat            不生成 delete-direct.bat
  --direct-before=YYYY-MM-DD 直接删除要求文件最后 Git 提交早于该日期，默认 2026-05-29
  --help, -h                 显示帮助

示例:
  node js_script/check-cocos-unused-assets.mjs "D:\\git\\a3-client\\A3-Client\\assets"
  node js_script/check-cocos-unused-assets.mjs "D:\\git\\a3-client\\A3-Client"

输出:
  remove/unused-assets.json       完整结果
  remove/direct-delete.txt        可直接删除列表
  remove/suggested-delete.txt     建议删除列表
  remove/consider-delete.txt      考虑删除列表
  remove/delete-direct.bat        删除“直接删除”层级资源的批处理脚本
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    targetPath: "",
    includeDirs: new Set(),
    generateDeleteBat: true,
    directDeleteBefore: DEFAULT_DIRECT_DELETE_BEFORE,
  };

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg.startsWith("--include-dirs=")) {
      const names = arg
        .slice("--include-dirs=".length)
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);
      for (const name of names) {
        options.includeDirs.add(name.toLowerCase());
      }
    } else if (arg === "--no-delete-bat") {
      options.generateDeleteBat = false;
    } else if (arg.startsWith("--direct-before=")) {
      options.directDeleteBefore = arg.slice("--direct-before=".length).trim();
    } else if (!options.targetPath) {
      options.targetPath = arg;
    }
  }

  return options;
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function toRelative(filePath, basePath = cwd) {
  return normalizePath(path.relative(basePath, filePath) || ".");
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
    // 过大的二进制或构建产物不适合整文件扫描，避免内存占用过高。
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
    // Cocos 的 meta 通常是 JSON；如果解析失败，再用正则兜底。
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

function isValidCocosUuid(uuid) {
  // Cocos Creator 常见 uuid 包括：
  // 1. 36 位标准 UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  // 2. 32 位无横杠 UUID
  // 3. 22 位压缩 UUID，例如 Cocos 2.x/3.x meta 中常见格式
  return typeof uuid === "string" && uuid.length >= MIN_UUID_LENGTH && !/\s/.test(uuid);
}

function getAssetPathFromMeta(metaPath) {
  return metaPath.endsWith(".meta") ? metaPath.slice(0, -".meta".length) : metaPath;
}

function getAssetKind(assetPath, metaPath) {
  if (fs.existsSync(assetPath)) {
    const stat = fs.statSync(assetPath);
    if (stat.isDirectory()) {
      return "directory";
    }
    if (stat.isFile()) {
      return "file";
    }
  }

  if (fs.existsSync(metaPath)) {
    return "meta-only";
  }

  return "missing";
}

function isTextScannable(filePath) {
  return TEXT_SCAN_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function collectAssets(files, targetPath) {
  const assets = [];

  for (const filePath of files) {
    if (!filePath.endsWith(".meta")) {
      continue;
    }

    const uuids = extractUuidsFromMeta(filePath);
    if (uuids.length === 0) {
      continue;
    }

    const assetPath = getAssetPathFromMeta(filePath);
    const ext = path.extname(assetPath).toLowerCase();
    const kind = getAssetKind(assetPath, filePath);

    // 只检查真实文件资源，不检查文件夹 .meta。
    if (kind !== "file") {
      continue;
    }

    assets.push({
      uuid: uuids[0],
      uuids,
      assetPath,
      metaPath: filePath,
      relativeAssetPath: toRelative(assetPath, targetPath),
      relativeMetaPath: toRelative(filePath, targetPath),
      ext,
      kind,
      references: [],
      referenceCount: 0,
      level: "",
      levelName: "",
      reason: "",
    });
  }

  return assets;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeReferenceText(text) {
  return normalizePath(text).toLowerCase();
}

function getPathReferenceCandidates(asset, targetPath) {
  const relativePath = normalizeReferenceText(asset.relativeAssetPath);
  const ext = asset.ext.toLowerCase();
  const withoutExt = relativePath.endsWith(ext)
    ? relativePath.slice(0, -ext.length)
    : relativePath;
  const basename = path.basename(asset.assetPath).toLowerCase();
  const basenameWithoutExt = basename.endsWith(ext)
    ? basename.slice(0, -ext.length)
    : basename;

  return Array.from(new Set([
    relativePath,
    withoutExt,
    basename,
    basenameWithoutExt,
  ].filter(item => item && item.length >= 3)));
}

function hasPathReference(content, candidates) {
  const normalizedContent = normalizeReferenceText(content);
  return candidates.some((candidate) => {
    const pattern = new RegExp(`(^|[^\\w./-])${escapeRegExp(candidate)}($|[^\\w./-])`, "i");
    return pattern.test(normalizedContent);
  });
}

function collectReferences(files, assets, targetPath) {
  const uuidToAssets = new Map();

  for (const asset of assets) {
    for (const uuid of asset.uuids) {
      if (!uuidToAssets.has(uuid)) {
        uuidToAssets.set(uuid, []);
      }
      uuidToAssets.get(uuid).push(asset);
    }
  }

  const uuidSet = new Set(uuidToAssets.keys());
  const pathReferenceAssets = assets
    .filter(asset => IMAGE_EXTENSIONS.has(asset.ext))
    .map(asset => ({
      asset,
      candidates: getPathReferenceCandidates(asset, targetPath),
    }));

  for (const filePath of files) {
    if (!isTextScannable(filePath)) {
      continue;
    }

    const content = readTextSafely(filePath);
    if (!content) {
      continue;
    }

    const foundInFile = new Set();

    for (const uuid of uuidSet) {
      if (content.includes(uuid)) {
        foundInFile.add(uuid);
      }
    }

    for (const { asset, candidates } of pathReferenceAssets) {
      if (path.resolve(filePath) === path.resolve(asset.metaPath)) {
        continue;
      }

      if (path.resolve(filePath) === path.resolve(asset.assetPath)) {
        continue;
      }

      if (hasPathReference(content, candidates)) {
        asset.references.push(`${toRelative(filePath, targetPath)}#path`);
      }
    }

    if (foundInFile.size === 0) {
      continue;
    }

    for (const uuid of foundInFile) {
      const matchedAssets = uuidToAssets.get(uuid) || [];

      for (const asset of matchedAssets) {
        // 忽略资源自己的 meta 文件，否则每个资源都会因为自身 uuid 被误判为已引用。
        if (path.resolve(filePath) === path.resolve(asset.metaPath)) {
          continue;
        }

        asset.references.push(`${toRelative(filePath, targetPath)}#uuid`);
      }
    }
  }

  for (const asset of assets) {
    asset.references = Array.from(new Set(asset.references)).sort();
    asset.referenceCount = asset.references.length;
  }
}

function hasDynamicPathRisk(relativeAssetPath) {
  const parts = normalizePath(relativeAssetPath).toLowerCase().split("/").filter(Boolean);

  return parts.some(part => DYNAMIC_PATH_KEYWORDS.includes(part));
}

function findGitRoot(targetPath) {
  try {
    return execFileSync("git", ["-C", targetPath, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function getGitLastCommitInfo(filePath, gitRoot) {
  if (!gitRoot) {
    return {
      committed: false,
      timestamp: 0,
      date: "",
      hash: "",
      reason: "未找到 Git 仓库",
    };
  }

  try {
    const output = execFileSync("git", ["-C", gitRoot, "log", "-1", "--format=%ct|%h|%ci", "--", filePath], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    if (!output) {
      return {
        committed: false,
        timestamp: 0,
        date: "",
        hash: "",
        reason: "Git 中未找到该文件提交记录，可能是未跟踪或新文件",
      };
    }

    const [timestampText, hash, ...dateParts] = output.split("|");
    const timestamp = Number(timestampText);

    return {
      committed: Number.isFinite(timestamp) && timestamp > 0,
      timestamp,
      date: dateParts.join("|"),
      hash,
      reason: "",
    };
  } catch {
    return {
      committed: false,
      timestamp: 0,
      date: "",
      hash: "",
      reason: "读取 Git 最后提交时间失败",
    };
  }
}

function enrichAssetsWithGitInfo(assets, targetPath) {
  const gitRoot = findGitRoot(targetPath);
  for (const asset of assets) {
    asset.git = getGitLastCommitInfo(asset.assetPath, gitRoot);
  }
}

function parseCutoffTimestamp(dateText) {
  const timestamp = Date.parse(`${dateText}T00:00:00+08:00`);

  if (Number.isNaN(timestamp)) {
    throw new Error(`无效的 --direct-before 日期: ${dateText}`);
  }

  return Math.floor(timestamp / 1000);
}

function isBeforeDirectDeleteCutoff(asset, options) {
  const cutoffTimestamp = parseCutoffTimestamp(options.directDeleteBefore);

  return Boolean(asset.git && asset.git.committed && asset.git.timestamp > 0 && asset.git.timestamp < cutoffTimestamp);
}

function formatGitReason(asset) {
  if (!asset.git || !asset.git.committed) {
    return asset.git?.reason || "没有 Git 提交时间";
  }

  return `最后 Git 提交: ${asset.git.date || asset.git.timestamp}, commit=${asset.git.hash}`;
}

function classifyAsset(asset, options) {
  const dynamicRisk = hasDynamicPathRisk(asset.relativeAssetPath);

  if (asset.referenceCount > 0) {
    return {
      level: "used",
      levelName: "已引用",
      reason: `发现 ${asset.referenceCount} 个引用文件`,
    };
  }

  if (asset.kind === "meta-only") {
    return {
      level: "consider-delete",
      levelName: "考虑删除",
      reason: "仅存在 meta，未找到对应资源文件；可能是残留 meta，也可能资源路径异常",
    };
  }

  if (dynamicRisk) {
    return {
      level: "consider-delete",
      levelName: "考虑删除",
      reason: "路径包含 resources/bundle/remote/dynamic/load/preload 等动态加载关键词",
    };
  }

  if (SAFE_DIRECT_EXTENSIONS.has(asset.ext)) {
    if (isBeforeDirectDeleteCutoff(asset, options)) {
      return {
        level: "direct-delete",
        levelName: "直接删除",
        reason: `普通静态资源未发现 UUID 引用，且不在高风险动态加载目录；${formatGitReason(asset)}，早于 ${options.directDeleteBefore}`,
      };
    }

    return {
      level: "suggested-delete",
      levelName: "建议删除",
      reason: `普通静态资源未发现 UUID 引用，但不满足“直接删除”Git 时间要求：${formatGitReason(asset)}，要求早于 ${
        options.directDeleteBefore
      }`,
    };
  }

  if (SUGGESTED_EXTENSIONS.has(asset.ext)) {
    return {
      level: "suggested-delete",
      levelName: "建议删除",
      reason: "资源未发现 UUID 引用，但类型可能作为场景/预制体/材质/配置入口，需要确认",
    };
  }

  return {
    level: "consider-delete",
    levelName: "考虑删除",
    reason: "未知或高风险资源类型，未发现 UUID 引用，需要人工确认",
  };
}

function classifyAssets(assets, options) {
  for (const asset of assets) {
    const result = classifyAsset(asset, options);
    asset.level = result.level;
    asset.levelName = result.levelName;
    asset.reason = result.reason;
  }
}

function groupByLevel(assets) {
  return {
    used: assets.filter(item => item.level === "used"),
    directDelete: assets.filter(item => item.level === "direct-delete"),
    suggestedDelete: assets.filter(item => item.level === "suggested-delete"),
    considerDelete: assets.filter(item => item.level === "consider-delete"),
  };
}

function formatAssetLine(asset) {
  return [
    normalizePath(asset.assetPath),
    `uuid=${asset.uuids.join(",")}`,
    `type=${asset.ext || asset.kind}`,
    `reason=${asset.reason}`,
  ].join("\t");
}

function writeListFile(filePath, title, assets) {
  const lines = [title, `数量: ${assets.length}`, "", ...assets.map(formatAssetLine), ""];

  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
}

function escapeBatPath(filePath) {
  return filePath.replace(/"/g, '""');
}

function getAssetsRootFromPath(filePath) {
  const resolved = path.resolve(filePath);
  const parts = resolved.split(path.sep);

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (parts[index].toLowerCase() === "assets") {
      return parts.slice(0, index + 1).join(path.sep);
    }
  }

  return "";
}

function collectEmptyDirCleanupCandidates(assets) {
  const candidates = new Set();

  for (const asset of assets) {
    const rootPath = getAssetsRootFromPath(asset.assetPath);
    if (!rootPath) {
      continue;
    }

    for (const itemPath of [asset.assetPath, asset.metaPath]) {
      let current = path.dirname(itemPath);

      while (
        current
        && current !== path.dirname(current)
        && path.resolve(current) !== path.resolve(rootPath)
        && !path.relative(rootPath, current).startsWith("..")
      ) {
        candidates.add(current);
        current = path.dirname(current);
      }
    }
  }

  return Array.from(candidates)
    .sort((a, b) => b.length - a.length);
}

function writeDeleteBat(filePath, directAssets) {
  const lines = [
    "@echo off",
    "chcp 65001 >nul",
    "echo 即将删除“直接删除”层级资源及对应 .meta 文件",
    "echo 请确认 direct-delete.txt 后再执行本脚本。",
    "pause",
    "",
  ];

  for (const asset of directAssets) {
    if (asset.kind === "file") {
      lines.push(`if exist "${escapeBatPath(asset.assetPath)}" del /f /q "${escapeBatPath(asset.assetPath)}"`);
    }
    lines.push(`if exist "${escapeBatPath(asset.metaPath)}" del /f /q "${escapeBatPath(asset.metaPath)}"`);
  }

  const emptyDirCandidates = collectEmptyDirCleanupCandidates(directAssets);
  if (emptyDirCandidates.length > 0) {
    lines.push("");
    lines.push("echo 正在清理空文件夹...");
    for (const dirPath of emptyDirCandidates) {
      lines.push(`if exist "${escapeBatPath(dirPath)}" rd "${escapeBatPath(dirPath)}" 2>nul`);
    }
  }

  lines.push("");
  lines.push("echo 删除完成。");
  lines.push("pause");

  fs.writeFileSync(filePath, lines.join("\r\n"), "utf8");
}

function writeOutputs(targetPath, assets, options) {
  ensureDir(REMOVE_DIR);

  const grouped = groupByLevel(assets);
  const report = {
    generatedAt: new Date().toISOString(),
    targetPath,
    summary: {
      totalAssets: assets.length,
      used: grouped.used.length,
      directDelete: grouped.directDelete.length,
      suggestedDelete: grouped.suggestedDelete.length,
      considerDelete: grouped.considerDelete.length,
    },
    levels: {
      directDelete: `直接删除：普通静态资源，未发现 UUID 引用，不在动态加载风险目录，且文件最后 Git 提交早于 ${options.directDeleteBefore}。`,
      suggestedDelete: "建议删除：未发现 UUID 引用，但资源类型可能作为入口或被特殊方式使用。",
      considerDelete: "考虑删除：动态加载风险目录、meta-only 或未知类型。",
    },
    assets: [...grouped.directDelete, ...grouped.suggestedDelete, ...grouped.considerDelete]
      .sort((a, b) => a.relativeAssetPath.localeCompare(b.relativeAssetPath, "zh-CN"))
      .map(asset => ({
        uuid: asset.uuid,
        uuids: asset.uuids,
        assetPath: normalizePath(asset.assetPath),
        metaPath: normalizePath(asset.metaPath),
        relativeAssetPath: asset.relativeAssetPath,
        relativeMetaPath: asset.relativeMetaPath,
        ext: asset.ext,
        kind: asset.kind,
        referenceCount: asset.referenceCount,
        references: asset.references,
        checkedBy: IMAGE_EXTENSIONS.has(asset.ext) ? ["uuid", "path/name"] : ["uuid"],
        git: asset.git,
        level: asset.level,
        levelName: asset.levelName,
        reason: asset.reason,
      })),
  };

  fs.writeFileSync(path.join(REMOVE_DIR, "unused-assets.json"), JSON.stringify(report, null, 2), "utf8");

  writeListFile(path.join(REMOVE_DIR, "direct-delete.txt"), "直接删除列表：低风险、可批处理删除", grouped.directDelete);
  writeListFile(path.join(REMOVE_DIR, "suggested-delete.txt"), "建议删除列表：建议人工确认后删除", grouped.suggestedDelete);
  writeListFile(path.join(REMOVE_DIR, "consider-delete.txt"), "考虑删除列表：高风险，需要谨慎确认", grouped.considerDelete);

  if (options.generateDeleteBat) {
    writeDeleteBat(path.join(REMOVE_DIR, "delete-direct.bat"), grouped.directDelete);
  }

  return grouped;
}

function validateTargetPath(targetPath) {
  if (!targetPath) {
    throw new Error("缺少检查路径，请传入 Cocos 项目路径或 assets 路径。");
  }

  const resolved = path.resolve(targetPath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`路径不存在: ${resolved}`);
  }

  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error(`检查路径必须是目录: ${resolved}`);
  }

  return resolved;
}

function main() {
  const options = parseArgs(process.argv);

  if (options.help) {
    printHelp();
    return;
  }

  let targetPath;
  try {
    targetPath = validateTargetPath(options.targetPath);
  } catch (error) {
    console.error(`错误: ${error.message}`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  console.log(`开始扫描: ${targetPath}`);

  const files = walkFiles(targetPath, options);
  console.log(`扫描文件数: ${files.length}`);

  const assets = collectAssets(files, targetPath);
  console.log(`发现带 UUID 的资源 meta 数: ${assets.length}`);
  console.log("图片资源会额外检查文本中的文件名/相对路径引用（如 .png/.jpg/.jpeg 以及不带扩展路径）。");

  collectReferences(files, assets, targetPath);
  enrichAssetsWithGitInfo(assets, targetPath);
  classifyAssets(assets, options);

  const grouped = writeOutputs(targetPath, assets, options);

  console.log("");
  console.log("检查完成，输出目录:", REMOVE_DIR);
  console.log(`总资源: ${assets.length}`);
  console.log(`已引用: ${grouped.used.length}`);
  console.log(`直接删除: ${grouped.directDelete.length}`);
  console.log(`建议删除: ${grouped.suggestedDelete.length}`);
  console.log(`考虑删除: ${grouped.considerDelete.length}`);
  console.log("");
  console.log("请优先查看:");
  console.log(`- ${path.join(REMOVE_DIR, "direct-delete.txt")}`);
  console.log(`- ${path.join(REMOVE_DIR, "suggested-delete.txt")}`);
  console.log(`- ${path.join(REMOVE_DIR, "consider-delete.txt")}`);
  console.log("");
  console.log("注意：delete-direct.bat 只处理“直接删除”层级，并会顺手清理资源父级空文件夹，执行前仍建议提交 Git 或备份。");
}

main();
