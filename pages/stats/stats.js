const storage = require('../../utils/storage.js');

Page({
  data: {
    attrsList: [],
    canvasSize: 300,
    selectedAttr: null,
    labelPositions: [] // 存储标签位置
  },

  onLoad() {
    this.getSystemInfo();
  },

  onShow() {
    this.loadAttrs();
    setTimeout(() => {
      this.drawRadar();
    }, 500);
  },

  getSystemInfo() {
    const systemInfo = wx.getSystemInfoSync();
    const screenWidth = systemInfo.screenWidth;
    const canvasSize = screenWidth * 0.8;
    this.setData({
      canvasSize: canvasSize
    });
  },

  loadAttrs() {
    const attrs = storage.getAttributes();
    const list = Object.keys(attrs).map(name => ({ 
      name, 
      level: attrs[name].level, 
      exp: attrs[name].exp, 
      progress: attrs[name].exp % 100 
    }));
    this.setData({ 
      attrsList: list,
      selectedAttr: null
    });
  },

  drawRadar() {
    const ctx = wx.createCanvasContext('radarCanvas', this);
    const { canvasSize, attrsList } = this.data;
    const center = canvasSize / 2;
    const radius = center * 0.7;
    
    const count = attrsList.length;
    const angleStep = (2 * Math.PI) / count;

    // 清空画布，设置白色背景
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    ctx.setFillStyle('#ffffff');
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // 绘制网格
    this.drawGrid(ctx, center, center, radius, count, angleStep);
    
    // 绘制数据区域（绿色填充）
    this.drawDataArea(ctx, center, center, radius, count, angleStep, attrsList);

    ctx.draw();

    // 计算标签位置
    this.calculateLabelPositions(center, center, radius, count, angleStep);
  },

  drawGrid(ctx, centerX, centerY, radius, count, angleStep) {
    ctx.setStrokeStyle('rgba(255, 152, 0, 0.2)');
    ctx.setLineWidth(1);
    
    // 绘制同心多边形
    for (let i = 1; i <= 5; i++) {
      const currentRadius = (radius * i) / 5;
      ctx.beginPath();
      
      for (let j = 0; j < count; j++) {
        const angle = j * angleStep - Math.PI / 2;
        const x = centerX + currentRadius * Math.cos(angle);
        const y = centerY + currentRadius * Math.sin(angle);
        
        if (j === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.closePath();
      ctx.stroke();
    }

    // 绘制辐射线
    ctx.setStrokeStyle('rgba(255, 152, 0, 0.3)');
    for (let i = 0; i < count; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  },

  drawDataArea(ctx, centerX, centerY, radius, count, angleStep, attrsList) {
    // 设置绿色半透明填充
    ctx.setFillStyle('rgba(76, 175, 80, 0.3)');
    ctx.setStrokeStyle('#4CAF50');
    ctx.setLineWidth(2);
    
    ctx.beginPath();
    
    for (let i = 0; i < count; i++) {
      const level = Math.min(attrsList[i].level, 10);
      const dataRadius = (radius * level) / 10;
      const angle = i * angleStep - Math.PI / 2;
      const x = centerX + dataRadius * Math.cos(angle);
      const y = centerY + dataRadius * Math.sin(angle);
      
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  },

  calculateLabelPositions(centerX, centerY, radius, count, angleStep) {
    const labelRadius = radius * 1.15; // 标签位置在雷达图外缘
    const labelPositions = [];

    for (let i = 0; i < count; i++) {
      const angle = i * angleStep - Math.PI / 2;
      const x = centerX + labelRadius * Math.cos(angle);
      const y = centerY + labelRadius * Math.sin(angle);
      
      labelPositions.push({
        x: x,
        y: y
      });
    }

    this.setData({ labelPositions });
  },

  // 点击标签事件
  onLabelTap(e) {
    const index = e.currentTarget.dataset.index;
    const selectedAttr = this.data.attrsList[index];
    
    this.setData({ selectedAttr });
    
    // 轻微震动反馈
    wx.vibrateShort({ type: 'light' });
  },

  // 关闭详情
  onCloseDetail() {
    this.setData({ selectedAttr: null });
  }
});