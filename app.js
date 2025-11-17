// 全局应用逻辑（可扩展）
App({
  onLaunch() {
    console.log('应用启动');
    
    // 初始化默认属性（如果未存在）
    const storage = require('./utils/storage.js');
    storage.initDefaults();

    // 检查后端服务连接（可选）
    // const ai = require('./utils/ai.js');
    // ai.checkAIService().then(available => {
    //   if (!available) {
    //     console.warn('AI服务不可用，请检查后端服务是否启动');
    //   }
    // });
  },

  onShow() {
    console.log('应用显示');
  },

  onHide() {
    console.log('应用隐藏');
  },

  onError(error) {
    console.error('应用错误:', error);
  }
});
