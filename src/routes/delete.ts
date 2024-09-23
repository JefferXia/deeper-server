import express from 'express';
import db from '../db/index';
import { eq } from 'drizzle-orm';
import { videos } from '../db/schema';

const router = express.Router();

router.get('/:id', async (req, res) => {
  try {
    const videoExists = await db.query.videos.findFirst({
      where: eq(videos.id, req.params.id),
    });

    if (!videoExists) {
      return res.status(404).json({ message: 'Video not found' });
    }

    await db.delete(videos).where(eq(videos.id, req.params.id)).execute();
    // await db
    //   .delete(comments)
    //   .where(eq(comments.videoId, req.params.id))
    //   .execute();

    return res.status(200).json({ message: 'Video deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
