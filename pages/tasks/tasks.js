const storage = require('../../utils/storage.js');

Page({
  data: {
    tasks: []
  },

  onLoad() {
    this.loadTasks();
  },

  onShow() {
    this.loadTasks();
  },

  loadTasks() {
    const tasks = storage.getTasks();
    this.setData({ tasks });
  },

  onAddTask(e) {
    const vals = e.detail.value;
    if (!vals.title) {
      wx.showToast({ title: '请输入任务名', icon: 'none' });
      return;
    }
    const rewardExp = parseInt(vals.rewardExp, 10) || 0;
    const task = storage.addTask({ title: vals.title, rewardAttr: vals.rewardAttr || '自律能力', rewardExp });
    wx.showToast({ title: '任务已添加', icon: 'none' });
    this.loadTasks();
  },

  onComplete(e) {
    const id = parseInt(e.currentTarget.dataset.id, 10);
    storage.completeTask(id);
    wx.showToast({ title: '任务完成，已领取奖励', icon: 'none' });
    this.loadTasks();
  }
});
