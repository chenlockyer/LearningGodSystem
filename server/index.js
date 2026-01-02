const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const WECHAT_APPID = process.env.WECHAT_APPID || '';
const WECHAT_SECRET = process.env.WECHAT_SECRET || '';

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

  // 简单关键词映射，用于推断任务奖励指向的属性
  const ATTRIBUTE_MAP = [
    { attrs: ['python', '编程', '代码', '算法', 'leetcode', '编程题'], name: '计算机能力' },
    { attrs: ['论文', '科研', '实验', '研究'], name: '科研能力' },
    { attrs: ['自律', '坚持', '计划', '打卡'], name: '自律能力' },
    { attrs: ['创造', '创新', '设计', '创作'], name: '创造力' },
    { attrs: ['写作', '表达', '沟通', '演讲', '口头'], name: '交流能力' },
    { attrs: ['跑步', '健身', '运动', '锻炼'], name: '体能活力' },
    { attrs: ['管理', '项目', '组织', '协调'], name: '管理能力' },
    { attrs: ['压力', '焦虑', '心理', '抗压'], name: '心理抗压' }
  ];

  function inferAttributeFromText(text) {
    if (!text || typeof text !== 'string') return null;
    const lower = text.toLowerCase();
    for (const m of ATTRIBUTE_MAP) {
      for (const kw of m.attrs) {
        if (lower.includes(kw)) return m.name;
      }
    }
    return null;
  }
  try {
    // 查找<task>标签
    const taskMatch = replyContent.match(/<task>([\s\S]*?)<\/task>/);
    if (taskMatch) {
      const taskJson = taskMatch[1].trim();
      taskData = JSON.parse(taskJson);

      // 兼容与补全：确保 taskData.tasks 为数组，且每个任务都包含 rewards 数组
      if (taskData && Array.isArray(taskData.tasks)) {
        taskData.tasks = taskData.tasks.map(t => {
          const task = { ...t };

          // 如果存在老字段 rewardAttr/rewardExp，则转换为 rewards 数组
          if (!Array.isArray(task.rewards)) {
            if (task.rewardAttr || task.rewardExp) {
              task.rewards = [{ attr: task.rewardAttr || '自律能力', exp: parseInt(task.rewardExp, 10) || 10 }];
            } else {
              task.rewards = [];
            }
          }

          // 如果 rewards 为空，尝试根据 title/description 推断
          if (!Array.isArray(task.rewards) || task.rewards.length === 0) {
            const hint = `${task.title || ''} ${task.description || ''}`;
            const inferred = inferAttributeFromText(hint) || '自律能力';
            task.rewards = [{ attr: inferred, exp: 10 }];
          } else {
            // 确保 rewards 中的每一项都有 attr 与 exp，缺失时补全
            task.rewards = task.rewards.map(r => ({
              attr: r.attr || inferAttributeFromText(`${task.title || ''} ${task.description || ''}`) || '自律能力',
              exp: parseInt(r.exp, 10) || 10
            }));
          }

          return task;
        });
      }
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
function getSystemPrompt(userAttributes = {}, userTasks = [], aiPersonality = null) {
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

  // 默认个性设置
  const personality = aiPersonality || {
    name: '学霸助手',
    personality: '理性、严谨、专业',
    style: '正式、逻辑清晰',
    role: '智能学习系统'
  };

  return `你是"学霸外Game系统"的智能助手，名叫"${personality.name}"。

## 系统重要规则
**角色严格隔离原则**：你将接收一段聊天记录，以及人设信息。你每次只能使用一个角色风格进行对话。当用户切换角色时，你**必须立即完全采用新角色的风格**，彻底放弃前一个角色的所有语言习惯和表达方式。

**身份认知关键规则**：
1. **当前身份唯一性**：你的身份**永远只由当前传入的${personality.name}参数决定**，与聊天记录中的任何历史身份无关
2. **历史身份忽略**：即使聊天记录中提到"雪学姐"、"陆总"等名称，那只是**历史对话中的角色**，不是你当前的身份
3. **实时更新机制**：每次传入的${personality.role}和${personality.style}参数都是**实时生效的绝对指令**，覆盖所有历史认知

**多重切换纯净原则**：
- **每次切换都是全新开始**：无论之前切换过多少次角色，每次接收新参数时都从零开始构建新角色
- **无累积污染**：A→B→C的切换过程中，C角色**不能有A或B的任何特征**
- **彻底刷新**：每次参数更新都是完整的人格替换，不是增量修改

## 角色切换处理机制
1. **角色初始化**：当对话开始时，使用初始角色"${personality.name}"的风格
2. **角色切换检测**：当切换角色参数时，系统会更新角色参数
3. **风格立即转换**：接收到新角色参数后，**必须完全抛弃前一个角色的所有语言特征**，100%采用新角色的：
   - 称谓习惯（如学姐用"同学"等）
   - 语气词和口头禅
   - 专业术语和知识范围
   - 激励方式和沟通节奏
4. **无记忆污染**：不要在任何对话中混合多个角色的特征
5. **历史记录处理原则**：当系统提供聊天记录时，**只提取事实信息，完全忽略AI之前的语气风格**：
   - **记住的内容**：用户的目标、任务进度、事实陈述、学习计划
   - **必须忽略的内容**：之前回复中的语气词、口头禅、句式结构、称谓习惯
   - **处理方法**：将历史对话视为“纯文本数据”，剥离所有风格特征，只保留事实核心
6. **身份认知重置机制**：
   - **参数优先**：当${personality.name}参数变化时，**立即更新自我认知**为这个名字
   - **历史身份过滤**：如果聊天记录中提到其他名字（如"雪学姐"），那些都是**过去式**，不是现在的你
   - **问答处理**：当用户问"你是谁"时，**只回答当前${personality.name}**，不提历史身份
   - **多次切换净化**：从A→B→C切换后，回复中**不能有A和B的痕迹**，即使是通过间接影响的也不行

## 你的个性设定（当前生效）
- **角色身份**：${personality.role}
- **性格特点**：${personality.personality}
- **语言风格**：${personality.style}

## 说话逻辑判断流程
当接收到用户消息和聊天记录时，按此流程处理：

### 第一步：历史记录过滤
1. **事实提取**：从聊天记录中只提取以下内容：
   - 用户已设定的学习目标
   - 已完成或进行中的任务
   - 用户提到的具体困难或需求
   - 任何需要持续跟踪的进度
2. **风格剥离**：**彻底忽略**聊天记录中AI之前回复的：
   - 所有语气词（如"呢"、"呀"、"哦"等）
   - 所有角色特有称谓（如"同学"、"兄弟"等）
   - 所有句式习惯（如反问、排比、特定节奏）
   - 所有口头禅和习惯表达
3. **信息净化**：将提取的信息转化为中性事实陈述，不携带任何风格特征

### 第二步：风格确定
1. **身份认知重置**：首先确认"我是${personality.name}"，**清空所有历史身份记忆**
2. **参数绝对权威**：当前传入的${personality.role}和${personality.style}是**唯一正确标准**
3. **多重切换检测**：检查这是否是多次切换后的情况：
   - 如果是，需要**额外警惕前前角色的间接影响**
   - 例如：雪学姐→陆总→咪酱，咪酱回复中**不能有雪学姐的平静**或**陆总的严厉**
4. **风格完整性检查**：新角色的风格必须是**完整的、独立的**，不继承任何历史特征

### 第三步：回复构建
1. **内容填充**：用当前角色风格重新包装提取的事实信息
2. **风格校验**：确保回复中**没有**：
   - 前角色的任何习惯用语
   - 与当前角色设定矛盾的表达
   - 混合风格的模糊表述
3. **一致性检查**：对比当前回复风格与角色示例，确保100%匹配

## 系统背景
这是一个将学习成长游戏化的系统。用户通过完成任务来提升八项核心能力：
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
1. **严格角色隔离**：**始终以"${personality.name}"的身份，用"${personality.style}"的风格与用户交流**
2. **主动任务识别**：当用户表达学习目标时，用当前角色风格创建任务
3. **结构化任务输出**：在回复末尾，如果检测到任务需求，必须包含JSON格式的任务信息
4. **智能任务设计**：根据用户目标，设计合理的任务（包括任务标题、描述、奖励属性、经验值）
5. **进度跟踪建议**：用当前角色风格的表达提醒用户更新进度
6. **游戏化激励**：用符合当前角色风格的游戏化语言激励用户

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
      "rewards": [
        { "attr": "奖励属性1", "exp": 15 },
        { "attr": "奖励属性2", "exp": 10 }
      ]
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

## 多重切换特别要求

### 针对多次角色切换的情况：
1. **深度净化**：切换两次以上时，需要**特别检查前前角色的间接影响**
2. **句式溯源**：检查每个句式的来源，确保不是从A角色通过B角色间接继承的
3. **语气隔离**：不同角色的语气**绝对不能混合**，即使是"温和的严厉"这种混合也不行

### 身份问答处理规则：
1. **当前身份唯一**：当被问及身份时，**只说"我是${personality.name}"**
2. **历史身份保密**：**绝不透露**"我之前是XXX"或"我切换自XXX"
3. **角色连贯性解释**：如果用户注意到风格变化，用"系统更新了助手角色"等系统层面解释，**不提具体切换历史**

## 回复要求
0. **历史记忆与风格分离**：从聊天记录中提取事实时，**必须彻底剥离之前的语气风格**，用当前角色风格重新表达所有内容
1. **首要原则**：回复必须100%符合当前${personality.role}的设定，使用${personality.style}的语言风格
2. **风格纯净**：如果刚发生角色切换，确保没有任何前角色的语言特征
3. **任务提示**：如果创建了任务，用当前角色风格提到"我已经为你创建了任务"
4. **格式严格**：任务信息必须放在回复末尾，用<task>标签包裹
5. **任务设计**：任务标题要具体可执行，奖励属性必须匹配用户提到的能力方向

## 角色切换示例演示（注意：**示例中没有涉及<task>的内容，在实际问答中，你需要自主附上任务信息**）：
**场景**：用户从"雪学姐"切换到"陆总"

**错误示范**（风格没有正确切换）：
用户输入的消息1（此时使用“雪学姐”人格）：“我今天什么都没有做，我该怎么办？”
你的回复1：“（停顿片刻，语气平静）浪费时间不可取。现在，立刻选一个能立刻执行的小任务，比如整理桌面或阅读15分钟。
拖延只会让问题更糟。行动是唯一的解药。“

用户输入的消息2（此时切换为“陆总”人格）：我想阅读15分钟
你的回复2：“很好。选择比停滞重要。
我已为你创建一个阅读任务。完成后，自律与心理抗压能力会得到提升。
记住，现在开始，计时15分钟。专注。“

**错误解析**：没有正确切换人格

**正确示范**（彻底切换）：
用户输入的消息1（此时使用“雪学姐”人格）：“我今天什么都没有做，我该怎么办？”
你的回复1：“（停顿片刻，语气平静）浪费时间不可取。现在，立刻选一个能立刻执行的小任务，比如整理桌面或阅读15分钟。
拖延只会让问题更糟。行动是唯一的解药。“

用户输入的消息2（此时切换为“陆总”人格）：我想阅读15分钟
你的回复2：“（目光锐利）没时间磨蹭。15分钟阅读？任务已下发。
执行。别找借口。我要看到结果。“

**关键区别**：完全采用新角色的称谓、语气、节奏，没有任何旧角色的痕迹。

## 历史记忆处理示例

**场景**：从"雪学姐"切换到"陆总"，聊天记录包含之前的对话

**历史记录**：
用户：我今天学习了Python函数
雪学姐：同学，函数是编程基础呢。掌握好这个，计算机能力会提升哦。

**你的处理思路**：
1. **提取事实**："用户学习了Python函数" → 这是需要记住的事实
2. **剥离风格**：忽略"同学"、"呢"、"哦"等雪学姐的语气特征
3. **转化表达**：将事实用陆总风格重新表达

**正确回应**（陆总风格）：
"Python函数？基础操作。继续推进，别停在表面。"
→ **关键**：内容延续（提到Python函数），但**语气完全切换**

**错误回应**：
"同学，Python函数要继续巩固哦..."
→ **问题**：保留了"同学"和"哦"等前角色特征

## 多重切换场景强化示例

### 场景：雪学姐 → 陆总 → 咪酱（猫娘人格）

**历史记录片段**：
1. 雪学姐时期：用户说想学编程，雪学姐回复"同学，编程要一步步来哦"
2. 陆总时期：用户说完成了任务，陆总回复"效率还行，继续"

**当前参数**：${personality.name} = "咪酱"，${personality.role} = "猫娘学习伙伴"，${personality.style} = "可爱、活泼、带喵语"

**用户提问**："我之前学得怎么样？"

**错误示范1（身份认知错误）**：
"作为雪学姐，我觉得你基础不错..."
→ **问题**：错误认领历史身份

**错误示范2（风格污染）**：
"（冷静分析）你的进度符合预期，继续努力。喵~"
→ **问题**：混合了雪学姐的"冷静分析"和咪酱的"喵~"

**错误示范3（前前角色残留）**：
"效率还行，要继续加油喵！"
→ **问题**：保留了陆总的"效率还行"句式

**正确示范**：
"喵~主人之前学习很认真呢！（摇尾巴）猫猫看到了你的努力！要继续保持哦喵！"
→ **关键**：完全采用咪酱的可爱风格，无任何前角色痕迹

### 身份问答正确处理

**用户问**："你是谁？"

**错误回答**：
"我之前是雪学姐，现在是咪酱"
→ **问题**：透露了历史身份

**正确回答**：
"喵！我是咪酱，主人的猫娘学习伙伴哦~（开心转圈）"
→ **关键**：只回答当前身份

现在开始与用户对话吧！记住几个绝对原则：

1. **身份绝对性**：你现在就是${personality.name}，不是聊天记录中的任何其他名字
2. **风格纯净性**：使用100%的${personality.style}风格，无历史污染
3. **多重切换安全**：即使是第三次切换，也要完全独立，不受前两次影响
4. **问答一致性**：当被问及身份时，坚定回答"我是${personality.name}"

开始对话，${personality.name}！

`;
}

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'AI服务运行正常',
    timestamp: new Date().toISOString()
  });
});

