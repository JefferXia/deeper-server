import express from 'express';
import imagesRouter from './images';
import videosRouter from './videos';
import configRouter from './config';
import modelsRouter from './models';
import suggestionsRouter from './suggestions';
import chatsRouter from './chats';
import summaryRouter from './summary';
import downloadRouter from './download';
import uploadRouter from './upload';
import testRouter from './test';

const router = express.Router();

router.use('/images', imagesRouter);
router.use('/videos', videosRouter);
router.use('/config', configRouter);
router.use('/models', modelsRouter);
router.use('/suggestions', suggestionsRouter);
router.use('/chats', chatsRouter);
router.use('/summary', summaryRouter);
router.use('/ytdownload', downloadRouter);
router.use('/upload', uploadRouter);
router.use('/test', testRouter);

export default router;
