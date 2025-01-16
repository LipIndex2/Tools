const gulp = require('gulp');
const sass = require('gulp-sass')(require('sass'));
const electron = require('electron-connect').server.create();
const del = require('del');
const concat = require('gulp-concat');
const { src, dest, series, watch, parallel } = require('gulp');
const spawn = require("child_process").spawn;
let vueBuildProcess;
const tsFilesGlob = ["src/**/*.ts", "!./node_modules/**/*.ts", "!src/test/*.ts"];
const configPaths = ["src/config.json"]
const distPaths = ["dist/**"];
const libPaths = ["lib/**"];
const appPaths = ["main.js", "preload.js"];
const finalPaths = ["main.js", "preload.js", "md5.json"]
const md5Paths = ["lib", "dist"];
const ts = require("gulp-typescript");
const fs = require('fs');
const {createHash} = require('crypto');
const path = require("path")
// const outputBasepath = "out/MergeLevel-win32-x64/resources/app";

async function readFile(filename)
{
    return new Promise((resolve, reject) => {
        fs.readFile(filename, (err, buff) => {
            resolve([err, buff])
        });
    });
}

async function readdir(dirPath)
{
    return new Promise((resolve, reject) => {
        fs.readdir(dirPath, (err, files) => {
            resolve([err, files]);
        });
    })
}

async function writeFile(fileName, object)
{
	return new Promise((resolve, reject) => {
        fs.writeFile(fileName, JSON.stringify(object), (err) => {
			resolve(err);
		});
    });
}
 
async function stat(file)
{
    return new Promise((resolve, reject) => {
        fs.stat(file, (err, fileStat) => {
            resolve([err, fileStat]);
        });
    })
}

async function generateHash(filename)
{
    let [error, buff] = await readFile(filename);
    const hash = createHash("md5").update(buff).digest("hex")
    return hash;
}


async function getAllFiles(dirPath, arrayOfFiles) {
    let [error, files] = await readdir(dirPath)
    arrayOfFiles = arrayOfFiles || []
	for (let i = 0; i < files.length; i++)
	{
		let file = files[i];
		let [error, fileStat] = await stat(dirPath + "/" + file);
		if (fileStat.isDirectory())
		{
				arrayOfFiles = await getAllFiles(dirPath + "/" + file, arrayOfFiles)
		}
		else
		{
			if (file !== "config.json")
			{
				arrayOfFiles.push(path.join(dirPath, "/", file))
			}
		}
	}
    return arrayOfFiles
}

function buildTs() {
	const tsconfig = require("./tsconfig.json")
	return src(tsFilesGlob)
		.pipe(ts(tsconfig.compilerOptions))
		.pipe(dest("./lib"))
}

function moveConfig() {
	return src(configPaths).pipe(dest("./lib"));
}

function watchTs() {
	watch(tsFilesGlob, series(buildTs));
}

function watchConfig() {
	return watch(configPaths, series(moveConfig))
}

function build()
{
	return spawn("npx", ["yarn", "run", "make"], {
		stdio: "inherit",
		shell: true,
	});
}

function buildVue()
{
	return spawn("npm", ["run", "build"], {
		stdio: "inherit",
		shell: true,
	}); 
}

function clearPath(path) {
	return path.replace(/\\/g, "/")
}

async function generateMD5()
{
	let paths = md5Paths;
	let files = [];
	for (let i = 0; i < paths.length; i++)
	{
		let basePath = paths[i];
		let fileArr = await getAllFiles(basePath);
		files = files.concat(fileArr);
	}
	for (let i = 0; i < appPaths.length; i++)
	{
		files.push(appPaths[i]);
	}
	let out = [];
    for (let i = 0; i < files.length; i++)
    {
        let file = files[i];
        let hash = await generateHash(file);
        out.push({path: file, hash: hash});
    }
	let version = await getVersion();
	// console.log(out);
	await writeFile(`md5.json`, {hashes: out, version: version});
}

function moveDist()
{
	return src(distPaths).pipe(dest("./out/MergeLevel-win32-x64/resources/app/dist"));
}

function moveLib()
{
	return src(libPaths).pipe(dest("./out/MergeLevel-win32-x64/resources/app/lib"));
}

function moveApp()
{
	return src(finalPaths).pipe(dest("./out/MergeLevel-win32-x64/resources/app"));
}

async function getVersion()
{
	let [error, buff] = await readFile("./package.json");
	let json = JSON.parse(buff);
	json.version;
	return json.version;
}


gulp.task('clear-dir', function () {
	return del(['dest/*']);
});

gulp.task('clear-lib', function () {
	return del(['lib/*']);
});

gulp.task('clear-out-dir', function () {
	return del(['out/MergeLevel-win32-x64/resources/app/dist/*']);
});

gulp.task('clear-out-lib', function () {
	return del(['out/MergeLevel-win32-x64/resources/app/lib/*']);
});

gulp.task("vue", function () {
	if (vueBuildProcess) {
		vueBuildProcess.kill();
	}

	vueBuildProcess = spawn("npm", ["run", "dev"], {
		stdio: "inherit",
		shell: true,
	});

});


gulp.task("serve", function () {
	spawn("npm", ["run", "start"], {
		stdio: "inherit",
		shell: true,
	});
});




gulp.task("watchJs", function () {
	gulp.watch("./**/*.js", gulp.series('serve'));
});

gulp.task('default', gulp.series(buildTs, parallel("vue", "serve", watchTs)));

gulp.task("buildFull", series("clear-lib", "clear-dir", "clear-out-dir", "clear-out-lib", moveConfig, buildTs, buildVue, build, generateMD5));
gulp.task("buildPartial", series("clear-lib", "clear-dir", "clear-out-dir", "clear-out-lib", moveConfig, buildTs, buildVue, generateMD5, moveDist, moveLib, moveApp));
gulp.task("buildTs", series("clear-lib", moveConfig, buildTs));
gulp.task("generate", generateMD5);

gulp.task("test", getVersion);