const ai = require('../../utils/ai.js');
const storage = require('../../utils/storage.js');

Page({
  data: {
    messages: [],
    input: '',
    isLoading: false,
    scrollTop: 0,
    scrollIntoView: ''
  },

  onLoad() {
    // 读取历史对话（本地保留最近 50 条）
    const history = wx.getStorageSync('mp_chat_history_v1') || [];
    this.setData({ messages: history });
    // 延迟滚动到底部
    setTimeout(() => {
      this.scrollToBottom();
    }, 100);
    
    // 检查后端服务连接
    this.checkServiceConnection();
  },

  // 检查服务连接
  async checkServiceConnection() {
    try {
      const ai = require('../../utils/ai.js');
      const available = await ai.checkAIService();
      if (!available) {
        console.warn('AI服务不可用，请检查后端服务是否启动');
        // 可选：显示提示
        // wx.showToast({
        //   title: '请先启动后端服务',
        //   icon: 'none',
        //   duration: 2000
        // });
      }
    } catch (err) {
      console.error('服务检查失败:', err);
    }
  },

  onShow() {
    // 页面显示时滚动到底部
    setTimeout(() => {
      this.scrollToBottom();
    }, 100);
  },

  saveHistory() {
    const history = this.data.messages.slice(-50);
    wx.setStorageSync('mp_chat_history_v1', history);
  },

  onInput(e) {
    const value = e.detail.value;
    this.setData({ input: value });
  },

  // 滚动到底部
  scrollToBottom() {
    const query = wx.createSelectorQuery();
    query.select('.chat-container').boundingClientRect();
    query.exec((res) => {
      if (res[0]) {
        this.setData({
          scrollTop: res[0].height
        });
      }
    });
  },

  // 打字效果
  typeMessage(message, callback) {
    const text = message.text;
    const speed = 30; // 打字速度（毫秒）
    let index = 0;
    
    const typeInterval = setInterval(() => {
      if (index < text.length) {
        const currentText = text.substring(0, index + 1);
        const messages = [...this.data.messages];
        const lastMessage = messages[messages.length - 1];
        lastMessage.text = currentText;
        this.setData({ messages });
        index++;
      } else {
        clearInterval(typeInterval);
        // 移除打字指示器
        const messages = [...this.data.messages];
        const lastMessage = messages[messages.length - 1];
        delete lastMessage.isTyping;
        this.setData({ messages });
        if (callback) callback();
      }
    }, speed);
  },

  async onSend() {
    const text = (this.data.input || '').trim();
    if (!text) {
      wx.showToast({
        title: '请输入消息内容',
        icon: 'none',
        duration: 1500
      });
      return;
    }
    if (this.data.isLoading) return;

    // 添加用户消息
    const userMsg = { role: 'user', text };
    const messages = this.data.messages.concat(userMsg);
    this.setData({ 
      messages, 
      input: '',
      isLoading: true
    });
    this.saveHistory();
    this.scrollToBottom();

    try {
      // 添加AI消息占位符（带打字效果）
      const aiMsg = { 
        role: 'ai', 
        text: '', 
        isTyping: true 
      };
      const messagesWithAI = this.data.messages.concat(aiMsg);
      this.setData({ messages: messagesWithAI });
      this.scrollToBottom();

      // 调用 AI 接口
      const aiReply = await ai.callAI([
        ...messages.map(m => ({ 
          role: m.role === 'user' ? 'user' : 'assistant', 
          content: m.text 
        }))
      ]);

      // 更新AI消息内容并开始打字效果
      const finalMessages = [...this.data.messages];
      const lastMessage = finalMessages[finalMessages.length - 1];
      lastMessage.text = aiReply;
      lastMessage.isTyping = true;
      
      this.setData({ messages: finalMessages });
      
      // 开始打字效果
      this.typeMessage(lastMessage, () => {
        this.setData({ isLoading: false });
        this.saveHistory();
      });

    } catch (err) {
      console.error('AI请求失败:', err);
      
      // 移除打字指示器，显示错误消息
      const errorMessages = [...this.data.messages];
      const lastMessage = errorMessages[errorMessages.length - 1];
      lastMessage.text = `抱歉，AI暂时无法回复：${err.message || '网络错误'}`;
      delete lastMessage.isTyping;
      
      this.setData({ 
        messages: errorMessages,
        isLoading: false
      });
      
      wx.showToast({ 
        title: 'AI回复失败', 
        icon: 'none',
        duration: 2000
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
