import express from 'express';
import fs from "fs"; //"node:fs/promises";
import path from 'path';
import axios from 'axios';
import logger from '../utils/logger';
import db from '../db/index';
import { eq } from 'drizzle-orm';
import { videos } from '../db/schema';
import crypto from 'crypto';
import getKeyframes from '../lib/getKeyframes';
import parseSubtitles from '../lib/parseSubtitles';
import cosUpload from "../lib/uploadFile"
import processVideoToAudio from '../lib/processVideoToAudio';
import { useTecentAsr } from "../lib/asr";

const downloadVideo = async(url, filePath, callback) => {
  const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
  });

  const writer = fs.createWriteStream(filePath);
  response.data.pipe(writer);

  writer.on('finish', () => {
    console.log('Download completed successfully.');
    callback && callback();
  });

  writer.on('error', (err) => {
    console.error('Error downloading file:', err.message);
  });
}

const router = express.Router();
const downloadsPath = '/tmp/downloads';
router.post('/', async (req, res) => {
  try {
    let { url } = req.body;
    const dyres = await fetch(`http://45.55.255.120/api/hybrid/video_data?url=${url}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    const dyData = await dyres.json();
    // console.log(dyData)
    if(dyData?.code !== 200) {
      return res.status(404).json({ message: '提取不到视频信息' });
    }
    const metadata = dyData.data;
    if(metadata.duration > 300000) {
      return res.status(400).json({ message: '视频长度不能超过5分钟哦' });
    }
    const videoExists = await db.query.videos.findFirst({
      where: eq(videos.videoId, metadata.aweme_id),
    });
    let id = '';
    // 如果提取过直接返回id
    if (videoExists) {
      id = videoExists.id;
      return res.status(200).json({ id: videoExists.id });
    } else {
      id = crypto.randomBytes(7).toString('hex');
      const videoPath = path.join(downloadsPath, metadata.aweme_id+'');
      fs.mkdirSync(videoPath, { recursive: true });
      const downloadList = metadata.video?.download_addr?.url_list;
      if(downloadList?.length>0) {
        await downloadVideo(downloadList[0], `${videoPath}/video.mp4`, async() => {
          const videoLocation = await cosUpload(`${videoPath}/video.mp4`, `videos/${id}.mp4`);

          const keyframes:any = await getKeyframes({
            filePath: `${downloadsPath}/${metadata.aweme_id}`,
            staticPath: `${req.headers.host}/static/downloads/${metadata.aweme_id}/frames`
          })
          if(keyframes?.frames) {
            await db.update(videos)
              .set({
                url: videoLocation,
                scene: JSON.stringify(keyframes),
              })
              .where(eq(videos.id, id))
              .execute();
          }
        });
      } 

      console.log('插入数据库', id)
      await db
        .insert(videos)
        .values({
          id,
          url: `${req.headers.host}/static/downloads/${metadata.aweme_id}/video.mp4`,
          videoId: metadata.aweme_id,
          title: metadata.item_title,
          extractor: 'douyin',
          metadata: JSON.stringify({
            fulltitle: metadata.desc,
            original_url: url,
            tags: metadata.caption,
            view_count: metadata.statistics?.collect_count,
            like_count: metadata.statistics?.digg_count,
            comment_count: metadata.statistics?.comment_count,
            channel: metadata.author?.nickname,
            channel_follower_count: metadata.author?.follower_count,
            uploader: metadata.author?.nickname,
            uploader_id: metadata.author_user_id,
            uploader_url: `https://www.douyin.com/user/${metadata.author.sec_uid}`,
            upload_date: metadata.create_time?.toString(),
            fps: 30,
            ext: metadata.video?.format,
            duration: metadata.duration ? Math.round(metadata.duration/1000) : 0,
          }),
          createdAt: new Date().toString()
        })
        .execute();

      res.status(200).json({
        id,
      });
    }

    const subtitlesData = await parseSubtitles(`${downloadsPath}/${metadata.aweme_id}/subs`);

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

  } catch (err) {
    res.status(500).json({ message: err.message });
    logger.error(`Error in processing: ${err.message}`);
  }
});

export default router;
