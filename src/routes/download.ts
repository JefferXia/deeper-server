import express from 'express';
import fs from "fs"; //"node:fs/promises";
import path from 'path';
import logger from '../utils/logger';
import db from '../db/index';
import { eq } from 'drizzle-orm';
import { videos } from '../db/schema';
import crypto from 'crypto';
import getKeyframes from '../lib/getKeyframes';
import parseSubtitles from '../lib/parseSubtitles';
import processVideoToAudio from '../lib/processVideoToAudio';
import { useTecentAsr } from "../lib/asr";
import YTDlpWrap from '../lib/ytdlp';
const ytDlpWrap = new YTDlpWrap();

const router = express.Router();
const downloadsPath = path.join(__dirname, '../public/downloads');
router.post('/', async (req, res) => {
  try {
    let { url } = req.body;

    let infoParams = [
      url,
      '-S',
      'ext',
      '--proxy=http://127.0.0.1:8118'
    ];
    let params = [
      url,
      '-f',
      'best',
      '-o',
      `${downloadsPath}/%(id)s/video.%(ext)s`,
      '-o',
      `subtitle:${downloadsPath}/%(id)s/subs/subtitle.%(ext)s`,
      '--write-subs',
      // '--sub-langs',
      // 'zh,en',
      '--proxy=http://127.0.0.1:8118'
    ];
    if(url.indexOf('bilibili.com') > -1) {
      params = [
        url,
        '-f',
        'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4] / bv*+ba/b',
        '-o',
        `${downloadsPath}/%(id)s/video.%(ext)s`
      ];
    }

    const metadata = await ytDlpWrap.getVideoInfo(infoParams);
    if(!metadata) {
      return res.status(404).json({ message: '提取不到视频信息' });
    }
    const videoExists = await db.query.videos.findFirst({
      where: eq(videos.videoId, metadata.id),
    });
    let id = '';
    // 如果提取过直接返回id
    if (videoExists) {
      id = videoExists.id;
      // if (videoExists.subtitles) {
        return res.status(200).json({ id: videoExists.id });
      // } else {
      //   res.status(200).json({ id: videoExists.id });
      // }
    } else {
      await ytDlpWrap.execPromise(params);
      id = crypto.randomBytes(7).toString('hex');
      console.log('插入数据库', id)
      await db
        .insert(videos)
        .values({
          id,
          url: `${req.headers.host}/static/downloads/${metadata.id}/video.mp4`,
          videoId: metadata.id,
          title: metadata.title,
          extractor: metadata.extractor,
          metadata: JSON.stringify({
            fulltitle: metadata.fulltitle,
            description: metadata.description,
            original_url: metadata.original_url,
            tags: metadata.tags,
            categories: metadata.categories,
            view_count: metadata.view_count,
            like_count: metadata.like_count,
            comment_count: metadata.comment_count,
            channel: metadata.channel,
            channel_follower_count: metadata.channel_follower_count,
            uploader: metadata.uploader,
            uploader_id: metadata.uploader_id,
            uploader_url: metadata.uploader_url,
            upload_date: metadata.upload_date,
            filesize: metadata.filesize,
            fps: metadata.fps,
            ext: metadata.ext,
            duration: metadata.duration,
            aspect_ratio: metadata.aspect_ratio,
          }),
          createdAt: new Date().toString()
        })
        .execute();

      res.status(200).json({
        id,
      });
    }

    const keyframes:any = await getKeyframes({
      filePath: `${downloadsPath}/${metadata.id}`,
      staticPath: `${req.headers.host}/static/downloads/${metadata.id}/frames`
    })
    if(keyframes?.frames) {
      await db.update(videos)
        .set({
          scene: JSON.stringify(keyframes),
        })
        .where(eq(videos.id, id))
        .execute();
    }

    const subtitlesData = await parseSubtitles(`${downloadsPath}/${metadata.id}/subs`);

    if(subtitlesData) {
      await db.update(videos)
        .set({
          subtitles: JSON.stringify(subtitlesData),
        })
        .where(eq(videos.id, id))
        .execute();
    }

    // fs.rm(`${downloadsPath}/${metadata.id}`, { recursive: true, force: true }, (err) => {
    //   if (err) {
    //     console.error('Error removing directory:', err);
    //   } else {
    //     console.log('Directory removed successfully!');
    //   }
    // });

    // const result:any = await processVideoToAudio({
    //   filePath: `${downloadsPath}/${metadata.id}`,
    //   fileName: metadata.id
    // })

    // if(result?.audioLocation) {
    //   const audioInfo = await useTecentAsr(`https://${result.audioLocation}`);
      
    //   // if (audioInfo) {
    //     await db.update(videos)
    //       .set({
    //         url: result.videoLocation,
    //         audioUrl: result.audioLocation,
    //         subtitles: JSON.stringify(audioInfo),
    //       })
    //       .where(eq(videos.id, id))
    //       .execute();
          
    //   // }
    // }
  } catch (err) {
    res.status(500).json({ message: err.message });
    logger.error(`Error in generating summary: ${err.message}`);
  }
});

export default router;
