import cosUpload from "./uploadFile"
const ffmpeg:any = require('fluent-ffmpeg');
import logger from '../utils/logger';

const processVideoToAudio = async ({ 
  filePath,
  fileName
}: { 
  filePath: string
  fileName: string
}) => {
  return new Promise((resolve, reject) => {
    ffmpeg(`${filePath}/video.mp4`)
    .inputOptions('-vn')
    .output(`${filePath}/audio.wav`)
    .on("end", async () => {
        console.log("ffmpeg Processing finished!");
        const videoLocation = await cosUpload(`${filePath}/video.mp4`, `video/${fileName}.mp4`);
        const audioLocation = await cosUpload(`${filePath}/audio.wav`, `audio/${fileName}.wav`);
        if (videoLocation && audioLocation) {
          resolve({ 
            videoLocation,
            audioLocation 
          });
        } else {
          reject({ message: 'cos上传失败' });
        }
    })
    .on("error", (err:any) => {
        console.error("Error:", err);
        reject({ message: 'cos上传出错' });
        logger.error(`Error in cosupload: ${err}`);
    })
    .run();
  })
}
export default processVideoToAudio