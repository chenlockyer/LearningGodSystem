const ai = require('../../utils/ai.js');
const storage = require('../../utils/storage.js');

Page({
  data: {
    messages: [],
    input: ''
  },

  onLoad() {
    // 读取历史对话（本地保留最近 50 条）
    const history = wx.getStorageSync('mp_chat_history_v1') || [];
    this.setData({ messages: history });
  },

  saveHistory() {
    const history = this.data.messages.slice(-50);
    wx.setStorageSync('mp_chat_history_v1', history);
  },

  onInput(e) {
    this.setData({ input: e.detail.value });
  },

  async onSend() {
    const text = (this.data.input || '').trim();
    if (!text) return;
    const userMsg = { role: 'user', text };
    const messages = this.data.messages.concat(userMsg);
    this.setData({ messages, input: '' });
    this.saveHistory();

    // 调用 DeepSeek 云函数
    try {
      const aiReply = await ai.callAI([
        ...messages.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }))
      ]);
      const aiMsg = { role: 'ai', text: aiReply };
      const newMsgs = this.data.messages.concat(aiMsg);
      this.setData({ messages: newMsgs });
      this.saveHistory();
      // 可在此处根据AI回复内容做奖励检测与发放（如需自动奖励可扩展）
    } catch (err) {
      console.error('AI请求失败:', err);
      wx.showToast({ 
        title: `请求失败: ${err.message || err}`, 
        icon: 'none',
        duration: 3000
      });
    }
  },

  onDailyReport() {
    // 简单生成静态战报
    const report = '每日战报：你今天完成了若干任务，表现优秀！自律+3';
    const aiMsg = { role: 'ai', text: report };
    const messages = this.data.messages.concat(aiMsg);
    this.setData({ messages });
    storage.addExp('自律能力', 3);
    wx.showToast({ title: '自律能力+3', icon: 'none' });
    this.saveHistory();
  },

  onViewStats() {
    wx.navigateTo({ url: '/pages/stats/stats' });
  },

  onPublishTask() {
    wx.navigateTo({ url: '/pages/tasks/tasks' });
  }
});
