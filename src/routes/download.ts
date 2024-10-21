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
import cosUpload from "../lib/uploadFile"
import YTDlpWrap from '../lib/ytdlp';
const ytDlpWrap = new YTDlpWrap();

const router = express.Router();
const downloadsPath = path.join(__dirname, '../../public/downloads');
router.post('/', async (req, res) => {
  try {
    let { url, userId } = req.body;

    let infoParams = [
      url,
      '-S',
      'ext',
      // '--proxy=http://127.0.0.1:8118'
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
      // '--proxy=http://127.0.0.1:8118'
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
    if(metadata.duration > 300) {
      return res.status(400).json({ message: '视频长度不能超过5分钟哦' });
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
      const videoLocation = await cosUpload(`${downloadsPath}/${metadata.id}/video.mp4`, `videos/${id}.mp4`);
      await db
        .insert(videos)
        .values({
          id,
          url: videoLocation || `${req.headers.host}/static/downloads/${metadata.id}/video.mp4`,
          videoId: metadata.id,
          title: metadata.title,
          extractor: metadata.extractor,
          likeCount: metadata.like_count,
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
          userId,
          createdAt: Date.now()
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

    await db.update(videos)
      .set({
        subtitles: subtitlesData ? JSON.stringify(subtitlesData) : JSON.stringify({result: '',resultDetail: []}),
      })
      .where(eq(videos.id, id))
      .execute();

    fs.rm(`${downloadsPath}/${metadata.id}/video.mp4`, { recursive: true, force: true }, (err) => {
      if (err) {
        console.error('Error removing directory:', err);
      } else {
        console.log('Directory removed successfully!');
      }
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
    logger.error(`Error in generating summary: ${err.message}`);
  }
});

export default router;
