# ⚡ 快速修复：请求超时问题

## 🔍 立即检查清单

### ✅ 步骤1：检查后端服务（最重要！）

在浏览器访问：`http://localhost:3000/health`

**如果无法访问：**
```bash
# 1. 进入后端目录
cd server

# 2. 检查是否有 .env 文件
# 如果没有，复制示例文件
copy env.example .env  # Windows
# 或
cp env.example .env    # Mac/Linux

# 3. 编辑 .env 文件，填入API密钥
# DEEPSEEK_API_KEY=sk-your-api-key

# 4. 启动服务
npm start
```

**应该看到：**
```
🚀 AI服务已启动
📡 服务地址: http://localhost:3000
```

### ✅ 步骤2：检查微信开发者工具配置

1. 打开微信开发者工具
2. 点击右上角 **"详情"**
3. **必须勾选**："不校验合法域名、web-view（业务域名）、TLS版本以及HTTPS证书"

### ✅ 步骤3：检查API密钥

在 `server/.env` 文件中：
```env
DEEPSEEK_API_KEY=sk-your-actual-api-key
```

确保：
- API密钥格式正确（以`sk-`开头）
- API密钥有效且有余额
- 没有多余的空格或引号

### ✅ 步骤4：重启服务

修改配置后，必须重启后端服务：
```bash
# 停止当前服务（Ctrl+C）
# 然后重新启动
npm start
```

## 🎯 常见问题快速解决

### 问题1：端口被占用

**错误：** `EADDRINUSE: address already in use :::3000`

**解决：**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:3000 | xargs kill -9
```

或修改端口：
1. 修改 `server/.env`：`PORT=3001`
2. 修改 `utils/ai.js`：`const API_BASE_URL = 'http://localhost:3001'`

### 问题2：防火墙阻止

**Windows：**
1. 打开"Windows Defender 防火墙"
2. 允许Node.js通过防火墙
3. 或临时关闭防火墙测试

### 问题3：网络连接问题

**真机调试时：**
- 确保手机和电脑在同一WiFi网络
- 使用电脑的IP地址而不是localhost
- 修改 `utils/ai.js`：
  ```javascript
  const API_BASE_URL = 'http://192.168.1.100:3000'; // 替换为你的IP
  ```

## 📊 测试连接

### 测试后端服务

```bash
# 在浏览器访问
http://localhost:3000/health

# 应该返回：
{"status":"ok","message":"AI服务运行正常",...}
```

### 测试AI接口

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"你好"}]}'
```

## 🔧 已优化的配置

我已经做了以下优化：

1. **增加超时时间**：从30秒增加到60秒
2. **改进错误提示**：提供更详细的诊断信息
3. **添加检查建议**：自动提示可能的问题

## 📝 如果仍然失败

请检查：

1. **后端控制台日志**
   - 查看是否有错误信息
   - 检查API调用是否成功

2. **微信开发者工具控制台**
   - 查看网络请求详情
   - 检查错误堆栈

3. **网络面板**
   - 查看请求状态码
   - 检查请求和响应数据

## 💡 提示

大部分超时问题都是因为：
- ❌ 后端服务未启动（最常见）
- ❌ 未勾选"不校验合法域名"
- ❌ API密钥配置错误
- ❌ 网络连接问题

按照上面的步骤逐一检查，通常能解决问题！

---

**快速命令：**
```bash
# 一键启动（在server目录下）
npm start

# 检查服务
curl http://localhost:3000/health
```

