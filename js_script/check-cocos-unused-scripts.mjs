#!/usr/bin/env node

import fs from "fs";
import path from "path";

const cwd = process.cwd();
const OUTPUT_DIR_NAME = "removeScript";
const OUTPUT_DIR = path.join(cwd, OUTPUT_DIR_NAME);
const DEFAULT_WHITELIST_PATH = path.join(OUTPUT_DIR, "whitelist.txt");

const SCRIPT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
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
  "removeScript",
]);

const MIN_UUID_LENGTH = 8;
const COCOS_UUID_BASE64_KEYS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function printHelp() {
  console.log(`
Cocos 未使用脚本检查工具

功能:
  扫描 Cocos assets 目录中的 .ts/.tsx/.js/.jsx 脚本，检查其 .meta UUID 是否被其它资源引用，
  同时检查代码中的 import/require 动态路径引用，并支持白名单。
  检查结果输出到 ${OUTPUT_DIR_NAME}/，其中 direct-delete.txt 可直接给 delete-cocos-asset-relations 读取删除。

用法:
  node js_script/check-cocos-unused-scripts.mjs <Cocos项目路径或assets路径> [选项]

选项:
  --whitelist=<路径>       白名单文件路径，默认 removeScript/whitelist.txt
  --include-dirs=a,b,c     额外包含默认忽略目录
  --extensions=.ts,.js     指定脚本扩展名，默认 .ts,.tsx,.js,.jsx
  --help, -h               显示帮助

白名单:
  - 一行一个规则
  - 支持空行和 # 注释
  - 支持绝对路径、相对扫描根目录路径、文件名
  - 支持 * 通配符，例如:
      db://assets/scripts/Entry.ts
      scripts/Entry.ts
      Entry.ts
      */generated/*

输出:
  removeScript/unused-scripts.json  完整检查报告
  removeScript/direct-delete.txt    可删除脚本列表，可被 delete-cocos-asset-relations 读取
  removeScript/whitelist.txt        默认白名单文件，不存在时自动创建模板

示例:
  node js_script/check-cocos-unused-scripts.mjs "D:\\git\\a3-client\\A3-Client\\assets"
  node js_script/check-cocos-unused-scripts.mjs "D:\\git\\a3-client\\A3-Client" --whitelist="removeScript\\script-whitelist.txt"
  node js_script/delete-cocos-asset-relations.mjs "removeScript\\direct-delete.txt" --dry-run
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    targetPath: "",
    whitelistPath: DEFAULT_WHITELIST_PATH,
    includeDirs: new Set(),
    scriptExtensions: new Set(SCRIPT_EXTENSIONS),
  };

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg.startsWith("--whitelist=")) {
      options.whitelistPath = arg.slice("--whitelist=".length).replace(/^"|"$/g, "");
    } else if (arg.startsWith("--include-dirs=")) {
      const names = arg
        .slice("--include-dirs=".length)
        .split(",")
        .map(item => item.trim())
        .filter(Boolean);
      for (const name of names) {
        options.includeDirs.add(name.toLowerCase());
      }
    } else if (arg.startsWith("--extensions=")) {
      const extensions = arg
        .slice("--extensions=".length)
        .split(",")
        .map(item => item.trim().toLowerCase())
        .filter(Boolean)
        .map(item => item.startsWith(".") ? item : `.${item}`);
      options.scriptExtensions = new Set(extensions);
    } else if (!options.targetPath) {
      options.targetPath = arg;
    }
  }

  return options;
}

function normalizePath(filePath) {
  return filePath.replace(/\\/g, "/");
}

function normalizeAbsolutePath(filePath) {
  return normalizePath(path.resolve(filePath));
}

function normalizeReferenceText(text) {
  return normalizePath(text).toLowerCase();
}

function toRelative(filePath, basePath) {
  return normalizePath(path.relative(basePath, filePath) || ".");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
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

function isTextScannable(filePath) {
  return TEXT_SCAN_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function isScriptFile(filePath, options) {
  return options.scriptExtensions.has(path.extname(filePath).toLowerCase());
}

function isValidCocosUuid(uuid) {
  return typeof uuid === "string" && uuid.length >= MIN_UUID_LENGTH && !/\s/.test(uuid);
}

function normalizeUuid(uuid) {
  return String(uuid || "").trim();
}

function stripUuidDashes(uuid) {
  return normalizeUuid(uuid).replace(/-/g, "");
}

function isCanonicalUuid(uuid) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalizeUuid(uuid));
}

function compressUuidHex(hex, reservedHeadLength) {
  let index = reservedHeadLength;
  let compressed = hex.slice(0, reservedHeadLength);

  // Cocos 的压缩 UUID 会保留头部若干 hex 字符，剩余 hex 每 3 个字符压成 2 个 base64 字符。
  // 当保留长度为奇数时，先直接追加 1 个 hex，保证后面按 3 个一组处理。
  if (reservedHeadLength % 2 === 1 && index < hex.length) {
    compressed += hex[index];
    index += 1;
  }

  while (index < hex.length) {
    const h1 = Number.parseInt(hex[index] || "0", 16);
    const h2 = Number.parseInt(hex[index + 1] || "0", 16);
    const h3 = Number.parseInt(hex[index + 2] || "0", 16);

    if (![h1, h2, h3].every(Number.isFinite)) {
      return "";
    }

    compressed += COCOS_UUID_BASE64_KEYS[(h1 << 2) | (h2 >> 2)];
    compressed += COCOS_UUID_BASE64_KEYS[((h2 & 3) << 4) | h3];
    index += 3;
  }

  return compressed;
}

function getUuidReferenceCandidates(uuid) {
  const normalized = normalizeUuid(uuid);
  const lower = normalized.toLowerCase();
  const noDash = stripUuidDashes(normalized).toLowerCase();
  const candidates = new Set();

  if (normalized) {
    candidates.add(normalized);
    candidates.add(lower);
  }

  if (/^[0-9a-f]{32}$/i.test(noDash)) {
    candidates.add(noDash);

    // Cocos Creator 常见压缩 UUID：
    // - 2 位保留头 + base64 压缩，常见于 Creator 2.x/3.x prefab/scene 中的脚本组件引用。
    // - 5 位保留头 + base64 压缩，兼容旧版本/部分导入数据。
    for (const reservedHeadLength of [2, 5]) {
      const compressed = compressUuidHex(noDash, reservedHeadLength);
      if (compressed) {
        candidates.add(compressed);
        candidates.add(compressed.toLowerCase());
      }
    }

    // 某些序列化文本只保存 UUID 尾段，加入较长尾段兜底，避免只靠文件名路径判断。
    candidates.add(noDash.slice(-12));
    candidates.add(noDash.slice(-16));
  }

  if (isCanonicalUuid(normalized)) {
    candidates.add(normalized.replace(/-/g, ""));
  }

  return Array.from(candidates).filter(item => item && item.length >= MIN_UUID_LENGTH);
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
    // Cocos meta 通常为 JSON；解析失败时正则兜底。
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

function findAssetsRoot(targetPath) {
  const resolved = path.resolve(targetPath);
  const parts = resolved.split(path.sep);

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (parts[index].toLowerCase() === "assets") {
      return parts.slice(0, index + 1).join(path.sep);
    }
  }

  const assetsPath = path.join(resolved, "assets");
  if (fs.existsSync(assetsPath) && fs.statSync(assetsPath).isDirectory()) {
    return assetsPath;
  }

  return resolved;
}

function validateTargetPath(targetPath) {
  if (!targetPath) {
    throw new Error("缺少检查路径，请传入 Cocos 项目路径或 assets 路径。");
  }

  const resolved = path.resolve(targetPath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`路径不存在: ${resolved}`);
  }

  if (!fs.statSync(resolved).isDirectory()) {
    throw new Error(`检查路径必须是目录: ${resolved}`);
  }

  const assetsRoot = findAssetsRoot(resolved);
  if (!fs.existsSync(assetsRoot) || !fs.statSync(assetsRoot).isDirectory()) {
    throw new Error(`未找到可扫描目录: ${assetsRoot}`);
  }

  return assetsRoot;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wildcardToRegExp(rule) {
  const escaped = escapeRegExp(rule).replace(/\\\*/g, ".*");
  return new RegExp(`(^|/)${escaped}$`, "i");
}

function ensureWhitelistFile(whitelistPath) {
  ensureDir(path.dirname(whitelistPath));

  if (fs.existsSync(whitelistPath)) {
    return;
  }

  const lines = [
    "# Cocos 未使用脚本检查白名单",
    "# 一行一个规则；支持绝对路径、相对 assets 路径、文件名和 * 通配符。",
    "# 示例:",
    "# scripts/Entry.ts",
    "# Entry.ts",
    "# */generated/*",
    "",
  ];

  fs.writeFileSync(whitelistPath, lines.join("\n"), "utf8");
}

function loadWhitelist(whitelistPath) {
  ensureWhitelistFile(whitelistPath);

  const rawRules = readTextSafely(whitelistPath)
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"));

  return rawRules.map(rule => ({
    raw: rule,
    normalized: normalizeReferenceText(rule.replace(/^db:\/\/assets\/?/i, "")),
    regex: rule.includes("*") ? wildcardToRegExp(normalizeReferenceText(rule.replace(/^db:\/\/assets\/?/i, ""))) : null,
  }));
}

function isWhitelisted(script, whitelistRules) {
  const candidates = [
    normalizeReferenceText(script.assetPath),
    normalizeReferenceText(script.relativeAssetPath),
    normalizeReferenceText(path.basename(script.assetPath)),
    `db://assets/${normalizeReferenceText(script.relativeAssetPath)}`,
  ];

  for (const rule of whitelistRules) {
    if (rule.regex && candidates.some(candidate => rule.regex.test(candidate))) {
      return rule.raw;
    }

    if (candidates.some(candidate => candidate === rule.normalized || candidate.endsWith(`/${rule.normalized}`))) {
      return rule.raw;
    }

    if (normalizeReferenceText(`db://assets/${script.relativeAssetPath}`) === normalizeReferenceText(rule.raw)) {
      return rule.raw;
    }
  }

  return "";
}

