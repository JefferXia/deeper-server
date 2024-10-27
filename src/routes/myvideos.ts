import express from 'express';
import db from '../db/index';
import { eq } from 'drizzle-orm';
import { videos } from '../db/schema';

const router = express.Router();

router.get('/:id', async (req, res) => {
  try {
    const videoList = await db.query.videos.findMany({
      where: eq(videos.userId, req.params.id),
      columns: {
        id: true,
        url: true,
        title: true,
        extractor: true,
        likeCount: true,
        metadata: true,
        createdAt: true
      },
      limit: 20
    });

    return res.status(200).json({ videos: videoList });
  } catch (err) {
    res.status(500).json({ message: 'An error has occurred.' });
  }
});

export default router;
