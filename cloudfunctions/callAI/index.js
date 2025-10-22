// 云函数入口文件
const cloud = require('wx-server-sdk')
const axios = require('axios')

cloud.init()

// DeepSeek API 配置
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions'; // 替换为实际 endpoint
const DEEPSEEK_API_KEY = 'sk-36279fe5cc5a454ba2640af24dc8ab62'; // 请替换为你的 key

exports.main = async (event, context) => {
  const { messages } = event;
  try {
    const response = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: 'deepseek-chat', // 或 deepseek-coder
        messages: messages,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return {
      code: 0,
      data: response.data
    };
  } catch (err) {
    console.error('DeepSeek API调用失败:', {
      error: err.message,
      response: err.response && err.response.data,
      stack: err.stack
    });
    return {
      code: 1,
      msg: err.message || '请求失败',
      detail: err.response && err.response.data
    };
  }
};
