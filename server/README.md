# AI对话服务后端

本地部署的AI对话服务，支持DeepSeek和OpenAI。

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
# 复制示例文件
cp env.example .env

# 编辑 .env 文件，填入您的API密钥
```

### 3. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

## 环境变量说明

- `PORT`: 服务器端口（默认3000）
- `DEEPSEEK_API_KEY`: DeepSeek API密钥
- `OPENAI_API_KEY`: OpenAI API密钥（可选）

## API接口

- `GET /health` - 健康检查
- `POST /api/chat` - AI对话接口

详细文档请查看项目根目录的 `LOCAL_DEPLOYMENT.md`

