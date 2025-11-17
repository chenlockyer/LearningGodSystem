const storage = require('../../utils/storage.js');
const taskAPI = require('../../utils/task.js');

Page({
  data: {
    tasks: [],
    showImportModal: false,
    importing: false
  },

  onLoad() {
    this.loadTasks();
  },

  onShow() {
    this.loadTasks();
  },

  loadTasks() {
    const tasks = storage.getTasks();
    // 按创建时间倒序排列
    tasks.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    this.setData({ tasks });
  },

  onAddTask(e) {
    const vals = e.detail.value;
    if (!vals.title) {
      wx.showToast({ title: '请输入任务名', icon: 'none' });
      return;
    }
    const rewardExp = parseInt(vals.rewardExp, 10) || 0;
    const task = storage.addTask({ 
      title: vals.title, 
      rewardAttr: vals.rewardAttr || '自律能力', 
      rewardExp,
      description: vals.description || ''
    });
    wx.showToast({ title: '任务已添加', icon: 'success' });
    this.loadTasks();
  },

  // 从聊天记录导入任务
  async onImportFromChat() {
    this.setData({ showImportModal: true });
  },

  async onConfirmImport() {
    this.setData({ importing: true });
    
    try {
      // 获取聊天记录
      const messages = wx.getStorageSync('mp_chat_history_v1') || [];
      if (messages.length === 0) {
        wx.showToast({ title: '暂无聊天记录', icon: 'none' });
        this.setData({ showImportModal: false, importing: false });
        return;
      }

      // 转换为API格式
      const apiMessages = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text
      }));

      // 调用API提取任务
      const extractedTasks = await taskAPI.extractTasksFromChat(apiMessages);
      
      if (extractedTasks.length === 0) {
        wx.showToast({ title: '未找到可导入的任务', icon: 'none' });
        this.setData({ showImportModal: false, importing: false });
        return;
      }

      // 导入任务
      const imported = storage.importTasksFromAI(extractedTasks);
      
      wx.showToast({ 
        title: `成功导入${imported.length}个任务`, 
        icon: 'success',
        duration: 2000
      });
      
      this.loadTasks();
      this.setData({ showImportModal: false, importing: false });
      
    } catch (err) {
      console.error('导入任务失败:', err);
      wx.showToast({ 
        title: `导入失败: ${err.message}`, 
        icon: 'none',
        duration: 3000
      });
      this.setData({ importing: false });
    }
  },

  onCancelImport() {
    this.setData({ showImportModal: false });
  },

  // 完成任务
  onComplete(e) {
    const id = parseFloat(e.currentTarget.dataset.id);
    const result = storage.completeTask(id);
    
    if (result) {
      const ratingText = {
        'excellent': '优秀',
        'good': '良好',
        'normal': '普通',
        'poor': '较差'
      }[result.rating] || '普通';
      
      wx.showToast({ 
        title: `任务完成！评级：${ratingText}，获得${result.rewardExp}经验`, 
        icon: 'success',
        duration: 3000
      });
    } else {
      wx.showToast({ title: '任务已完成', icon: 'none' });
    }
    
    this.loadTasks();
  },

  // 获取进度条颜色
  getProgressColor(progress) {
    if (progress >= 90) return '#34C759'; // 绿色
    if (progress >= 70) return '#007AFF'; // 蓝色
    if (progress >= 50) return '#FF9500'; // 橙色
    return '#FF3B30'; // 红色
  },

  // 获取评级文本
  getRatingText(rating) {
    const map = {
      'excellent': '优秀',
      'good': '良好',
      'normal': '普通',
      'poor': '较差'
    };
    return map[rating] || '';
  },

  // 获取评级颜色
  getRatingColor(rating) {
    const map = {
      'excellent': '#34C759',
      'good': '#007AFF',
      'normal': '#FF9500',
      'poor': '#FF3B30'
    };
    return map[rating] || '#999';
  }
});
