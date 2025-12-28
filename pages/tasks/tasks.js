const storage = require('../../utils/storage.js');
const taskAPI = require('../../utils/task.js');

Page({
  data: {
    tasks: [],
    title: '',
    titleCount: 0,
    // 1. 属性配置
    attrOptions: ['计算机能力', '科研能力', '自律能力', '创造力', '交流能力', '体能活力', '管理能力', '心理抗压'],
    attrIndex: 2,
    rewardAttr: '自律能力',
    
    // 2. 经验配置：生成 [10, 15, 20, ..., 100] 的数组
    expOptions: Array.from({ length: 19 }, (_, i) => 10 + i * 5),
    expIndex: 0, // 对应初始值 10
    rewardExp: 10
  },

  onLoad() {
    this.loadTasks();
  },

  onShow() {
    this.loadTasks();
  },

  // 监听选择器改变：实时切换显示的属性名称
  onAttrChange(e) {
    const index = e.detail.value;
    const selectedAttr = this.data.attrOptions[index];
    this.setData({
      attrIndex: index,
      rewardAttr: selectedAttr
    });
  },
// 3. 新增：监听经验选择切换
  onExpChange(e) {
    const index = e.detail.value;
    this.setData({
      expIndex: index,
      rewardExp: this.data.expOptions[index]
    });
  },
  // 实时清洗空白符 + 字数拦截
  onInputSanitize(e) {
    let value = e.detail.value;
    const cleanValue = value.replace(/\s+/g, '');
    const length = cleanValue.length;
    
    if (length > 15) {
      if (this.data.lastToastTime !== 'limit') {
        wx.showToast({ title: '字数已达上限', icon: 'none', duration: 1000 });
        this.setData({ lastToastTime: 'limit' });
      }
      const finalValue = cleanValue.substring(0, 15);
      this.setData({ title: finalValue, titleCount: 15 });
      return finalValue; 
    } else {
      this.setData({ lastToastTime: '', title: cleanValue, titleCount: length });
    }
    return cleanValue;
  },

  loadTasks() {
    const tasks = storage.getTasks();
    tasks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    tasks.forEach(task => {
      task.progressColor = this.getProgressColor(task.progress || 0);
    });
    this.setData({ tasks });
  },

  onAddTask(e) {
    // 从表单获取 title 和 exp，从 data 获取当前选中的 rewardAttr
    let { title, description, rewardExp } = e.detail.value;
    const currentAttr = this.data.rewardAttr; 
    
    const cleanTitle = (title || '').replace(/\s+/g, '').substring(0, 15);
    const cleanDescription = (description || '').trim();

    if (!cleanTitle) {
      wx.showToast({ title: '请输入有效任务名', icon: 'none' });
      return;
    }

    const rewardExpNum = parseInt(rewardExp, 10) || 0;
    
    storage.addTask({ 
      title: cleanTitle, 
      rewardAttr: currentAttr, // 使用当前选择器选中的属性
      rewardExp: rewardExpNum,
      description: cleanDescription
    });

    wx.showToast({ title: '任务已添加', icon: 'success' });
    
    // 重置表单状态
    this.setData({
      title: '',
      titleCount: 0
    });
    
    this.loadTasks();
  },

  // 导入和完成任务逻辑保持不变...
  async onConfirmImport() {
    this.setData({ importing: true });
    try {
      const messages = wx.getStorageSync('mp_chat_history_v1') || [];
      if (messages.length === 0) {
        wx.showToast({ title: '暂无聊天记录', icon: 'none' });
        this.setData({ showImportModal: false, importing: false });
        return;
      }
      const apiMessages = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text
      }));
      const extractedTasks = await taskAPI.extractTasksFromChat(apiMessages);
      if (extractedTasks.length === 0) {
        wx.showToast({ title: '未找到可导入的任务', icon: 'none' });
        this.setData({ showImportModal: false, importing: false });
        return;
      }
      const imported = storage.importTasksFromAI(extractedTasks);
      wx.showToast({ title: `成功导入${imported.length}个任务`, icon: 'success' });
      this.loadTasks();
      this.setData({ showImportModal: false, importing: false });
    } catch (err) {
      console.error('导入失败:', err);
      wx.showToast({ title: '导入失败', icon: 'none' });
      this.setData({ importing: false });
    }
  },

  onImportFromChat() { this.setData({ showImportModal: true }); },
  onCancelImport() { this.setData({ showImportModal: false }); },

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
  }
});