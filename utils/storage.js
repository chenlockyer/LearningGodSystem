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
  const newTask = Object.assign({ id, createdAt: Date.now(), done: false }, task);
  tasks.unshift(newTask);
  saveTasks(tasks);
  return newTask;
}

function completeTask(id) {
  const tasks = getTasks();
  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return null;
  const task = tasks[idx];
  if (task.done) return task;
  task.done = true;
  task.completedAt = Date.now();
  saveTasks(tasks);
  // 发放奖励
  if (task.rewardAttr && task.rewardExp) {
    addExp(task.rewardAttr, task.rewardExp);
  }
  return task;
}

module.exports = {
  initDefaults,
  getAttributes,
  saveAttributes,
  addExp,
  getTasks,
  saveTasks,
  addTask,
  completeTask
};
