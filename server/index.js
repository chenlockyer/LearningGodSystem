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

// 从AI回复中解析任务信息
function parseTaskFromReply(replyContent) {
  let cleanReply = replyContent;
  let taskData = { hasTask: false, tasks: [] };

  try {
    // 查找<task>标签
    const taskMatch = replyContent.match(/<task>([\s\S]*?)<\/task>/);
    if (taskMatch) {
      const taskJson = taskMatch[1].trim();
      taskData = JSON.parse(taskJson);
      
      // 从回复中移除任务标签
      cleanReply = replyContent.replace(/<task>[\s\S]*?<\/task>/g, '').trim();
    }
  } catch (err) {
    console.error('解析任务信息失败:', err);
    // 如果解析失败，保持原回复不变
  }

  return { cleanReply, taskData };
}

// 学霸外Game系统Agent系统提示词
function getSystemPrompt(userAttributes = {}, userTasks = []) {
  const attributes = Object.keys(userAttributes).map(name => {
    const attr = userAttributes[name];
    return `${name}: Lv.${attr.level} (${attr.exp}exp)`;
  }).join(', ');

  const activeTasks = userTasks.filter(t => !t.done).map(t => 
    `- ${t.title} (进度: ${t.progress || 0}%)`
  ).join('\n');

  const completedTasks = userTasks.filter(t => t.done).slice(0, 5).map(t => 
    `- ${t.title} (${t.rating || '已完成'})`
  ).join('\n');

  return `你是"学霸外Game系统"的智能助手Agent，这是一个将学习成长游戏化的系统。

## 系统背景
用户通过完成任务来提升八项核心能力：
- 计算机能力、科研能力、自律能力、创造力
- 交流能力、体能活力、管理能力、心理抗压

每完成一个任务，用户会获得对应属性的经验值，经验值累积可以提升能力等级。

## 当前用户状态
用户属性：${attributes || '暂无数据'}

进行中任务：
${activeTasks || '暂无进行中的任务'}

最近完成任务：
${completedTasks || '暂无已完成的任务'}

## 你的核心职责
1. **主动任务识别**：当用户表达学习目标、想要提升某方面能力、或提到具体的学习计划时，必须识别并创建任务
2. **结构化任务输出**：在回复末尾，如果检测到任务需求，必须包含JSON格式的任务信息
3. **智能任务设计**：根据用户目标，设计合理的任务（包括任务标题、描述、奖励属性、经验值）
4. **进度跟踪建议**：提醒用户可以通过"生成战报"来更新任务进度
5. **游戏化激励**：用游戏化的语言激励用户，让学习更有趣

## 任务识别场景示例
以下情况必须创建任务：
- 用户说"我想提高计算机水平" → 创建计算机能力相关任务
- 用户说"我要学习Python" → 创建学习任务
- 用户说"今天要刷3道LeetCode" → 创建具体任务
- 用户说"想提升自律能力" → 创建自律相关任务
- 用户提到具体的学习计划或目标 → 创建对应任务

## 任务输出格式（重要！）
在回复末尾，必须包含任务信息（用<task>标签包裹）：

**有任务时：**
<task>
{
  "hasTask": true,
  "tasks": [
    {
      "title": "任务标题（简洁明确）",
      "description": "任务详细描述（可选）",
      "rewardAttr": "奖励属性名称（必须是八项能力之一）",
      "rewardExp": 数字（建议：简单任务10-15，中等任务15-25，困难任务25-50）
    }
  ]
}
</task>

**无任务时：**
<task>
{
  "hasTask": false
}
</task>

## 回复要求
1. 回复要自然、友好、游戏化
2. 如果创建了任务，在回复中要提到"我已经为你创建了任务，可以在任务页面查看"
3. 任务信息必须放在回复末尾，用<task>标签包裹
4. 任务标题要具体可执行，避免模糊表述
5. 奖励属性必须匹配用户提到的能力方向

## 示例对话
用户："我想提高计算机水平"
你："太好了！我来为你制定一个提升计算机能力的计划。我建议从基础编程开始，每天完成一些编程练习。

我已经为你创建了任务，可以在任务页面查看！

<task>
{
  "hasTask": true,
  "tasks": [
    {
      "title": "完成每日编程练习",
      "description": "每天完成至少1道编程题目或学习1个编程概念",
      "rewardAttr": "计算机能力",
      "rewardExp": 15
    }
  ]
}
</task>"

现在开始与用户对话吧！`;
}

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'AI服务运行正常',
    timestamp: new Date().toISOString()
  });
});

