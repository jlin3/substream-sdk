/**
 * Emoji Reactions via Redis Pub/Sub.
 *
 * Viewers POST a reaction; it's published to a Redis channel so all
 * connected SSE clients receive it in real-time. Falls back to a simple
 * in-memory EventEmitter when Redis is unavailable.
 */

import { EventEmitter } from 'events';
import { redis, isRedisAvailable } from '../redis';
import Redis from 'ioredis';

const ALLOWED_REACTIONS = ['❤️', '🔥', '👏', '😂', '😮', '🎮', '🏆', '👍'];

const localEmitter = new EventEmitter();
localEmitter.setMaxListeners(1000);

let subscriber: Redis | null = null;

async function getSubscriber(): Promise<Redis | null> {
  if (subscriber) return subscriber;
  if (!(await isRedisAvailable())) return null;

  subscriber = redis.duplicate();
  return subscriber;
}

export interface Reaction {
  streamId: string;
  viewerId: string;
  emoji: string;
  timestamp: number;
}

export function isValidReaction(emoji: string): boolean {
  return ALLOWED_REACTIONS.includes(emoji);
}

export function getAllowedReactions(): string[] {
  return [...ALLOWED_REACTIONS];
}

export async function publishReaction(reaction: Reaction): Promise<void> {
  const channel = `reactions:${reaction.streamId}`;
  const payload = JSON.stringify(reaction);

  if (await isRedisAvailable()) {
    await redis.publish(channel, payload);
  }

  // Always emit locally so SSE on this instance works
  localEmitter.emit(channel, reaction);
}

export type ReactionListener = (reaction: Reaction) => void;

/**
 * Subscribe to reactions for a stream. Returns an unsubscribe function.
 */
export async function subscribeReactions(
  streamId: string,
  listener: ReactionListener,
): Promise<() => void> {
  const channel = `reactions:${streamId}`;

  localEmitter.on(channel, listener);

  const sub = await getSubscriber();
  let redisHandler: ((ch: string, msg: string) => void) | null = null;

  if (sub) {
    redisHandler = (_ch: string, msg: string) => {
      try {
        const reaction = JSON.parse(msg) as Reaction;
        listener(reaction);
      } catch {}
    };
    await sub.subscribe(channel);
    sub.on('message', redisHandler);
  }

  return () => {
    localEmitter.off(channel, listener);
    if (sub && redisHandler) {
      sub.unsubscribe(channel).catch(() => {});
      sub.off('message', redisHandler);
    }
  };
}