function collectScripts(files, rootPath, options) {
  const scripts = [];

  for (const filePath of files) {
    if (!isScriptFile(filePath, options)) {
      continue;
    }

    const metaPath = `${filePath}.meta`;
    if (!fs.existsSync(metaPath)) {
      continue;
    }

    const uuids = extractUuidsFromMeta(metaPath);
    if (uuids.length === 0) {
      continue;
    }

    const ext = path.extname(filePath).toLowerCase();
    const relativeAssetPath = toRelative(filePath, rootPath);
    const relativeWithoutExt = relativeAssetPath.endsWith(ext)
      ? relativeAssetPath.slice(0, -ext.length)
      : relativeAssetPath;

    scripts.push({
      uuid: uuids[0],
      uuids,
      assetPath: filePath,
      metaPath,
      ext,
      relativeAssetPath,
      relativeMetaPath: toRelative(metaPath, rootPath),
      relativeWithoutExt,
      basename: path.basename(filePath),
      basenameWithoutExt: path.basename(filePath, ext),
      references: [],
      referenceCount: 0,
      whitelistedBy: "",
      level: "",
      levelName: "",
      reason: "",
    });
  }

  return scripts;
}

function getPathReferenceCandidates(script) {
  const relative = normalizeReferenceText(script.relativeAssetPath);
  const relativeWithoutExt = normalizeReferenceText(script.relativeWithoutExt);
  const basename = normalizeReferenceText(script.basename);
  const basenameWithoutExt = normalizeReferenceText(script.basenameWithoutExt);

  return Array.from(new Set([
    relative,
    relativeWithoutExt,
    `./${relativeWithoutExt}`,
    `../${relativeWithoutExt}`,
    basename,
    basenameWithoutExt,
  ].filter(item => item && item.length >= 3)));
}

