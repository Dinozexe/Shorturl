import Redis from 'ioredis';
import { config } from '../common/config';

export const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 3 });
