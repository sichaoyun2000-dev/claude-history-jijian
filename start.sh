#!/bin/bash

# Claude 历史管理器 - 一键启动脚本

echo "=================================="
echo "  Claude 历史管理器 - 一键启动"
echo "=================================="
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未检测到 Node.js，请先安装 Node.js"
    echo "   下载地址: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js 版本: $(node -v)"
echo "✅ npm 版本: $(npm -v)"
echo ""

# 安装根目录依赖
echo "📦 安装根目录依赖..."
if [ ! -d "node_modules" ]; then
    npm install
fi

# 安装后端依赖
echo "📦 安装后端依赖..."
cd server
if [ ! -d "node_modules" ]; then
    npm install
fi
cd ..

# 安装前端依赖
echo "📦 安装前端依赖..."
cd client
if [ ! -d "node_modules" ]; then
    npm install
fi
cd ..

echo ""
echo "🚀 启动服务..."
echo ""
echo "=================================="
echo "  服务地址:"
echo "    - 前端: http://localhost:5173"
echo "    - 后端: http://localhost:3333"
echo "=================================="
echo ""

# 启动前后端服务
npm run start:dev
