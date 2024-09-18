import fs from "fs";
import path from "path";
const ffmpeg:any = require('fluent-ffmpeg');
import logger from '../utils/logger';

const getKeyframes = async ({ 
  filePath,
  staticPath
}: { 
  filePath: string
  staticPath: string
}) => {
  return new Promise((resolve, reject) => {
    const framesPath = path.join(filePath, 'frames');
    fs.mkdirSync(framesPath, { recursive: true });
    ffmpeg(`${filePath}/video.mp4`)
      .outputOptions([
        '-vf', 'select=eq(pict_type\\,I)', // 选择关键帧
        '-vsync', 'vfr',
        '-frame_pts', 'true'
      ])
      .output(`${framesPath}/frame-%04d.png`)
      .on('end', () => {
        fs.readdir(framesPath, (err, files) => {
          if (err) {
            return reject(err); // 读取文件错误
          }
          const frames = [];
          const frameRate = 30; // 帧率
          // const pngFiles = files.filter(file => file.endsWith('.png') && file.startsWith('frame-'));  
          // 遍历文件
          files.forEach((file, index) => {
            // 提取帧数
            const frameNumber = parseInt(file.match(/frame-(\d+)\.png/)[1], 10);
            
            // 计算时间（秒）
            const startTime = Math.floor(frameNumber / frameRate);
            
            // 计算结束时间
            const endTime = index < files.length - 1 
              ? Math.floor(parseInt(files[index + 1].match(/frame-(\d+)\.png/)[1], 10) / frameRate)
              : startTime + 1;

            frames.push({
              startTime: startTime * 1000,
              endTime: endTime * 1000, 
              url: `${staticPath}/${file}`
            });
          });
    
          resolve({
            frames
          });
          console.log('关键帧提取完成');
        });
      })
      .on('error', (err) => {
        reject({ message: err.message });
        console.error('提取关键帧时发生错误: ', err.message);
        logger.error(`提取关键帧时发生错误: ${err.message}`);
      })
      .run();
  })
}

export default getKeyframes