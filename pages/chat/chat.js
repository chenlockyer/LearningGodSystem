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

      // 获取用户属性和任务信息（用于Agent上下文）
      const userAttributes = storage.getAttributes();
      const userTasks = storage.getTasks();

      // 调用 AI 接口（传递上下文信息）
      const apiMessages = messages.map(m => ({ 
        role: m.role === 'user' ? 'user' : 'assistant', 
        content: m.text 
      }));
      
      const aiResponse = await ai.callAI(apiMessages, 'deepseek', userAttributes, userTasks);
      const aiReply = aiResponse.reply;
      const taskData = aiResponse.taskData;

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
        
        // 检查是否有任务需要导入
        if (taskData && taskData.hasTask && taskData.tasks && taskData.tasks.length > 0) {
          this.handleAutoImportTasks(taskData.tasks);
        }
      });

    } catch (err) {
      console.error('AI请求失败:', err);
      
      // 移除打字指示器，显示错误消息
      const errorMessages = [...this.data.messages];
      const lastMessage = errorMessages[errorMessages.length - 1];
      
      // 根据错误类型显示不同的错误信息
      let errorText = '抱歉，AI暂时无法回复';
      if (err.message) {
        if (err.message.includes('超时')) {
          errorText = '请求超时，AI响应时间较长，请稍后重试';
        } else if (err.message.includes('无法连接')) {
          errorText = '无法连接到服务器，请检查后端服务是否启动';
        } else {
          errorText = `错误：${err.message}`;
        }
      }
      
      lastMessage.text = errorText;
      delete lastMessage.isTyping;
      
      this.setData({ 
        messages: errorMessages,
        isLoading: false
      });
      
      // 显示详细的错误提示
      const errorMsg = err.message || '网络错误';
      wx.showModal({
        title: 'AI请求失败',
        content: errorMsg + '\n\n请检查：\n1. 后端服务是否启动\n2. 网络连接是否正常\n3. 是否勾选了"不校验合法域名"',
        showCancel: false,
        confirmText: '知道了'
      });
    }
  },

  async onDailyReport() {
    const storage = require('../../utils/storage.js');
    const taskAPI = require('../../utils/task.js');
    
    wx.showLoading({ title: '生成战报中...', mask: true });
    
    try {
      // 获取所有未完成任务
      const allTasks = storage.getTasks();
      const activeTasks = allTasks.filter(t => !t.done);
      
      if (activeTasks.length === 0) {
        wx.hideLoading();
        wx.showToast({ title: '暂无进行中的任务', icon: 'none' });
        return;
      }
      
      // 生成每日战报（可以基于聊天记录或让用户输入）
      const dailyReport = await this.generateDailyReport();
      
      // 调用API更新任务进度
      const progressUpdates = await taskAPI.updateTaskProgressByReport(
        dailyReport,
        activeTasks
      );
      
      // 更新本地任务进度
      if (progressUpdates && progressUpdates.length > 0) {
        const updates = progressUpdates.map(update => ({
          id: update.id,
          progress: update.progress
        }));
        storage.updateTasksProgress(updates);
        
        // 检查是否有任务完成
        const completedTasks = updates.filter(u => u.progress >= 100);
        if (completedTasks.length > 0) {
          completedTasks.forEach(update => {
            storage.completeTask(update.id);
          });
        }
      }
      
      // 生成战报消息
      let reportText = `📊 每日战报\n\n`;
      reportText += `${dailyReport}\n\n`;
      
      if (progressUpdates && progressUpdates.length > 0) {
        reportText += `📈 任务进度更新：\n`;
        progressUpdates.forEach(update => {
          const task = activeTasks.find(t => t.id === update.id);
          if (task) {
            reportText += `• ${task.title}: ${update.progress}%\n`;
          }
        });
      }
      
      const aiMsg = { role: 'ai', text: reportText };
      const messages = this.data.messages.concat(aiMsg);
      this.setData({ messages });
      
      // 给予战报奖励
      storage.addExp('自律能力', 5);
      
      wx.hideLoading();
      wx.showToast({ 
        title: '战报已生成，任务进度已更新', 
        icon: 'success',
        duration: 2000
      });
      
      this.saveHistory();
      
    } catch (err) {
      console.error('生成战报失败:', err);
      wx.hideLoading();
      wx.showToast({ 
        title: `生成战报失败: ${err.message}`, 
        icon: 'none',
        duration: 3000
      });
    }
  },

  // 生成每日战报内容
  async generateDailyReport() {
    // 可以基于聊天记录生成，或让用户输入
    // 这里简化处理，基于最近的聊天记录
    const recentMessages = this.data.messages.slice(-10);
    if (recentMessages.length === 0) {
      return '今天还没有记录，请继续努力！';
    }
    
    // 提取用户消息作为战报内容
    const userMessages = recentMessages
      .filter(m => m.role === 'user')
      .map(m => m.text)
      .join('\n');
    
    return userMessages || '今天还没有记录，请继续努力！';
  },

  // 自动导入AI生成的任务
  handleAutoImportTasks(tasks) {
    if (!tasks || tasks.length === 0) return;

    try {
      const imported = storage.importTasksFromAI(tasks);
      
      if (imported.length > 0) {
        // 显示任务导入提示
        wx.showModal({
          title: '🎯 任务已创建',
          content: `AI为你创建了${imported.length}个任务，是否前往任务页面查看？`,
          confirmText: '去查看',
          cancelText: '稍后',
          success: (res) => {
            if (res.confirm) {
              wx.switchTab({ url: '/pages/tasks/tasks' });
            }
          }
        });
      }
    } catch (err) {
      console.error('自动导入任务失败:', err);
    }
  },

  onViewStats() {
    wx.navigateTo({ url: '/pages/stats/stats' });
  },

  onPublishTask() {
    wx.navigateTo({ url: '/pages/tasks/tasks' });
  }
});
