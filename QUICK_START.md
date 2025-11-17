# 🚀 快速开始指南

## 三步启动本地后端服务

### 步骤1：安装后端依赖

```bash
cd server
npm install
```

### 步骤2：配置API密钥

1. 复制环境变量文件：
   ```bash
   # Windows
   copy env.example .env
   
   # Mac/Linux
   cp env.example .env
   ```

2. 编辑 `.env` 文件，填入您的DeepSeek API密钥：
   ```env
   DEEPSEEK_API_KEY=sk-your-actual-api-key
   ```

### 步骤3：启动服务

**Windows用户：**
```bash
# 方式1：使用启动脚本（推荐）
start.bat

# 方式2：手动启动
npm start
```

**Mac/Linux用户：**
```bash
# 方式1：使用启动脚本（推荐）
chmod +x start.sh
./start.sh

# 方式2：手动启动
npm start
```

启动成功后，您会看到：
```
🚀 AI服务已启动
📡 服务地址: http://localhost:3000
```

## 配置小程序

### 1. 允许本地开发（重要！）

在微信开发者工具中：
1. 点击右上角 **"详情"**
2. 勾选 **"不校验合法域名、web-view（业务域名）、TLS版本以及HTTPS证书"**

这样您就可以在开发时使用 `http://localhost:3000` 了。

### 2. 测试连接

1. 确保后端服务正在运行（步骤3）
2. 在小程序中进入"对话"页面
3. 输入消息并发送
4. 应该能正常收到AI回复

## 常见问题

### Q: 提示"无法连接到服务器"
**A:** 
- 检查后端服务是否启动（访问 http://localhost:3000/health）
- 确认已勾选"不校验合法域名"选项
- 检查防火墙是否阻止了3000端口

### Q: API密钥错误
**A:** 
- 检查 `.env` 文件中的密钥是否正确
- 确保密钥格式为：`sk-xxxxx`
- 检查API密钥是否有余额

### Q: 端口被占用
**A:** 
- 修改 `server/.env` 中的 `PORT=3000` 为其他端口
- 同时修改 `utils/ai.js` 中的 `API_BASE_URL` 端口号

## 下一步

- 查看 `LOCAL_DEPLOYMENT.md` 了解详细部署说明
- 查看 `server/README.md` 了解API接口文档

---

**提示**：如果遇到问题，请查看控制台日志获取详细错误信息。

