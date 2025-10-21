const io=require("./io");
const {getNetworkIPv4}=require("./utils");
const express = require('express');
const app = express();
const server = require('http').createServer(app);
const fs=require('fs');

// 确保upload目录存在
if(!fs.existsSync('./upload')) {
  fs.mkdirSync('./upload', { recursive: true });
}

// 添加body-parser中间件以支持更大的请求体（用于处理base64编码的图片）
app.use(express.json({limit: '5mb'}));
app.use(express.urlencoded({limit: '5mb', extended: true}));

const path = require('path');
// 设置静态文件目录
app.use("/",express.static('dist'));
// 确保upload目录可以通过/upload路径访问
app.use('/upload', express.static(path.join(__dirname, 'upload')));
const PORT=3000;
io.attach(server);
//启动服务器
server.listen(PORT,()=> {
  const address=getNetworkIPv4().address;
  console.info("- Local:   http://localhost:"+PORT);
  console.info(`- Network: http://${address}:`+PORT)
});