function hasPathReference(content, candidates) {
  const normalizedContent = normalizeReferenceText(content);

  return candidates.some(candidate => {
    // import A from "./foo/Bar"; require("foo/Bar"); load("foo/Bar")
    const quotedPattern = new RegExp(`["'\`]([^"'\`]*${escapeRegExp(candidate)})["'\`]`, "i");
    if (quotedPattern.test(normalizedContent)) {
      return true;
    }

    // 兜底检查完整相对路径或文件名边界，避免 abcBar 误命中 Bar。
    const boundaryPattern = new RegExp(`(^|[^\\w./-])${escapeRegExp(candidate)}($|[^\\w./-])`, "i");
    return boundaryPattern.test(normalizedContent);
  });
}

function collectReferences(files, scripts, rootPath) {
  const uuidToScripts = new Map();

  for (const script of scripts) {
    script.uuidReferenceCandidates = Array.from(new Set(
      script.uuids.flatMap(uuid => getUuidReferenceCandidates(uuid)),
    ));

    for (const uuidCandidate of script.uuidReferenceCandidates) {
      if (!uuidToScripts.has(uuidCandidate)) {
        uuidToScripts.set(uuidCandidate, []);
      }
      uuidToScripts.get(uuidCandidate).push(script);
    }
  }

  const uuidSet = new Set(uuidToScripts.keys());
  const pathCandidates = scripts.map(script => ({
    script,
    candidates: getPathReferenceCandidates(script),
  }));

  for (const filePath of files) {
    if (!isTextScannable(filePath)) {
      continue;
    }

    const content = readTextSafely(filePath);
    if (!content) {
      continue;
    }

    for (const uuid of uuidSet) {
      if (!content.includes(uuid)) {
        continue;
      }

      const matchedScripts = uuidToScripts.get(uuid) || [];
      for (const script of matchedScripts) {
        if (normalizeAbsolutePath(filePath) === normalizeAbsolutePath(script.metaPath)) {
          continue;
        }

        script.references.push(`${toRelative(filePath, rootPath)}#uuid:${uuid}`);
      }
    }

    for (const { script, candidates } of pathCandidates) {
      const normalizedFile = normalizeAbsolutePath(filePath);
      if (
        normalizedFile === normalizeAbsolutePath(script.assetPath)
        || normalizedFile === normalizeAbsolutePath(script.metaPath)
      ) {
        continue;
      }

      if (hasPathReference(content, candidates)) {
        script.references.push(`${toRelative(filePath, rootPath)}#path`);
      }
    }
  }

  for (const script of scripts) {
    script.references = Array.from(new Set(script.references)).sort();
    script.referenceCount = script.references.length;
  }
}

