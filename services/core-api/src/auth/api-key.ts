import { createHash } from 'crypto';

// แยกไว้ไฟล์เล็กๆ ไม่ผูกกับ DB/Redis: ใช้ทั้งใน middleware, keys.routes และทดสอบหน่วย
export const API_KEY_PREFIX = 'surl_';
export const hashApiKey = (key: string) => createHash('sha256').update(key).digest('hex');
