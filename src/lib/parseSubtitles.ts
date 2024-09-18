import fs from "fs";
import path from "path";

export interface Subtitle {
  text: string
  startMs: number
  endMs: number
  speechSpeed?: number
  wordsNum?: number
  startTime: string
  endTime: string
}
export default async function parseSubtitles(filePath: string) {
  const timeToMilliseconds = (timeString: string) => {
    // 提取小时、分钟、秒和毫秒
    const [h, m, s] = timeString.split(':');
    const [seconds, milliseconds] = s.split('.');

    // 转换为整数
    const hours = parseInt(h, 10);
    const minutes = parseInt(m, 10);
    const secs = parseInt(seconds, 10);
    const millisecs = parseInt(milliseconds, 10);

    // 计算总毫秒数
    const totalMilliseconds =
      hours * 3600000 + minutes * 60000 + secs * 1000 + millisecs;

    return totalMilliseconds;
  };

  const msToTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  // 读取 .vtt 文件的函数
  const readVTTFile = async() => {
    return new Promise((resolve, reject) => {
      fs.readdir(filePath, (err, files) => {
        if (err) {
            // console.error('读取subs文件夹时发生错误:', err);
            return reject(err);
        }
    
        // 过滤出以subtitle开头并以.vtt结尾的文件
        const vttFiles = files.filter(file => file.startsWith('subtitle.'));
        // 只处理第一个找到的.vtt文件
        const subtitleFile = path.join(filePath, vttFiles[0]);
        fs.readFile(subtitleFile, 'utf8', (error, data) => {
          if (error) {
            return reject(error);
          }
          resolve(data);
        });
      });
    });
  };

  // 解析 .vtt 文件内容
  const parseVTTContent = (content: any) => {
    const lines = content.split('\n');
    const result = [];
    const cues:Subtitle[] = [];
    let cue:any = {};

    lines.forEach((line: string) => {
      line = line.trim();
      if (line.startsWith('WEBVTT')) {
        return; // 跳过文件头
      }
      if (!line) {
        // 空行表示一个 cue 的结束
        if (cue.startMs && cue.endMs) {
          cues.push(cue);
          cue = {}; // 重置 cue
        }
        return;
      }
      if (!cue.startMs && !cue.endMs) {
        // 解析时间戳
        const timeMatch = line.match(
          /(\d{2}:\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3})/,
        );
        if (timeMatch) {
          cue.startMs = timeToMilliseconds(timeMatch[1]);
          cue.endMs = timeToMilliseconds(timeMatch[2]);
          cue.startTime = msToTime(cue.startMs);
          cue.endTime = msToTime(cue.endMs);
        }
      } else {
        // 解析字幕文本
        cue.text = (cue.text || '') + line;
        result.push(line)
      }
    });

    return {
      result: result.join(' '),
      resultDetail: cues
    }
  };

  try {
    const content = await readVTTFile();
    const subs = parseVTTContent(content);
    console.log(subs);
    return subs;
  } catch (error) {
    console.error('读取subs文件夹时发生错误:', error);
  }
}
