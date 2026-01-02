// 本地存储封装（localStorage 方案）
const ATTR_KEY = 'mp_attributes_v1';
const TASKS_KEY = 'mp_tasks_v1';
const REPORTS_KEY = 'mp_reports_v1';
const AI_PERSONALITY_KEY = 'mp_ai_personality_v1';

// 默认八项能力
const DEFAULT_ATTRIBUTES = {
  计算机能力: { level: 1, exp: 0 },
  科研能力: { level: 1, exp: 0 },
  自律能力: { level: 1, exp: 0 },
  创造力: { level: 1, exp: 0 },
  交流能力: { level: 1, exp: 0 },
  体能活力: { level: 1, exp: 0 },
  管理能力: { level: 1, exp: 0 },
  心理抗压: { level: 1, exp: 0 }
};

// AI个性预设
const AI_PRESETS = {
  default: {
    name: '学霸助手',
    personality: '理性、严谨、专业',
    style: '正式、逻辑清晰',
    role: '智能学习系统'
  },
  senior: {
    name: '雪学姐',
    personality: '高冷、优雅、严格',
    style: '简洁、有距离感',
    role: '成绩优异的学姐'
  },
  junior: {
    name: '小樱学妹',
    personality: '活泼、可爱、调皮',
    style: '俏皮、emoji多',
    role: '可爱的学妹'
  },
  brother: {
    name: '阿阳学长',
    personality: '温暖、阳光、鼓励',
    style: '亲切、正能量',
    role: '温柔的邻家哥哥'
  },
  ceo: {
    name: '陆总',
    personality: '强势、果断、霸气',
    style: '简短有力、命令式',
    role: '商业精英'
  },
  catgirl: {
    name: '咪酱',
    personality: '可爱、粘人、温柔',
    style: '软萌、喵喵叫',
    role: '猫娘女仆'
  }
};

const DEFAULT_PERSONALITY = AI_PRESETS.default;

function save(key, val) {
  try {
    wx.setStorageSync(key, val);
  } catch (e) {
    console.error('storage save error', e);
  }
}

function load(key) {
  try {
    const v = wx.getStorageSync(key);
    return v || null;
  } catch (e) {
    console.error('storage load error', e);
    return null;
  }
}

function initDefaults() {
  const attrs = load(ATTR_KEY);
  if (!attrs) {
    save(ATTR_KEY, DEFAULT_ATTRIBUTES);
  }
  const tasks = load(TASKS_KEY);
  if (!tasks) save(TASKS_KEY, []);
  const reports = load(REPORTS_KEY);
  if (!reports) save(REPORTS_KEY, []);
  const personality = load(AI_PERSONALITY_KEY);
  if (!personality) save(AI_PERSONALITY_KEY, DEFAULT_PERSONALITY);
}

function getAttributes() {
  return load(ATTR_KEY) || DEFAULT_ATTRIBUTES;
}

function saveAttributes(attrs) {
  save(ATTR_KEY, attrs);
}

// 简单升级规则：每100经验升1级（示例，可调整）
function normalizeAttribute(attr) {
  const level = Math.floor(attr.exp / 100) + 1;
  const progress = attr.exp % 100; // 0-99
  return { level, exp: attr.exp, progress };
}

function addExp(attrName, add) {
  const attrs = getAttributes();
  if (!attrs[attrName]) {
    // 未定义能力则创建
    attrs[attrName] = { level: 1, exp: 0 };
  }
  attrs[attrName].exp += add;
  const normalized = normalizeAttribute(attrs[attrName]);
  attrs[attrName].level = normalized.level;
  // 保留 exp 原值以便继续累加
  saveAttributes(attrs);
  return { name: attrName, level: normalized.level, progress: normalized.progress };
}

function getTasks() {
  return load(TASKS_KEY) || [];
}

function saveTasks(tasks) {
  save(TASKS_KEY, tasks);
}

