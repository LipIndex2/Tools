const net = require('net');
const express = require('express');
const app = express();
const path = require('path');

// 设置静态文件目录
app.use(express.static(path.join(__dirname, 'public')));

// 启动服务器
const PORT = 9792;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});