# 本地后端部署指南

## 📋 概述

本指南将帮助您将AI对话功能从云函数迁移到本地后端服务器。

## 🚀 快速开始

### 1. 安装后端依赖

```bash
cd server
npm install
```

### 2. 配置环境变量

复制环境变量示例文件并配置：

```bash
# Windows
copy env.example .env

# Mac/Linux
cp env.example .env
```

编辑 `.env` 文件，填入您的API密钥：

```env
PORT=3000
DEEPSEEK_API_KEY=sk-your-actual-deepseek-api-key
OPENAI_API_KEY=sk-your-actual-openai-api-key  # 可选
```

### 3. 启动后端服务

```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

启动成功后，您会看到：

```
🚀 AI服务已启动
📡 服务地址: http://localhost:3000
🔗 健康检查: http://localhost:3000/health
💬 对话接口: http://localhost:3000/api/chat
🤖 当前AI服务商: deepseek
```

### 4. 配置小程序

#### 4.1 配置API地址

在 `utils/ai.js` 中修改API地址：

```javascript
// 开发环境（本地）
const API_BASE_URL = 'http://localhost:3000';

// 生产环境（部署到服务器后）
// const API_BASE_URL = 'https://your-domain.com';
```

#### 4.2 配置微信小程序合法域名

**重要**：微信小程序只能访问配置了合法域名的服务器！

1. 登录[微信公众平台](https://mp.weixin.qq.com/)
2. 进入"开发" -> "开发管理" -> "开发设置"
3. 在"服务器域名"中添加您的后端服务器域名
4. 如果是本地开发，需要在微信开发者工具中：
   - 点击右上角"详情"
   - 勾选"不校验合法域名、web-view（业务域名）、TLS版本以及HTTPS证书"

### 5. 测试连接

1. 确保后端服务正在运行
2. 在浏览器访问：`http://localhost:3000/health`
3. 应该看到：`{"status":"ok","message":"AI服务运行正常",...}`
4. 在小程序中发送消息测试

## 🔧 部署到生产环境

### 方案1：使用云服务器

1. **上传代码到服务器**
   ```bash
   scp -r server/ user@your-server:/path/to/app/
   ```

2. **在服务器上安装依赖**
   ```bash
   cd /path/to/app/server
   npm install --production
   ```

3. **配置环境变量**
   ```bash
   # 创建 .env 文件
   nano .env
   ```

4. **使用PM2管理进程（推荐）**
   ```bash
   npm install -g pm2
   pm2 start index.js --name ai-chat-server
   pm2 save
   pm2 startup  # 设置开机自启
   ```

5. **配置Nginx反向代理（可选）**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

6. **配置HTTPS（必需）**
   - 使用Let's Encrypt免费证书
   - 或使用其他SSL证书服务

### 方案2：使用内网穿透（本地开发）

如果需要在真机上测试，可以使用内网穿透工具：

1. **使用ngrok**
   ```bash
   ngrok http 3000
   ```
   会得到一个公网地址，如：`https://xxxx.ngrok.io`

2. **使用natapp**
   - 注册账号并创建隧道
   - 下载客户端并运行

3. **更新小程序配置**
   ```javascript
   const API_BASE_URL = 'https://xxxx.ngrok.io';
   ```

## 📝 API接口说明

### 健康检查

```
GET /health
```

响应：
```json
{
  "status": "ok",
  "message": "AI服务运行正常",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### AI对话接口

```
POST /api/chat
Content-Type: application/json
```

请求体：
```json
{
  "messages": [
    {"role": "user", "content": "你好"}
  ],
  "provider": "deepseek"  // 可选，默认deepseek
}
```

响应：
```json
{
  "code": 0,
  "data": {
    "choices": [{
      "message": {
        "content": "你好！有什么可以帮助你的吗？"
      }
    }]
  },
  "provider": "deepseek"
}
```

## 🐛 故障排除

### 问题1：无法连接到服务器

**症状**：小程序提示"无法连接到服务器"

**解决方案**：
1. 检查后端服务是否运行：`curl http://localhost:3000/health`
2. 检查防火墙是否阻止了3000端口
3. 检查API地址配置是否正确
4. 如果是真机测试，确保手机和电脑在同一网络

### 问题2：微信小程序域名校验失败

**症状**：真机上无法访问，开发者工具可以

**解决方案**：
1. 在微信公众平台配置合法域名
2. 确保使用HTTPS（生产环境）
3. 检查域名是否已备案（国内服务器）

### 问题3：API密钥错误

**症状**：后端返回401或API密钥相关错误

**解决方案**：
1. 检查 `.env` 文件中的API密钥是否正确
2. 确保API密钥有足够的余额
3. 检查API密钥是否过期

### 问题4：端口被占用

**症状**：启动服务时提示端口被占用

**解决方案**：
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:3000 | xargs kill -9
```

或修改 `.env` 文件中的端口号。

## 🔒 安全建议

1. **不要将 `.env` 文件提交到Git**
   - 已在 `.gitignore` 中排除

2. **使用环境变量管理密钥**
   - 生产环境使用服务器环境变量
   - 不要硬编码密钥

3. **配置CORS**
   - 只允许小程序域名访问
   - 在 `server/index.js` 中配置：
   ```javascript
   app.use(cors({
     origin: 'https://servicewechat.com'  // 微信小程序域名
   }));
   ```

4. **添加请求频率限制**
   - 防止API滥用
   - 可以使用 `express-rate-limit`

5. **使用HTTPS**
   - 生产环境必须使用HTTPS
   - 保护数据传输安全

## 📦 项目结构

```
server/
├── index.js          # 服务器主文件
├── package.json      # 依赖配置
├── .env              # 环境变量（不提交到Git）
├── env.example       # 环境变量示例
└── .gitignore        # Git忽略文件
```

## 🔄 从云函数迁移检查清单

- [x] 创建本地后端服务器
- [x] 修改前端代码使用HTTP请求
- [x] 移除云开发初始化代码
- [ ] 配置API密钥
- [ ] 启动后端服务
- [ ] 配置小程序合法域名
- [ ] 测试对话功能
- [ ] 部署到生产环境（如需要）

## 📞 技术支持

如遇到问题，请检查：
1. 后端服务日志
2. 小程序控制台日志
3. 网络连接状态
4. API密钥配置

---

祝您使用愉快！🎉

