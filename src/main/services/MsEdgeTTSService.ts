import { EdgeTTS } from 'node-edge-tts';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import log from 'electron-log';

/**
 * Microsoft Edge TTS服务
 * 使用Microsoft Edge的在线TTS服务，不需要API密钥
 */
class MsEdgeTTSService {
  private static instance: MsEdgeTTSService;
  private tts: EdgeTTS;
  private tempDir: string;

  private constructor() {
    this.tts = new EdgeTTS();
    this.tempDir = path.join(app.getPath('temp'), 'cherry-tts');
    
    // 确保临时目录存在
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): MsEdgeTTSService {
    if (!MsEdgeTTSService.instance) {
      MsEdgeTTSService.instance = new MsEdgeTTSService();
    }
    return MsEdgeTTSService.instance;
  }

  /**
   * 获取可用的语音列表
   * @returns 语音列表
   */
  public async getVoices(): Promise<any[]> {
    try {
      // 返回预定义的中文语音列表
      return [
        { name: 'zh-CN-XiaoxiaoNeural', locale: 'zh-CN', gender: 'Female' },
        { name: 'zh-CN-YunxiNeural', locale: 'zh-CN', gender: 'Male' },
        { name: 'zh-CN-YunyangNeural', locale: 'zh-CN', gender: 'Male' },
        { name: 'zh-CN-XiaohanNeural', locale: 'zh-CN', gender: 'Female' },
        { name: 'zh-CN-XiaomoNeural', locale: 'zh-CN', gender: 'Female' },
        { name: 'zh-CN-XiaoxuanNeural', locale: 'zh-CN', gender: 'Female' },
        { name: 'zh-CN-XiaoruiNeural', locale: 'zh-CN', gender: 'Female' },
        { name: 'zh-CN-YunfengNeural', locale: 'zh-CN', gender: 'Male' },
      ];
    } catch (error) {
      log.error('获取Microsoft Edge TTS语音列表失败:', error);
      throw error;
    }
  }

  /**
   * 合成语音
   * @param text 要合成的文本
   * @param voice 语音
   * @param outputFormat 输出格式
   * @returns 音频文件路径
   */
  public async synthesize(text: string, voice: string, outputFormat: string): Promise<string> {
    try {
      // 设置TTS参数
      await this.tts.setMetadata(voice, outputFormat);
      
      // 生成临时文件路径
      const timestamp = Date.now();
      const outputPath = path.join(this.tempDir, `tts_${timestamp}.mp3`);
      
      // 合成语音
      await this.tts.toFile(outputPath, text);
      
      return outputPath;
    } catch (error) {
      log.error('Microsoft Edge TTS语音合成失败:', error);
      throw error;
    }
  }
}

// 导出单例方法
export const getVoices = async () => {
  return await MsEdgeTTSService.getInstance().getVoices();
};

export const synthesize = async (text: string, voice: string, outputFormat: string) => {
  return await MsEdgeTTSService.getInstance().synthesize(text, voice, outputFormat);
};
