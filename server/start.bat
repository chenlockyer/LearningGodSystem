@echo off
echo ====================================
echo AI对话服务启动脚本
echo ====================================
echo.

REM 检查是否已安装依赖
if not exist "node_modules" (
    echo 正在安装依赖...
    call npm install
    echo.
)

REM 检查是否存在.env文件
if not exist ".env" (
    echo 警告: 未找到 .env 文件
    echo 正在从 env.example 创建 .env 文件...
    copy env.example .env
    echo.
    echo 请编辑 .env 文件，填入您的API密钥！
    echo 按任意键继续启动服务（将使用默认配置）...
    pause >nul
)

echo 正在启动AI服务...
echo.
call npm start

