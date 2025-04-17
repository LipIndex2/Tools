const fs = require('fs');

function parseBinaryFile(filePath) {
    // 读取二进制文件
    fs.readFile(filePath, (err, data) => {
        if (err) {
            console.error("读取文件失败:", err);
            return;
        }

        console.log("文件大小:", data.length, "字节");

        // 按字节输出二进制数据
        console.log("十六进制表示:", data.toString('hex').match(/.{1,2}/g).join(' '));

        // 解析常见数据类型
        parseCommonData(data);
    });
}

function parseCommonData(buffer) {
    console.log("\n解析常见数据类型:");

    // 解析前 4 个字节为无符号整数
    if (buffer.length >= 4) {
        console.log("UInt32（无符号整数）:", buffer.readUInt32LE(0));
        console.log("Int32（有符号整数）:", buffer.readInt32LE(0));
        console.log("Float32（单精度浮点数）:", buffer.readFloatLE(0));
    }

    // 解析前 8 个字节为 64 位浮点数
    if (buffer.length >= 8) {
        console.log("Float64（双精度浮点数）:", buffer.readDoubleLE(0));
    }

    // 解析为 UTF-8 字符串（尝试解析前 20 个字节）
    const str = buffer.toString('utf-8', 0, Math.min(buffer.length, 20));
    console.log("UTF-8 解析:", str.replace(/[\x00-\x1F\x80-\xFF]/g, '')); // 过滤控制字符
}

// 测试解析文件
parseBinaryFile('D:/unpacked/app.asar.unpacked/editor/core/native-utils.ccc');
