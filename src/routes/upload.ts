import express from 'express';
import fs from "fs";
import path from "path";
import formidable from 'formidable';
import logger from '../utils/logger';
import db from '../db/index';
import { eq } from 'drizzle-orm';
import { videos } from '../db/schema';
import crypto from 'crypto';
import getKeyframes from '../lib/getKeyframes';
import processVideoToAudio from '../lib/processVideoToAudio';
import { useTecentAsr } from "../lib/asr";
const router = express.Router();

const uploadsPath = path.join(__dirname, '../../public/uploads');
router.post('/', async (req, res) => {
  try { 
    const id = crypto.randomBytes(7).toString('hex');
    if (!fs.existsSync(`${uploadsPath}/${id}`)) {
      fs.mkdirSync(`${uploadsPath}/${id}`, { recursive: true });
    }

    const form = formidable({ 
      uploadDir: `${uploadsPath}/${id}`, // 指定上传目录
      keepExtensions: true,   // 保留文件扩展名
      maxFileSize: 50 * 1024 * 1024 // 设置最大文件大小为 50MB
    });

    form.parse(req, (err, fields, files) => {
      if (err) {
        if (err.code === 1009) {
          return res.status(400).json({ message: '文件大小不能超过50M' });
        }
        return res.status(401).json({ message: '文件上传失败' });
      }

      // 处理上传的文件
      const uploadedFile = files.file; 
      fs.renameSync(uploadedFile[0].filepath, `${uploadsPath}/${id}/video.mp4`);

      (async() => {
        await db
          .insert(videos)
          .values({
            id,
            url: `${req.headers.host}/static/uploads/${id}/video.mp4`,
            // videoId: metadata.id,
            // title: metadata.title,
            extractor: '自由创作',
            createdAt: Date.now()
          })
          .execute();
        
          console.log('插入数据库', id)

        res.status(200).json({
          id,
        });

        const keyframes:any = await getKeyframes({
          filePath: `${uploadsPath}/${id}`,
          staticPath: `${req.headers.host}/static/uploads/${id}/frames`
        })
        if(keyframes?.frames) {
          await db.update(videos)
            .set({
              scene: JSON.stringify(keyframes),
            })
            .where(eq(videos.id, id))
            .execute();
        }

        const result:any = await processVideoToAudio({
          filePath: `${uploadsPath}/${id}`,
          fileName: id
        })

        if(result?.audioLocation) {
          const audioInfo = await useTecentAsr(`https://${result.audioLocation}`);
          
          if (audioInfo) {
            await db.update(videos)
              .set({
                url: result.videoLocation,
                audioUrl: result.audioLocation,
                subtitles: JSON.stringify(audioInfo),
              })
              .where(eq(videos.id, id))
              .execute();
              
            fs.rm(`${uploadsPath}/${id}/video.mp4`, { recursive: true, force: true }, (err) => {});
            fs.rm(`${uploadsPath}/${id}/audio.wav`, { recursive: true, force: true }, (err) => {});
          }
        }
      })()
    })
  } catch (err) {
    res.status(500).json({ message: 'An error has occurred.' });
    logger.error(`Error in generating summary: ${err.message}`);
  }
});

export default router;