function classifyScripts(scripts, whitelistRules) {
  for (const script of scripts) {
    const whitelistedBy = isWhitelisted(script, whitelistRules);
    script.whitelistedBy = whitelistedBy;

    if (whitelistedBy) {
      script.level = "whitelist";
      script.levelName = "白名单";
      script.reason = `命中白名单规则: ${whitelistedBy}`;
      continue;
    }

    if (script.referenceCount > 0) {
      script.level = "used";
      script.levelName = "已引用";
      script.reason = `发现 ${script.referenceCount} 个 UUID/路径引用`;
      continue;
    }

    script.level = "direct-delete";
    script.levelName = "直接删除";
    script.reason = "脚本 .meta UUID 未被其它资源引用，且未发现 import/require/路径引用，也未命中白名单";
  }
}

function groupByLevel(scripts) {
  return {
    used: scripts.filter(item => item.level === "used"),
    whitelist: scripts.filter(item => item.level === "whitelist"),
    directDelete: scripts.filter(item => item.level === "direct-delete"),
  };
}

function formatScriptLine(script) {
  return [
    normalizePath(script.assetPath),
    `uuid=${script.uuids.join(",")}`,
    `type=${script.ext}`,
    `reason=${script.reason}`,
  ].join("\t");
}

function writeListFile(filePath, title, scripts) {
  const lines = [title, `数量: ${scripts.length}`, "", ...scripts.map(formatScriptLine), ""];
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
}

