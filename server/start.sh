#!/bin/bash

echo "===================================="
echo "AI对话服务启动脚本"
echo "===================================="
echo ""

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo "正在安装依赖..."
    npm install
    echo ""
fi

# 检查是否存在.env文件
if [ ! -f ".env" ]; then
    echo "警告: 未找到 .env 文件"
    echo "正在从 env.example 创建 .env 文件..."
    cp env.example .env
    echo ""
    echo "请编辑 .env 文件，填入您的API密钥！"
    read -p "按回车键继续启动服务（将使用默认配置）..."
fi

echo "正在启动AI服务..."
echo ""
npm start

