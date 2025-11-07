#!/bin/bash
echo "正在安装依赖..."
npm install
echo "依赖安装完成，正在构建前端资源..."
npm run build
echo "前端构建完成，正在启动服务..."
npm run prod