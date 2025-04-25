// 浏览器预加载脚本
// 用于修改浏览器环境，绕过反爬虫检测

// 使用更真实的用户代理字符串
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 覆盖navigator.userAgent
Object.defineProperty(navigator, 'userAgent', {
  value: userAgent,
  writable: false
});

// 覆盖navigator.platform
Object.defineProperty(navigator, 'platform', {
  value: 'Win32',
  writable: false
});

// 覆盖navigator.plugins
Object.defineProperty(navigator, 'plugins', {
  value: [
    { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
    { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: 'Portable Document Format' },
    { name: 'Native Client', filename: 'internal-nacl-plugin', description: 'Native Client' }
  ],
  writable: false
});

// 覆盖navigator.languages
Object.defineProperty(navigator, 'languages', {
  value: ['zh-CN', 'zh', 'en-US', 'en'],
  writable: false
});

// 覆盖window.chrome
window.chrome = {
  runtime: {},
  loadTimes: function() {},
  csi: function() {},
  app: {}
};

// 添加WebGL支持检测
try {
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  if (origGetContext) {
    HTMLCanvasElement.prototype.getContext = function(type, attributes) {
      if (type === 'webgl' || type === 'experimental-webgl' || type === 'webgl2') {
        const gl = origGetContext.call(this, type, attributes);
        if (gl) {
          // 修改WebGL参数以模拟真实浏览器
          const getParameter = gl.getParameter.bind(gl);
          gl.getParameter = function(parameter) {
            // UNMASKED_VENDOR_WEBGL
            if (parameter === 37445) {
              return 'Google Inc. (NVIDIA)';
            }
            // UNMASKED_RENDERER_WEBGL
            if (parameter === 37446) {
              return 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1070 Direct3D11 vs_5_0 ps_5_0, D3D11)';
            }
            return getParameter(parameter);
          };
        }
        return gl;
      }
      return origGetContext.call(this, type, attributes);
    };
  }
} catch (e) {
  console.error('Failed to patch WebGL:', e);
}

// 添加音频上下文支持
try {
  if (typeof AudioContext !== 'undefined') {
    const origAudioContext = AudioContext;
    window.AudioContext = function() {
      const context = new origAudioContext();
      return context;
    };
  }
} catch (e) {
  console.error('Failed to patch AudioContext:', e);
}

// 添加电池API模拟
try {
  if (navigator.getBattery) {
    navigator.getBattery = function() {
      return Promise.resolve({
        charging: true,
        chargingTime: 0,
        dischargingTime: Infinity,
        level: 1.0,
        addEventListener: function() {},
        removeEventListener: function() {}
      });
    };
  }
} catch (e) {
  console.error('Failed to patch Battery API:', e);
}

// 检测Cloudflare验证码
window.addEventListener('DOMContentLoaded', () => {
  try {
    // 检测是否存在Cloudflare验证码或其他验证码
    const hasCloudflareCaptcha = document.querySelector('iframe[src*="cloudflare"]') !== null || 
                                document.querySelector('.cf-browser-verification') !== null ||
                                document.querySelector('.cf-im-under-attack') !== null ||
                                document.querySelector('#challenge-form') !== null ||
                                document.querySelector('#challenge-running') !== null ||
                                document.querySelector('#challenge-error-title') !== null ||
                                document.querySelector('.ray-id') !== null ||
                                document.querySelector('.hcaptcha-box') !== null ||
                                document.querySelector('iframe[src*="hcaptcha"]') !== null ||
                                document.querySelector('iframe[src*="recaptcha"]') !== null;
    
    // 如果存在验证码，添加一些辅助功能
    if (hasCloudflareCaptcha) {
      // 尝试自动点击"我是人类"复选框
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(checkbox => {
        if (checkbox.style.display !== 'none') {
          checkbox.click();
        }
      });
      
      // 添加一个提示，告诉用户需要手动完成验证
      const notificationDiv = document.createElement('div');
      notificationDiv.style.position = 'fixed';
      notificationDiv.style.top = '10px';
      notificationDiv.style.left = '50%';
      notificationDiv.style.transform = 'translateX(-50%)';
      notificationDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
      notificationDiv.style.color = 'white';
      notificationDiv.style.padding = '10px 20px';
      notificationDiv.style.borderRadius = '5px';
      notificationDiv.style.zIndex = '9999999';
      notificationDiv.style.fontFamily = 'Arial, sans-serif';
      notificationDiv.textContent = '请完成人机验证以继续访问网站';
      
      document.body.appendChild(notificationDiv);
      
      // 5秒后自动隐藏提示
      setTimeout(() => {
        notificationDiv.style.opacity = '0';
        notificationDiv.style.transition = 'opacity 1s';
        setTimeout(() => {
          notificationDiv.remove();
        }, 1000);
      }, 5000);
    }
  } catch (e) {
    console.error('Failed to check for captcha:', e);
  }
});

console.log('Browser preload script loaded successfully');
