/**
 * ASR服务器测试脚本
 * 用于测试ASR服务器是否正常工作
 */

const WebSocket = require('ws');
const http = require('http');

// 测试HTTP服务器
console.log('测试HTTP服务器...');
http.get('http://localhost:34515', (res) => {
  console.log(`HTTP状态码: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('HTTP响应接收完成');
    console.log(`响应长度: ${data.length} 字节`);
    console.log('HTTP测试完成');
    
    // 测试WebSocket
    testWebSocket();
  });
}).on('error', (err) => {
  console.error('HTTP测试失败:', err.message);
});

// 测试WebSocket
function testWebSocket() {
  console.log('\n测试WebSocket...');
  const ws = new WebSocket('ws://localhost:34515');
  
  ws.on('open', () => {
    console.log('WebSocket连接已打开');
    
    // 发送身份识别消息
    ws.send(JSON.stringify({
      type: 'identify',
      role: 'electron'
    }));
    
    // 发送测试消息
    setTimeout(() => {
      console.log('发送测试消息...');
      ws.send(JSON.stringify({
        type: 'test',
        message: '这是一条测试消息'
      }));
    }, 1000);
    
    // 关闭连接
    setTimeout(() => {
      console.log('关闭WebSocket连接...');
      ws.close();
      console.log('测试完成');
    }, 2000);
  });
  
  ws.on('message', (data) => {
    console.log(`收到WebSocket消息: ${data}`);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket测试失败:', error.message);
  });
}
