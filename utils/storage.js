// 本地存储封装（localStorage 方案）
const ATTR_KEY = 'mp_attributes_v1';
const TASKS_KEY = 'mp_tasks_v1';

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
    source: 'manual' // 任务来源：'manual' | 'ai_import'
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
  let rewardExp = task.rewardExp || 0;
  if (rating === 'excellent') {
    rewardExp = Math.floor(rewardExp * 1.5); // 优秀完成奖励1.5倍
  } else if (rating === 'good') {
    rewardExp = Math.floor(rewardExp * 1.2); // 良好完成奖励1.2倍
  }
  
  // 发放奖励
  if (task.rewardAttr && rewardExp > 0) {
    addExp(task.rewardAttr, rewardExp);
  }
  
  return { ...task, rewardExp, rating };
}

// 从AI聊天记录导入任务
function importTasksFromAI(tasksData) {
  const tasks = getTasks();
  const imported = [];
  
  if (!Array.isArray(tasksData)) {
    tasksData = [tasksData];
  }
  
  tasksData.forEach(taskData => {
    const id = Date.now() + Math.random();
    const newTask = {
      id,
      title: taskData.title || '未命名任务',
      rewardAttr: taskData.rewardAttr || '自律能力',
      rewardExp: parseInt(taskData.rewardExp, 10) || 10,
      progress: 0,
      rating: null,
      done: false,
      createdAt: Date.now(),
      source: 'ai_import',
      description: taskData.description || ''
    };
    tasks.unshift(newTask);
    imported.push(newTask);
  });
  
  saveTasks(tasks);
  return imported;
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
  importTasksFromAI
};
