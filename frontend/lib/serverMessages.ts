// backend ตอบข้อความ error เป็นภาษาไทย — ตอนใช้งานโหมดอังกฤษแปลฝั่งหน้าเว็บ (ไม่รู้จัก = แสดงข้อความเดิม)
const EXACT: Record<string, string> = {
  'ลิงก์ต้องไม่มีชื่อผู้ใช้/รหัสผ่านฝังอยู่': 'The URL must not contain a username or password.',
  'ลิงก์ไม่ถูกต้อง (ต้องขึ้นต้นด้วย http:// หรือ https://)': 'That URL isn\'t valid. It must start with http:// or https://.',
  'ลิงก์ไม่ถูกต้อง': 'That URL isn\'t valid.',
  'ชื่อลิงก์ต้องยาว 3–30 ตัว ใช้ได้เฉพาะ A–Z a–z 0–9 _ - และขึ้นต้น/ลงท้ายด้วยตัวอักษรหรือตัวเลข': 'The name must be 3–30 characters using only A–Z a–z 0–9 _ - and start and end with a letter or number.',
  'ชื่อลิงก์นี้ถูกใช้แล้ว กรุณาใช้ชื่ออื่น': 'That name is already taken. Please choose another.',
  'ชื่อลิงก์นี้เป็นคำสงวน กรุณาใช้ชื่ออื่น': 'That name is reserved. Please choose another.',
  'ชื่อลิงก์ไม่ถูกต้อง': 'That name isn\'t valid.',
  'days ต้องเป็นจำนวนเต็ม 1–365': 'Days must be a whole number from 1 to 365.',
  'format ต้องเป็น png หรือ svg': 'Format must be png or svg.',
  'scale ต้องเป็นจำนวนเต็ม 1–20': 'Scale must be a whole number from 1 to 20.',
  'กรุณากรอกลิงก์': 'Please enter a URL.',
  'กรุณากรอกอีเมลและรหัสผ่าน': 'Please enter your email and password.',
  'กรุณาเข้าสู่ระบบ': 'Please log in.',
  'คำขอถี่เกินไป กรุณาลองใหม่ภายหลัง': 'Too many requests. Please try again later.',
  'คำขอเข้าสู่ระบบหมดอายุ กรุณาลองใหม่': 'Your login request expired. Please try again.',
  'คำขอเข้าสู่ระบบไม่ถูกต้อง': 'The login request wasn\'t valid.',
  'คุณไม่มีสิทธิ์ใช้งานส่วนนี้': 'You don\'t have permission to use this.',
  'ตรวจพบการใช้เซสชันซ้ำ ระบบออกจากระบบทุกอุปกรณ์แล้ว กรุณาเข้าสู่ระบบใหม่': 'Reused session detected. You were logged out on every device — please log in again.',
  'ตรวจสอบข้อมูลจากผู้ให้บริการไม่ผ่าน': 'We couldn\'t verify the information from the sign-in provider.',
  'บัญชี Google นี้ยังไม่ได้ยืนยันอีเมล': 'This Google account\'s email isn\'t verified.',
  'บัญชีนี้ถูกระงับการใช้งาน': 'This account has been suspended.',
  'บัญชีนี้ผูกกับบัญชีผู้ให้บริการเดียวกันอีกบัญชีหนึ่งไว้แล้ว': 'This account is already linked to a different account from the same provider.',
  'รองรับเฉพาะลิงก์ http:// และ https://': 'Only http:// and https:// links are supported.',
  'ลองเข้าสู่ระบบบ่อยเกินไป กรุณาลองใหม่ภายหลัง': 'Too many login attempts. Please try again later.',
  'ลิงก์นี้ถูกปิดโดยผู้ดูแลระบบ ไม่สามารถเปิดเองได้': 'This link was turned off by an administrator and can\'t be turned back on by you.',
  'วันหมดอายุต้องเป็นเวลาในอนาคต': 'The expiry date must be in the future.',
  'วันหมดอายุไม่ถูกต้อง': 'The expiry date isn\'t valid.',
  'สถานะต้องเป็น ACTIVE หรือ DISABLED': 'Status must be ACTIVE or DISABLED.',
  'สร้างลิงก์ไม่สำเร็จ กรุณาลองใหม่': 'Couldn\'t create the link. Please try again.',
  'อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบด้วย Google': 'An account with this email already exists. Please log in with Google.',
  'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่': 'Couldn\'t log you in. Please try again.',
  'โดเมนนี้ถูกบล็อก ไม่สามารถย่อลิงก์ได้': 'This domain is blocked, so the link can\'t be shortened.',
  'ไม่พบลิงก์': 'Link not found.',
  'ไม่พบอีเมลในบัญชี Microsoft นี้': 'No email address was found on this Microsoft account.',
  'ไม่รองรับลิงก์ที่ชี้ไปยัง IP ภายในหรือ IP ที่สงวนไว้': 'URLs pointing to internal or reserved IP addresses aren\'t supported.',
  'ไม่รองรับลิงก์ที่ชี้ไปยังเครื่องหรือเครือข่ายภายใน': 'URLs pointing to internal hosts aren\'t supported.',
  'ไม่รองรับลิงก์ที่ใช้ที่อยู่ IPv6 โดยตรง': 'URLs using a raw IPv6 address aren\'t supported.',
  'ไม่รองรับการเข้าสู่ระบบด้วยบริการนี้': 'Logging in with this provider isn\'t supported.',
  'ไม่สามารถย่อลิงก์ที่ชี้กลับมายังระบบนี้ได้': 'Links that point back to this service can\'t be shortened.',
  'ไม่สามารถเปลี่ยนชื่อลิงก์หลังสร้างได้ (QR Code ที่แจกไปแล้วจะใช้ไม่ได้)': 'The name can\'t be changed after creation (shared QR codes would stop working).',
  'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่': 'Your session expired. Please log in again.',
  'อีเมลหรือรหัสผ่านไม่ถูกต้อง': 'Incorrect email or password.',
  'เกิดข้อผิดพลาดภายในระบบ': 'Something went wrong on our side.',
  'ไม่พบเส้นทางนี้': 'Not found.',
  'ไม่ได้รับอนุญาต': 'Not authorized.',
  'ยกเลิกการเข้าสู่ระบบ': 'Login cancelled.',
  'เกิดข้อผิดพลาด กรุณาลองใหม่': 'Something went wrong. Please try again.',
  'รูปแบบข้อมูลไม่ถูกต้อง': 'The request wasn\'t valid.',
  'ข้อมูลใหญ่เกินไป': 'The request is too large.',
  'ไม่สามารถแก้ไขบัญชีของตัวเองได้': 'You can\'t edit your own account.',
  'ไม่พบผู้ใช้': 'User not found.',
  'ค่าการระงับไม่ถูกต้อง': 'That suspension value isn\'t valid.',
  'บทบาทไม่ถูกต้อง': 'That role isn\'t valid.',
  'ไม่มีข้อมูลที่จะแก้ไข': 'There is nothing to change.',
  'คุณไม่มีสิทธิ์จัดการบัญชีนี้': 'You don\'t have permission to manage this account.',
  'เฉพาะผู้ดูแลระบบสูงสุดที่เปลี่ยนบทบาทได้': 'Only a full admin can change roles.',
  'สถานะต้องเป็น ADMIN_DISABLED หรือ ACTIVE': 'Status must be ADMIN_DISABLED or ACTIVE.',
  'ลิงก์นี้ไม่ได้ถูกปิดโดยผู้ดูแลระบบ': 'This link wasn\'t turned off by an administrator.',
  'โดเมนของลิงก์นี้ยังถูกบล็อกอยู่ ต้องปลดบล็อกโดเมนก่อน': 'This link\'s domain is still blocked. Unblock the domain first.',
  'โดเมนไม่ถูกต้อง เช่น example.com': 'That domain isn\'t valid, e.g. example.com.',
  'กรุณากรอกโดเมน': 'Please enter a domain.',
  'โดเมนนี้ถูกบล็อกอยู่แล้ว': 'This domain is already blocked.',
  'ไม่พบโดเมน': 'Domain not found.',
};

const PATTERNS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [/^ลิงก์ต้องไม่ว่างและยาวไม่เกิน (\d+) ตัวอักษร$/, (m) => `The URL can't be empty and can be at most ${m[1]} characters.`],
  [/^วันหมดอายุต้องไม่เกิน (\d+) ปี$/, (m) => `The expiry date can be at most ${m[1]} years away.`],
];

export function translateServerMessage(message: string, lang: 'th' | 'en'): string {
  if (lang === 'th') return message;
  if (EXACT[message]) return EXACT[message];
  for (const [re, fn] of PATTERNS) {
    const m = message.match(re);
    if (m) return fn(m);
  }
  return message;
}