function writeOutputs(rootPath, scripts, whitelistPath) {
  ensureDir(OUTPUT_DIR);

  const grouped = groupByLevel(scripts);
  const sortedDirectDelete = grouped.directDelete
    .slice()
    .sort((a, b) => a.relativeAssetPath.localeCompare(b.relativeAssetPath, "zh-CN"));

  const report = {
    generatedAt: new Date().toISOString(),
    targetPath: normalizePath(rootPath),
    whitelistPath: normalizePath(path.resolve(whitelistPath)),
    summary: {
      totalScripts: scripts.length,
      used: grouped.used.length,
      whitelist: grouped.whitelist.length,
      directDelete: grouped.directDelete.length,
    },
    outputs: {
      directDelete: normalizePath(path.join(OUTPUT_DIR, "direct-delete.txt")),
    },
    scripts: scripts
      .slice()
      .sort((a, b) => a.relativeAssetPath.localeCompare(b.relativeAssetPath, "zh-CN"))
      .map(script => ({
        uuid: script.uuid,
        uuids: script.uuids,
        assetPath: normalizePath(script.assetPath),
        metaPath: normalizePath(script.metaPath),
        relativeAssetPath: script.relativeAssetPath,
        relativeMetaPath: script.relativeMetaPath,
        ext: script.ext,
        referenceCount: script.referenceCount,
        references: script.references,
        uuidReferenceCandidates: script.uuidReferenceCandidates || [],
        whitelistedBy: script.whitelistedBy,
        level: script.level,
        levelName: script.levelName,
        reason: script.reason,
      })),
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, "unused-scripts.json"), JSON.stringify(report, null, 2), "utf8");
  writeListFile(path.join(OUTPUT_DIR, "direct-delete.txt"), "直接删除列表：未使用脚本，可被 delete-cocos-asset-relations 读取", sortedDirectDelete);

  return grouped;
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

  const whitelistPath = path.resolve(options.whitelistPath);

  console.log(`开始扫描脚本: ${rootPath}`);
  console.log(`白名单: ${whitelistPath}`);

  const files = walkFiles(rootPath, options);
  console.log(`扫描文件数: ${files.length}`);

  const scripts = collectScripts(files, rootPath, options);
  console.log(`发现带 UUID meta 的脚本数: ${scripts.length}`);

  const whitelistRules = loadWhitelist(whitelistPath);
  collectReferences(files, scripts, rootPath);
  classifyScripts(scripts, whitelistRules);

  const grouped = writeOutputs(rootPath, scripts, whitelistPath);

  console.log("");
  console.log("检查完成，输出目录:", OUTPUT_DIR);
  console.log(`总脚本: ${scripts.length}`);
  console.log(`已引用: ${grouped.used.length}`);
  console.log(`白名单: ${grouped.whitelist.length}`);
  console.log(`直接删除: ${grouped.directDelete.length}`);
  console.log("");
  console.log("请优先查看:");
  console.log(`- ${path.join(OUTPUT_DIR, "direct-delete.txt")}`);
  console.log(`- ${path.join(OUTPUT_DIR, "unused-scripts.json")}`);
  console.log("");
  console.log("删除前建议先 dry-run:");
  console.log(`node js_script/delete-cocos-asset-relations.mjs "${path.join(OUTPUT_DIR_NAME, "direct-delete.txt")}" --dry-run`);
}

main();
