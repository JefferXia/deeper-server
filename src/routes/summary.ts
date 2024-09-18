import express from 'express';
import generateSummary from '../agents/summaryAssistant';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { getAvailableChatModelProviders } from '../lib/providers';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import db from '../db/index';
import { eq } from 'drizzle-orm';
import { videos } from '../db/schema';
import logger from '../utils/logger';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    let { id, query, chat_history, chat_model, chat_model_provider } = req.body;

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

    const summary = await generateSummary({ query, chat_history }, llm);

    await db.update(videos)
      .set({
        summary: summary,
      })
      .where(eq(videos.id, id))
      .execute();

    res.status(200).json({ summary: summary });
  } catch (err) {
    res.status(500).json({ message: 'An error has occurred.' });
    logger.error(`Error in generating summary: ${err.message}`);
  }
});

export default router;
