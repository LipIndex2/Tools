const fs = require('fs');
const path = require('path');
const readline = require('readline');

const { spawn } = require('child_process');
const jsonPath = path.join(__dirname, 'wxploadConfig.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

// 获取所有平级 key
const keys = Object.keys(data.gits);

console.log('请选择一个分支:');
keys.forEach((key, idx) => {
  console.log(`${idx + 1}. ${key}`);
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('输入数字选择: ', answer => {
  const index = parseInt(answer, 10) - 1;
  if (index >= 0 && index < keys.length) {
    // 输出选择的 key，供 .bat 捕获
    process.stdout.write(keys[index]);

    // 直接调用下一个脚本
    spawn('node', ['wxCITool.js', keys[index]], {
      stdio: 'inherit',
      shell: true,
    });
  } else {
    console.error('选择无效');
  }
  rl.close();
});
