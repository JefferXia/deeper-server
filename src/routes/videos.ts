import express from 'express';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { getAvailableChatModelProviders } from '../lib/providers';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import logger from '../utils/logger';
import handleVideoSearch from '../agents/videoSearchAgent';
import db from '../db/index';
import { eq, or, desc, sql } from 'drizzle-orm';
import { videos } from '../db/schema';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    let { query, chat_history, chat_model_provider, chat_model } = req.body;

    chat_history = chat_history.map((msg: any) => {
      if (msg.role === 'user') {
        return new HumanMessage(msg.content);
      } else if (msg.role === 'assistant') {
        return new AIMessage(msg.content);
      }
    });

    const chatModels = await getAvailableChatModelProviders();
    const provider = chat_model_provider ?? Object.keys(chatModels)[0];
    const chatModel = chat_model ?? Object.keys(chatModels[provider])[0];

    let llm: BaseChatModel | undefined;

    if (chatModels[provider] && chatModels[provider][chatModel]) {
      llm = chatModels[provider][chatModel] as BaseChatModel | undefined;
    }

    if (!llm) {
      res.status(500).json({ message: 'Invalid LLM model selected' });
      return;
    }

    const videos = await handleVideoSearch({ chat_history, query }, llm);

    res.status(200).json({ videos });
  } catch (err) {
    res.status(500).json({ message: 'An error has occurred.' });
    logger.error(`Error in video search: ${err.message}`);
  }
});

router.get('/', async (_, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=59');
  try {
    let videoList:any = await db.query.videos.findMany({
      where: or(eq(videos.extractor, "TikTok"), eq(videos.extractor, "douyin")),
      columns: {
        id: true,
        url: true,
        title: true,
        extractor: true,
        likeCount: true,
        metadata: true,
        createdAt: true
      },
      // extras: {
      //   metaData: sql<Object>`jsonb(${videos.metadata}) as meta_data`,
      // },
      orderBy: [desc(videos.likeCount)],
      limit: 20
    });

    return res.status(200).json({ videos: videoList });
  } catch (err) {
    res.status(500).json({ message: 'An error has occurred.' });
    logger.error(`Error in getting videos: ${err.message}`);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const videoExists = await db.query.videos.findFirst({
      where: eq(videos.id, req.params.id),
    });

    if (!videoExists) {
      return res.status(404).json({ message: 'Video not found' });
    }

    return res.status(200).json({ video: videoExists });
  } catch (err) {
    res.status(500).json({ message: err.message });
    // logger.error(`Error in getting chat: ${err.message}`);
  }
});

export default router;
