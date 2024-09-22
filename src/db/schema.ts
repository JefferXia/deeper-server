import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core';

export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey(),
  content: text('content').notNull(),
  chatId: text('chatId').notNull(),
  messageId: text('messageId').notNull(),
  role: text('type', { enum: ['assistant', 'user'] }),
  metadata: text('metadata', {
    mode: 'json',
  }),
});

export const chats = sqliteTable('chats', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: text('createdAt').notNull(),
  focusMode: text('focusMode').notNull(),
});

export const videos = sqliteTable('videos', {
  id: text('id').primaryKey(),
  url: text('url').notNull(),
  audioUrl: text('audioUrl'),
  videoId: text('videoId'),
  chatId: text('chatId'),
  title: text('title'),
  extractor: text('extractor'),
  likeCount: integer('likeCount'),
  metadata: text('metadata', {
    mode: 'json',
  }),
  subtitles: text('subtitles', {
    mode: 'json',
  }),
  scene: text('scene', {
    mode: 'json',
  }),
  summary: text('summary'),
  createdAt: integer('createdAt').notNull(),
});