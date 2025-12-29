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
    // 延迟一点开始动画，避免页面切换卡顿
    setTimeout(() => {
      this.chartAnimation();
    }, 200);
  },

  // 动画函数：从中心向外生长
  chartAnimation() {
    const duration = 1000; // 动画时长 1秒
    const startTime = Date.now();

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      let progress = elapsed / duration;

      if (progress > 1) progress = 1;

      // 使用缓动函数 easeOutCubic: 1 - pow(1 - x, 3)让动画更自然
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      this.drawRadar(easeProgress);

      if (progress < 1) {
        // 小程序中没有 requestAnimationFrame，用 setTimeout 模拟帧率
        setTimeout(animate, 16);
      }
    };

    animate();
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

  // 增加 progress 参数，默认为1（完整显示）
  drawRadar(progress = 1) {
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

    // 绘制网格 (网格不参与动画，保持静止)
    this.drawGrid(ctx, center, center, radius, count, angleStep);

    // 绘制数据区域（随 progress 生长）
    this.drawDataArea(ctx, center, center, radius, count, angleStep, attrsList, progress);

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

  drawDataArea(ctx, centerX, centerY, radius, count, angleStep, attrsList, progress) {
    // 设置绿色半透明填充
    ctx.setFillStyle('rgba(76, 175, 80, 0.3)');
    ctx.setStrokeStyle('#4CAF50');
    ctx.setLineWidth(2);

    // 先计算每个属性的总经验值和最大值
    const totalExps = [];
    let maxTotalExp = 0;
    for (let i = 0; i < count; i++) {
      const level = attrsList[i].level || 1;
      const attrProgress = (attrsList[i].progress != null ? attrsList[i].progress : (attrsList[i].exp % 100)) || 0;
      const totalExp = (level - 1) * 100 + attrProgress;
      totalExps.push(totalExp);
      if (totalExp > maxTotalExp) {
        maxTotalExp = totalExp;
      }
    }

    ctx.beginPath();

    // 为了“留一点底”，给非零经验的点加一个最小半径占比
    const minRatio = 0.2; // 最小 20% 半径

    for (let i = 0; i < count; i++) {
      const totalExp = totalExps[i];
      let ratio = 0;
      if (maxTotalExp > 0) {
        const rawRatio = totalExp / maxTotalExp;
        if (rawRatio > 0) {
          ratio = minRatio + (1 - minRatio) * rawRatio;
        }
      }

      // --- 关键修改：乘以动画进度 ---
      // 这里的 progress 是 0~1，所以半径会从 0 慢慢变大到实际值
      const animatedRatio = ratio * progress;

      const dataRadius = radius * animatedRatio;
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