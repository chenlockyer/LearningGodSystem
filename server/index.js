const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// AI服务商配置
const AI_PROVIDERS = {
  deepseek: {
    url: 'https://api.deepseek.com/v1/chat/completions',
    apiKey: process.env.DEEPSEEK_API_KEY || 'sk-36279fe5cc5a454ba2640af24dc8ab62',
    model: 'deepseek-chat'
  },
  openai: {
    url: 'https://api.openai.com/v1/chat/completions',
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-3.5-turbo'
  }
};

const DEFAULT_PROVIDER = 'deepseek';

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'AI服务运行正常',
    timestamp: new Date().toISOString()
  });
});

// AI对话接口
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, provider = DEFAULT_PROVIDER } = req.body;

    // 验证消息格式
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        code: 1,
        msg: '消息格式错误'
      });
    }

    const aiConfig = AI_PROVIDERS[provider];
    if (!aiConfig) {
      return res.status(400).json({
        code: 1,
        msg: '不支持的AI服务商'
      });
    }

    if (!aiConfig.apiKey) {
      return res.status(500).json({
        code: 1,
        msg: 'AI服务未配置API密钥'
      });
    }

    console.log('调用AI接口:', { provider, messageCount: messages.length });

    // 调用AI API
    const response = await axios.post(
      aiConfig.url,
      {
        model: aiConfig.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${aiConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30秒超时
      }
    );

    const aiResponse = response.data;
    console.log('AI响应成功:', { 
      provider, 
      usage: aiResponse.usage,
      model: aiResponse.model 
    });

    res.json({
      code: 0,
      data: aiResponse,
      provider: provider
    });

  } catch (err) {
    console.error('AI API调用失败:', {
      error: err.message,
      status: err.response?.status,
      response: err.response?.data,
      stack: err.stack
    });

    res.status(500).json({
      code: 1,
      msg: err.response?.data?.error?.message || err.message || 'AI服务暂时不可用',
      detail: {
        status: err.response?.status,
        error: err.response?.data
      }
    });
  }
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    code: 1,
    msg: '服务器内部错误'
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 AI服务已启动`);
  console.log(`📡 服务地址: http://localhost:${PORT}`);
  console.log(`🔗 健康检查: http://localhost:${PORT}/health`);
  console.log(`💬 对话接口: http://localhost:${PORT}/api/chat`);
  console.log(`🤖 当前AI服务商: ${DEFAULT_PROVIDER}`);
});