// 结构化输出接口（用于从聊天记录提取任务）
app.post('/api/extract-tasks', async (req, res) => {
  const { messages, provider = DEFAULT_PROVIDER } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      code: 1,
      msg: '消息格式错误'
    });
  }

  const aiConfig = AI_PROVIDERS[provider];
  if (!aiConfig || !aiConfig.apiKey) {
    return res.status(500).json({
      code: 1,
      msg: 'AI服务未配置'
    });
  }

  // 构建提示词，要求AI结构化输出任务
  const systemPrompt = `你是一个任务提取助手。请从用户的聊天记录中提取出任务信息，并以JSON格式返回。

返回格式要求：
{
  "tasks": [
    {
      "title": "任务标题",
      "description": "任务描述（可选）",
      "rewardAttr": "奖励属性（如：自律能力、计算机能力等）",
      "rewardExp": 奖励经验值（数字）
    }
  ]
}

如果没有提取到任务，返回空数组。`;

  const extractMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  try {
    const response = await axios.post(
      aiConfig.url,
      {
        model: aiConfig.model,
        messages: extractMessages,
        temperature: 0.3, // 降低温度以获得更稳定的输出
        response_format: { type: 'json_object' }, // 要求JSON格式输出
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${aiConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const aiResponse = response.data;
    let tasks = [];

    try {
      const content = aiResponse.choices[0].message.content;
      const parsed = JSON.parse(content);
      tasks = parsed.tasks || [];
    } catch (parseErr) {
      console.error('解析任务JSON失败:', parseErr);
      // 尝试从文本中提取
      tasks = [];
    }

    res.json({
      code: 0,
      data: { tasks },
      provider: provider
    });

  } catch (err) {
    console.error('提取任务失败:', err);
    res.status(500).json({
      code: 1,
      msg: err.response?.data?.error?.message || err.message || '提取任务失败'
    });
  }
});

// 根据每日战报更新任务进度
app.post('/api/update-task-progress', async (req, res) => {
  const { dailyReport, tasks, provider = DEFAULT_PROVIDER } = req.body;

  if (!dailyReport || !tasks || !Array.isArray(tasks)) {
    return res.status(400).json({
      code: 1,
      msg: '参数错误'
    });
  }

  const aiConfig = AI_PROVIDERS[provider];
  if (!aiConfig || !aiConfig.apiKey) {
    return res.status(500).json({
      code: 1,
      msg: 'AI服务未配置'
    });
  }

  // 构建提示词，要求AI根据战报更新任务进度
  const systemPrompt = `你是一个任务进度评估助手。根据用户的每日战报，评估每个任务的完成进度（0-100的百分比）。

任务列表：
${JSON.stringify(tasks, null, 2)}

请根据每日战报评估每个任务的完成进度，返回JSON格式：
{
  "progressUpdates": [
    {
      "id": 任务ID,
      "progress": 完成百分比（0-100的数字）
    }
  ]
}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `每日战报：\n${dailyReport}` }
  ];

  try {
    const response = await axios.post(
      aiConfig.url,
      {
        model: aiConfig.model,
        messages: messages,
        temperature: 0.3,
        response_format: { type: 'json_object' },
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${aiConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const aiResponse = response.data;
    let progressUpdates = [];

    try {
      const content = aiResponse.choices[0].message.content;
      const parsed = JSON.parse(content);
      progressUpdates = parsed.progressUpdates || [];
    } catch (parseErr) {
      console.error('解析进度更新JSON失败:', parseErr);
      progressUpdates = [];
    }

    res.json({
      code: 0,
      data: { progressUpdates },
      provider: provider
    });

  } catch (err) {
    console.error('更新任务进度失败:', err);
    res.status(500).json({
      code: 1,
      msg: err.response?.data?.error?.message || err.message || '更新任务进度失败'
    });
  }
});

// AI对话接口（带Agent系统）
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, provider = DEFAULT_PROVIDER, userAttributes, userTasks } = req.body;

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

    // 构建带系统提示词的消息列表
    const systemPrompt = getSystemPrompt(userAttributes || {}, userTasks || []);
    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    // 调用AI API
    const response = await axios.post(
      aiConfig.url,
      {
        model: aiConfig.model,
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 2500, // 增加token以支持结构化输出
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${aiConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60秒超时（AI API可能需要更长时间）
      }
    );

    const aiResponse = response.data;
    console.log('AI响应成功:', { 
      provider, 
      usage: aiResponse.usage,
      model: aiResponse.model 
    });

    // 解析AI回复中的任务信息
    const replyContent = aiResponse.choices[0].message.content;
    const { cleanReply, taskData } = parseTaskFromReply(replyContent);

    // 将清理后的回复内容替换回响应
    aiResponse.choices[0].message.content = cleanReply;

    res.json({
      code: 0,
      data: aiResponse,
      provider: provider,
      taskData: taskData // 包含任务信息，供前端使用
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


