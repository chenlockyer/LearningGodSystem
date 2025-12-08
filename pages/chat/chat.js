const ai = require('../../utils/ai.js');
const storage = require('../../utils/storage.js');

Page({
  data: {
    messages: [],
    input: '',
    isLoading: false,
    scrollTop: 0,
    scrollIntoView: '',
    showSettings: false,  // 显示个性设置弹窗
    aiPersonality: null,  // 当前AI个性
    presets: {},          // 预设角色
    customMode: false     // 是否为自定义模式
  },

  onLoad() {
    // 读取历史对话（本地保留最近 50 条）
    const history = wx.getStorageSync('mp_chat_history_v1') || [];
    this.setData({ messages: history });

    // 加载AI个性设置
    const aiPersonality = storage.getAIPersonality();
    const presets = storage.getAIPresets();
    this.setData({
      aiPersonality,
      presets
    });

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

      // 调用 AI 接口（传递上下文信息和个性设置）
      const apiMessages = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text
      }));

      const aiResponse = await ai.callAI(apiMessages, 'deepseek', userAttributes, userTasks, this.data.aiPersonality);
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



  // 打开个性设置弹窗
  openSettings() {
    this.setData({ showSettings: true });
  },

  // 关闭个性设置弹窗
  closeSettings() {
    this.setData({ showSettings: false, customMode: false });
  },

  // 选择预设角色
  selectPreset(e) {
    const presetKey = e.currentTarget.dataset.preset;
    const preset = this.data.presets[presetKey];

    if (preset) {
      storage.saveAIPersonality(preset);
      this.setData({
        aiPersonality: preset,
        showSettings: false,
        customMode: false
      });

      wx.showToast({
        title: `已切换到${preset.name}`,
        icon: 'success'
      });
    }
  },

  // 切换到自定义模式
  toggleCustomMode() {
    this.setData({ customMode: !this.data.customMode });
  },

  // 自定义设置输入
  onCustomNameInput(e) {
    const aiPersonality = { ...this.data.aiPersonality };
    aiPersonality.name = e.detail.value;
    this.setData({ aiPersonality });
  },

  onCustomPersonalityInput(e) {
    const aiPersonality = { ...this.data.aiPersonality };
    aiPersonality.personality = e.detail.value;
    this.setData({ aiPersonality });
  },

  onCustomStyleInput(e) {
    const aiPersonality = { ...this.data.aiPersonality };
    aiPersonality.style = e.detail.value;
    this.setData({ aiPersonality });
  },

  onCustomRoleInput(e) {
    const aiPersonality = { ...this.data.aiPersonality };
    aiPersonality.role = e.detail.value;
    this.setData({ aiPersonality });
  },

  // 保存自定义设置
  saveCustomSettings() {
    const { aiPersonality } = this.data;

    if (!aiPersonality.name || !aiPersonality.personality || !aiPersonality.style || !aiPersonality.role) {
      wx.showToast({
        title: '请填写完整信息',
        icon: 'none'
      });
      return;
    }

    storage.saveAIPersonality(aiPersonality);
    this.setData({
      showSettings: false,
      customMode: false
    });

    wx.showToast({
      title: '自定义设置已保存',
      icon: 'success'
    });
  }
});
