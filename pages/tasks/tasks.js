const storage = require('../../utils/storage.js');


Page({
  data: {
    tasks: [],
    title: '',
    titleCount: 0,
    description: '', // 新增：用于双向绑定清空描述
    // 属性配置
    attrOptions: ['计算机能力', '科研能力', '自律能力', '创造力', '交流能力', '体能活力', '管理能力', '心理抗压'],
    // 经验配置：10-100，步长5
    expOptions: Array.from({ length: 19 }, (_, i) => 10 + i * 5),

    // 多重奖励列表
    rewards: [{ attrIndex: 2, expIndex: 0 }] // 默认一项：自律能力, 10exp
  },

  onLoad() { this.loadTasks(); },
  onShow() { this.loadTasks(); },

  // 监听属性选择器变更
  onRewardAttrChange(e) {
    const idx = e.currentTarget.dataset.index;
    const value = e.detail.value;
    const rewards = this.data.rewards;
    rewards[idx].attrIndex = value;
    this.setData({ rewards });
  },

  // 监听经验选择器变更
  onRewardExpChange(e) {
    const idx = e.currentTarget.dataset.index;
    const value = e.detail.value;
    const rewards = this.data.rewards;
    rewards[idx].expIndex = value;
    this.setData({ rewards });
  },

  // 添加奖励行
  onAddRewardRow() {
    const rewards = this.data.rewards;
    rewards.push({ attrIndex: 2, expIndex: 0 }); // 默认添加一项
    this.setData({ rewards });
  },

  // 删除奖励行
  onRemoveRewardRow(e) {
    const idx = e.currentTarget.dataset.index;
    const rewards = this.data.rewards;
    if (rewards.length <= 1) {
      wx.showToast({ title: '至少保留一项奖励', icon: 'none' });
      return;
    }
    rewards.splice(idx, 1);
    this.setData({ rewards });
  },

  // 输入清洗与字数统计
  onInputSanitize(e) {
    let value = e.detail.value.replace(/\s+/g, '');
    const length = value.length;
    if (length > 15) {
      value = value.substring(0, 15);
      wx.showToast({ title: '字数已达上限', icon: 'none' });
    }
    this.setData({ title: value, titleCount: value.length });
    return value;
  },

  // 核心修改：新增任务并清空表单
  onAddTask(e) {
    // 从表单获取 title 和 description
    let { title, description } = e.detail.value;

    const cleanTitle = (title || '').replace(/\s+/g, '').substring(0, 15);
    const cleanDescription = (description || '').trim();

    if (!cleanTitle) {
      wx.showToast({ title: '请输入有效任务名', icon: 'none' });
      return;
    }

    // 构造 rewards 数组
    const finalRewards = this.data.rewards.map(r => ({
      attr: this.data.attrOptions[r.attrIndex],
      exp: this.data.expOptions[r.expIndex]
    }));

    // 提交到 storage
    storage.addTask({
      title: cleanTitle,
      rewards: finalRewards,
      description: cleanDescription
    });

    wx.showToast({ title: '任务已添加', icon: 'success' });

    // --- 关键：重置表单状态 ---
    this.setData({
      title: '',        // 清空标题
      titleCount: 0,    // 字数归零
      description: '',  // 清空描述
      rewards: [{ attrIndex: 2, expIndex: 0 }] // 重置为默认一项
    });

    this.loadTasks();
  },

  // 其余逻辑（loadTasks, onComplete, onConfirmImport等）保持不变...
  loadTasks() {
    const tasks = storage.getTasks() || [];
    tasks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    tasks.forEach(task => {
      task.progressColor = this.getProgressColor(task.progress || 0);
      if (task.expanded === undefined) task.expanded = false; // 初始化折叠状态
    });
    this.setData({ tasks });
  },

  // 切换任务描述折叠状态
  onToggleDescription(e) {
    const id = e.currentTarget.dataset.id;
    const tasks = this.data.tasks.map(t => {
      if (t.id === id) {
        return { ...t, expanded: !t.expanded };
      }
      return t;
    });
    this.setData({ tasks });
  },

  onComplete(e) {
    const id = parseFloat(e.currentTarget.dataset.id);
    const result = storage.completeTask(id);
    if (result) {
      const ratingText = this.getRatingText(result.rating);
      // 显示获得了多少经验（汇总）
      const totalExp = result.rewards.reduce((sum, r) => sum + Math.floor(r.exp * result.multiplier), 0);
      wx.showToast({ title: `完成！级:${ratingText} +${totalExp}exp`, icon: 'success', duration: 3000 });
    }
    this.loadTasks();
  },

  getProgressColor(progress) {
    if (progress >= 90) return '#34C759';
    if (progress >= 70) return '#007AFF';
    if (progress >= 50) return '#FF9500';
    return '#FF3B30';
  },

  getRatingText(rating) {
    const map = { 'excellent': '优秀', 'good': '良好', 'normal': '普通', 'poor': '较差' };
    return map[rating] || '普通';
  },


});