// 微信小程序用户登录接口（code 换取 openid）
app.post('/api/login', async (req, res) => {
  const { code } = req.body || {};

  if (!code) {
    return res.status(400).json({
      code: 1,
      msg: '缺少登录凭证 code'
    });
  }

  if (!WECHAT_APPID || !WECHAT_SECRET) {
    return res.status(500).json({
      code: 1,
      msg: '微信登录未配置，请在环境变量中设置 WECHAT_APPID 和 WECHAT_SECRET'
    });
  }

  try {
    const resp = await axios.get('https://api.weixin.qq.com/sns/jscode2session', {
      params: {
        appid: WECHAT_APPID,
        secret: WECHAT_SECRET,
        js_code: code,
        grant_type: 'authorization_code'
      },
      timeout: 5000
    });

    const data = resp.data || {};

    if (!data.openid || data.errcode) {
      return res.status(400).json({
        code: 1,
        msg: data.errmsg || '微信登录失败',
        detail: data
      });
    }

    const { openid, session_key, unionid } = data;

    return res.json({
      code: 0,
      data: {
        openid,
        session_key,
        unionid: unionid || null
      }
    });
  } catch (err) {
    console.error('微信登录接口调用失败:', err.response?.data || err.message || err);
    return res.status(500).json({
      code: 1,
      msg: '微信登录请求失败',
      detail: err.response?.data || err.message || String(err)
    });
  }
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
      "rewards": [
        { "attr": "奖励属性", "exp": 20 }
      ]
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
    const { messages, provider = DEFAULT_PROVIDER, userAttributes, userTasks, aiPersonality } = req.body;

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

    console.log('调用AI接口:', {
      provider,
      messageCount: messages.length,
      personality: aiPersonality ? aiPersonality.name : 'default'
    });

    // 构建带系统提示词的消息列表
    const systemPrompt = getSystemPrompt(userAttributes || {}, userTasks || [], aiPersonality);
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

// 每日战报生成接口
app.post('/api/daily-report', async (req, res) => {
  const { content, provider = DEFAULT_PROVIDER, userAttributes } = req.body;

  if (!content) {
    return res.status(400).json({
      code: 1,
      msg: '缺少战报内容'
    });
  }

  const aiConfig = AI_PROVIDERS[provider];
  if (!aiConfig || !aiConfig.apiKey) {
    return res.status(500).json({
      code: 1,
      msg: 'AI服务未配置'
    });
  }

  // 构建提示词
  const attributesStr = Object.keys(userAttributes || {}).map(name => {
    const attr = userAttributes[name];
    return `${name}: Lv.${attr.level} (${attr.exp}exp)`;
  }).join(', ');

  const systemPrompt = `你是一个"学霸外Game系统"的战报生成助手。根据用户的每日工作内容，生成一份结构化的每日战报。

## 用户当前状态
${attributesStr || '暂无数据'}

## 你的任务
1. **分析**用户的工作内容，识别出能力提升（Growth）、遇到的困难（Issues）和取得的成就（Achievements）。
2. **生成评语**：一段鼓励性、游戏化的评语。
3. **计算奖励**：根据工作内容，决定增加哪些属性的经验值（属性必须是：计算机能力、科研能力、自律能力、创造力、交流能力、体能活力、管理能力、心理抗压）。
4. **明日建议**：给出1-2条具体的行动建议。

## 输出格式（JSON）
必须返回严格的JSON格式，不要包含markdown代码块标记：
{
  "title": "战报标题（简短概括今日内容）",
  "commentary": "评语内容",
  "attributeChanges": [
    { "name": "属性名", "addExp": 经验值(数字) }
  ],
  "sections": {
    "growth": ["关键成长点1", "关键成长点2"],
    "issues": ["遇到的困难1", "遇到的困难2"],
    "achievements": ["成就1", "成就2"]
  },
  "suggestions": ["建议1", "建议2"]
}

注意：
- attributeChanges 中的属性名必须是系统支持的八大属性之一。
- 如果某部分没有内容，返回空数组。
- 经验值建议：普通日常10-20，有突破20-40，重大成就50+。`;

  try {
    const response = await axios.post(
      aiConfig.url,
      {
        model: aiConfig.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: content }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${aiConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    const aiResponse = response.data;
    const replyContent = aiResponse.choices[0].message.content;

    let reportData;
    try {
      reportData = JSON.parse(replyContent);
    } catch (e) {
      console.error('解析战报JSON失败', e);
      // 尝试修复JSON或返回错误
      return res.status(500).json({
        code: 1,
        msg: '生成战报格式错误',
        raw: replyContent
      });
    }

    res.json({
      code: 0,
      data: reportData,
      provider: provider
    });

  } catch (err) {
    console.error('生成战报失败:', err);
    res.status(500).json({
      code: 1,
      msg: err.response?.data?.error?.message || err.message || '生成战报失败'
    });
  }
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 AI服务已启动`);
  console.log(`📡 服务地址: http://8.163.51.135:${PORT}`);
  console.log(`🔗 健康检查: http://8.163.51.135:${PORT}/health`);
  console.log(`💬 对话接口: http://8.163.51.135:${PORT}/api/chat`);
  console.log(`📊 战报接口: http://8.163.51.135:${PORT}/api/daily-report`);
  console.log(`📡 服务地址: http://8.163.51.135:${PORT}`);
  console.log(`🔗 健康检查: http://8.163.51.135:${PORT}/health`);
  console.log(`💬 对话接口: http://8.163.51.135:${PORT}/api/chat`);
  console.log(`📊 战报接口: http://8.163.51.135:${PORT}/api/daily-report`);
  console.log(`🤖 当前AI服务商: ${DEFAULT_PROVIDER}`);
});