function addTask(task) {
  const tasks = getTasks();
  const id = Date.now();
  const newTask = Object.assign({
    id,
    createdAt: Date.now(),
    done: false,
    progress: 0,  // 任务完成百分比 0-100
    rating: null, // 完成度评级：'excellent' | 'good' | 'normal' | 'poor'
    source: 'manual', // 任务来源：'manual'
    rewards: task.rewards || [{ attr: task.rewardAttr, exp: task.rewardExp }] // 支持多重奖励
  }, task);
  tasks.unshift(newTask);
  saveTasks(tasks);
  return newTask;
}

// 更新任务进度（由AI根据每日战报更新）
function updateTaskProgress(id, progress) {
  const tasks = getTasks();
  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return null;
  const task = tasks[idx];
  if (task.done) return task;

  // 确保进度在0-100之间
  task.progress = Math.max(0, Math.min(100, progress));
  task.lastUpdated = Date.now();

  // 如果进度达到100%，自动标记为完成
  if (task.progress >= 100 && !task.done) {
    task.done = true;
    task.completedAt = Date.now();
  }

  saveTasks(tasks);
  return task;
}

// 批量更新任务进度（用于每日战报）
function updateTasksProgress(progressUpdates) {
  const tasks = getTasks();
  const updated = [];

  progressUpdates.forEach(update => {
    const idx = tasks.findIndex(t => t.id === update.id);
    if (idx !== -1 && !tasks[idx].done) {
      tasks[idx].progress = Math.max(0, Math.min(100, update.progress));
      tasks[idx].lastUpdated = Date.now();

      if (tasks[idx].progress >= 100 && !tasks[idx].done) {
        tasks[idx].done = true;
        tasks[idx].completedAt = Date.now();
      }

      updated.push(tasks[idx]);
    }
  });

  saveTasks(tasks);
  return updated;
}

// 完成任务并评级
function completeTask(id, rating = null) {
  const tasks = getTasks();
  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return null;
  const task = tasks[idx];
  if (task.done) return task;

  task.done = true;
  task.completedAt = Date.now();
  task.progress = 100;

  // 根据进度自动评级（如果未提供）
  if (!rating) {
    if (task.progress >= 90) {
      rating = 'excellent';
    } else if (task.progress >= 70) {
      rating = 'good';
    } else if (task.progress >= 50) {
      rating = 'normal';
    } else {
      rating = 'poor';
    }
  }
  task.rating = rating;

  saveTasks(tasks);

  // 根据评级发放奖励（优秀完成有额外奖励）
  const multiplier = rating === 'excellent' ? 1.0 :
    rating === 'good' ? 0.9 :
      rating === 'normal' ? 0.75 : 0.6;

  // 兼容旧数据：如果没有 rewards 数组，则构造一个
  const rewards = task.rewards || (task.rewardAttr ? [{ attr: task.rewardAttr, exp: task.rewardExp }] : []);

  // 遍历发放所有奖励
  rewards.forEach(r => {
    let finalExp = Math.floor(r.exp * multiplier);
    if (finalExp > 0) {
      addExp(r.attr, finalExp);
    }
  });

  return { ...task, rewards, rating, multiplier };
}


function getReports() {
  return load(REPORTS_KEY) || [];
}

function saveReport(report) {
  const reports = getReports();
  // report 应该包含 id, createdAt, content, aiResponse 等
  const newReport = {
    id: Date.now(),
    createdAt: Date.now(),
    ...report
  };
  reports.unshift(newReport);
  save(REPORTS_KEY, reports);
  return newReport;
}

function getAIPersonality() {
  return load(AI_PERSONALITY_KEY) || DEFAULT_PERSONALITY;
}

function saveAIPersonality(personality) {
  save(AI_PERSONALITY_KEY, personality);
}

function getAIPresets() {
  return AI_PRESETS;
}

module.exports = {
  initDefaults,
  getAttributes,
  saveAttributes,
  addExp,
  getTasks,
  saveTasks,
  addTask,
  updateTaskProgress,
  updateTasksProgress,
  completeTask,
  getReports,
  saveReport,
  getAIPersonality,
  saveAIPersonality,
  getAIPresets
};
