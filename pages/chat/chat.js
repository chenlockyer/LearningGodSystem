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
    let history = wx.getStorageSync('mp_chat_history_v1') || [];

    // 核心修改：加载历史记录时重新计算显示格式
    history = history.map(msg => {
      if (msg.timestamp) {
        msg.time = this.formatTime(new Date(msg.timestamp));
      }
      return msg;
    });

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
    // 限制本地存储长度，防止缓存过大
    const history = this.data.messages.slice(-50);
    wx.setStorageSync('mp_chat_history_v1', history);
  },

  onInput(e) {
    const value = e.detail.value;
    this.setData({ input: value });
  },

  // 滚动到底部
  scrollToBottom() {
    this.setData({
      scrollIntoView: 'bottom-anchor'
    });
    // 强制刷新 scroll-into-view (有时需要先清空再设置才能再次触发)
    // 但通常只要 id 存在且位置改变即可，如果没动，可以尝试scrollTop辅助
    /*
    const query = wx.createSelectorQuery();
    query.select('.chat-container').boundingClientRect();
    query.exec((res) => {
      if (res[0]) {
        this.setData({
          scrollTop: res[0].height + 1000 // 加大数值确保到底
        });
      }
    });
    */
  },

  // 打字效果
  typeMessage(message, callback) {
    const text = message.text;
    const speed = 30; // 打字速度（毫秒）
    let index = 0;

    // 每次打字滚动计数器
    let scrollCounter = 0;

    const typeInterval = setInterval(() => {
      if (index < text.length) {
        const currentText = text.substring(0, index + 1);
        const messages = [...this.data.messages];
        const lastMessage = messages[messages.length - 1];
        lastMessage.text = currentText;

        // 优化性能：不要每次都 setData 整个数组，这里简化处理，但实际生产中最好只 setData 修改的项
        // 小程序中 setData 路径更新： 'messages[messages.length-1].text': currentText
        // 为了兼容现有逻辑，保持原样，但在长列表时需注意性能
        this.setData({ messages });

        index++;

        // 每输出 2 个字符或一定间隔滚动一次，避免过于频繁调用 setData
        scrollCounter++;
        if (scrollCounter % 2 === 0) {
          this.scrollToBottom();
        }

      } else {
        clearInterval(typeInterval);
        // 移除打字指示器
        const messages = [...this.data.messages];
        const lastMessage = messages[messages.length - 1];
        delete lastMessage.isTyping;
        this.setData({ messages });
        this.scrollToBottom(); // 结束后再次确保到底
        if (callback) callback();
      }
    }, speed);
  },

  // 智能格式化时间
  formatTime(date) {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const isSameDay = now.toDateString() === date.toDateString();

    // 基础时间 HH:mm
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hour}:${minute}`;

    if (isSameDay) {
      return timeStr;
    }

    // 判断是否在 7 天内（本周逻辑）
    const oneDay = 24 * 60 * 60 * 1000;
    const isSameYear = now.getFullYear() === date.getFullYear();

    if (diff < 7 * oneDay) {
      const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
      return `${weekdays[date.getDay()]} ${timeStr}`;
    }

    // 同年显示 M月D日
    const month = date.getMonth() + 1;
    const day = date.getDate();
    if (isSameYear) {
      return `${month}月${day}日 ${timeStr}`;
    }

    // 跨年显示 YYYY年M月D日
    return `${date.getFullYear()}年${month}月${day}日 ${timeStr}`;
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

    // 添加用户消息到本地显示列表
    const now = new Date();
    const userMsg = {
      role: 'user',
      text,
      timestamp: now.getTime(),
      time: this.formatTime(now)
    };
    const messages = this.data.messages.concat(userMsg);
    this.setData({
      messages,
      input: '',
      isLoading: true
    });
    this.saveHistory();
    this.scrollToBottom();

    try {
      // 添加AI回复占位符
      const nowAI = new Date();
      const aiMsg = {
        role: 'ai',
        text: '',
        isTyping: true,
        timestamp: nowAI.getTime(),
        time: this.formatTime(nowAI)
      };
      this.setData({ messages: this.data.messages.concat(aiMsg) });
      this.scrollToBottom();

      console.log('Current context aiPersonality:', this.data.aiPersonality);

      // --- 核心修改：优化上传逻辑，不仅防止超长，还避免旧人格（由 KEEP_FIRST 引起）的惯性干扰 ---
      const MAX_CONTEXT = 10; // 仅保留最近 10 条，确保新的人格设定权重最高

      let contextMessages = [];
      if (messages.length <= MAX_CONTEXT) {
        contextMessages = messages;
      } else {
        // 只取最近的消息，抛弃久远的对话历史（往往包含旧人格的强烈特征）
        contextMessages = messages.slice(-MAX_CONTEXT);
      }

      // 转换为 API 格式
      const apiMessages = contextMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text
      }));
      // --- 修改结束 ---

      // 获取用户属性和任务信息
      const userAttributes = storage.getAttributes();
      const userTasks = storage.getTasks();

      // 调用 AI 接口
      const aiResponse = await ai.callAI(apiMessages, 'deepseek', userAttributes, userTasks, this.data.aiPersonality);
      const aiReply = aiResponse.reply;
      const taskData = aiResponse.taskData;

      // 更新AI消息内容并开始打字效果
      const finalMessages = [...this.data.messages];
      const lastMessage = finalMessages[finalMessages.length - 1];
      lastMessage.text = aiReply;
      lastMessage.isTyping = true;

      this.setData({ messages: finalMessages });

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
      const errorMessages = [...this.data.messages];
      const lastMessage = errorMessages[errorMessages.length - 1];

      let errorText = '抱歉，AI暂时无法回复';
      if (err.message) {
        if (err.message.includes('超时')) {
          errorText = '请求超时，请稍后重试';
        } else if (err.message.includes('无法连接')) {
          errorText = '无法连接服务器，请检查后端状态';
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

      wx.showModal({
        title: 'AI请求失败',
        content: err.message || '网络错误',
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

  // 复制消息内容
  copyMessage(e) {
    const text = e.currentTarget.dataset.text;
    if (text) {
      wx.setClipboardData({
        data: text,
        success: () => {
          // wx.setClipboardData 会自动弹出 toast，这里不需要额外处理
          // 如果需要自定义 toast，可以先 hideToast 再 showToast
        }
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