/**
 * 后端API地址配置
 * 开发环境：http://localhost:3000
 * 生产环境：请替换为您的实际服务器地址
 */
const API_BASE_URL = 'http://localhost:3000';

/**
 * 调用本地后端API获取 AI 回复
 * @param {Array} messages 聊天消息数组 [{role: 'user', content: '你好'}]
 * @param {string} provider AI服务商 'deepseek' | 'openai'
 * @returns {Promise<string>} AI 回复内容
 */
function callAI(messages, provider = 'deepseek') {
  return new Promise((resolve, reject) => {
    // 验证消息格式
    if (!Array.isArray(messages) || messages.length === 0) {
      reject(new Error('消息格式错误'));
      return;
    }

    console.log('调用AI接口:', { messageCount: messages.length, provider, url: `${API_BASE_URL}/api/chat` });

    wx.request({
      url: `${API_BASE_URL}/api/chat`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json'
      },
      data: {
        messages: messages,
        provider: provider
      },
      timeout: 30000, // 30秒超时
      success: res => {
        console.log('AI接口调用成功:', res);
        
        if (res.statusCode === 200 && res.data && res.data.code === 0) {
          const aiResponse = res.data.data;
          
          // 兼容不同AI服务商的返回格式
          let reply = '';
          if (aiResponse.choices && aiResponse.choices[0] && aiResponse.choices[0].message) {
            reply = aiResponse.choices[0].message.content;
          } else if (aiResponse.content) {
            reply = aiResponse.content;
          } else if (typeof aiResponse === 'string') {
            reply = aiResponse;
          }
          
          if (reply && reply.trim()) {
            resolve(reply.trim());
          } else {
            reject(new Error('AI返回内容为空'));
          }
        } else {
          const errorMsg = res.data?.msg || 'AI服务调用失败';
          console.error('AI接口返回错误:', res.data);
          reject(new Error(errorMsg));
        }
      },
      fail: err => {
        console.error('AI接口调用失败:', err);
        
        // 根据错误类型提供更友好的错误信息
        let errorMessage = '网络连接失败';
        if (err.errMsg) {
          if (err.errMsg.includes('timeout')) {
            errorMessage = '请求超时，请重试';
          } else if (err.errMsg.includes('fail')) {
            if (err.errMsg.includes('connect')) {
              errorMessage = '无法连接到服务器，请检查后端服务是否启动';
            } else {
              errorMessage = '网络连接异常';
            }
          } else {
            errorMessage = err.errMsg;
          }
        }
        
        reject(new Error(errorMessage));
      }
    });
  });
}

/**
 * 检查AI服务是否可用
 * @returns {Promise<boolean>} 服务是否可用
 */
function checkAIService() {
  return new Promise((resolve) => {
    wx.request({
      url: `${API_BASE_URL}/health`,
      method: 'GET',
      timeout: 5000,
      success: res => {
        resolve(res.statusCode === 200 && res.data && res.data.status === 'ok');
      },
      fail: () => {
        resolve(false);
      }
    });
  });
}

module.exports = {
  callAI,
  checkAIService
};
