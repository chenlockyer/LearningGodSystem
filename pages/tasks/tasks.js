const storage = require('../../utils/storage.js');


Page({
  data: {
    tasks: [],
    tasks: [],
    title: '',
    titleCount: 0,
    description: '', // 新增：用于双向绑定清空描述
    // 属性配置
    attrOptions: ['计算机能力', '科研能力', '自律能力', '创造力', '交流能力', '体能活力', '管理能力', '心理抗压'],
    attrIndex: 2,
    rewardAttr: '自律能力',
    // 经验配置：10-100，步长5
    expOptions: Array.from({ length: 19 }, (_, i) => 10 + i * 5),
    expIndex: 0,
    rewardExp: 10
  },

  onLoad() { this.loadTasks(); },
  onShow() { this.loadTasks(); },

  // 监听属性选择器
  onAttrChange(e) {
    const index = e.detail.value;
    this.setData({
      attrIndex: index,
      rewardAttr: this.data.attrOptions[index]
    });
  },

  // 监听经验选择器
  onExpChange(e) {
    const index = e.detail.value;
    this.setData({
      expIndex: index,
      rewardExp: this.data.expOptions[index]
    });
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

    // 提交到 storage
    storage.addTask({
      title: cleanTitle,
      rewardAttr: this.data.rewardAttr, // 从 data 获取当前选中的属性
      rewardExp: this.data.rewardExp,   // 从 data 获取当前选中的经验
      description: cleanDescription
    });

    wx.showToast({ title: '任务已添加', icon: 'success' });

    // --- 关键：重置表单状态 ---
    this.setData({
      title: '',        // 清空标题
      titleCount: 0,    // 字数归零
      description: ''   // 清空描述
    });

    this.loadTasks();
  },

  // 其余逻辑（loadTasks, onComplete, onConfirmImport等）保持不变...
  loadTasks() {
    const tasks = storage.getTasks() || [];
    tasks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    tasks.forEach(task => {
      task.progressColor = this.getProgressColor(task.progress || 0);
    });
    this.setData({ tasks });
  },

  onComplete(e) {
    const id = parseFloat(e.currentTarget.dataset.id);
    const result = storage.completeTask(id);
    if (result) {
      const ratingText = this.getRatingText(result.rating);
      wx.showToast({ title: `完成！评级：${ratingText}，+${result.rewardExp}经验`, icon: 'success', duration: 3000 });
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