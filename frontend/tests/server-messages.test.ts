import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { translateServerMessage } from '../lib/serverMessages';

describe('translateServerMessage (ข้อความ error จาก backend เป็นไทย → แปลตอนใช้โหมดอังกฤษ)', () => {
  it('โหมดไทยคืนข้อความเดิมทุกกรณี', () => {
    for (const m of ['อีเมลหรือรหัสผ่านไม่ถูกต้อง', 'ข้อความที่ไม่รู้จัก', '']) assert.equal(translateServerMessage(m, 'th'), m);
  });
  it('ข้อความที่รู้จักถูกแปลเป็นอังกฤษ (ไม่มีอักษรไทยเหลือ)', () => {
    for (const m of ['อีเมลหรือรหัสผ่านไม่ถูกต้อง', 'ไม่พบลิงก์', 'ชื่อลิงก์นี้ถูกใช้แล้ว กรุณาใช้ชื่ออื่น', 'โดเมนนี้ถูกบล็อก ไม่สามารถย่อลิงก์ได้', 'API key ไม่ถูกต้องหรือหมดอายุ', 'วันเริ่มใช้งานต้องมาก่อนวันหมดอายุ']) {
      const out = translateServerMessage(m, 'en');
      assert.ok(!/[\u0E00-\u0E7F]/.test(out) && out.length > 5, `${m} → ${out}`);
    }
  });
  it('ข้อความมีตัวเลข (รูปแบบ pattern) แปลพร้อมใส่ตัวเลขเดิม', () => {
    assert.match(translateServerMessage('วันหมดอายุต้องไม่เกิน 10 ปี', 'en'), /at most 10 years/);
    assert.match(translateServerMessage('วันเริ่มใช้งานต้องไม่เกิน 10 ปี', 'en'), /10 years/);
    assert.match(translateServerMessage('รหัสผ่านของลิงก์ต้องยาว 4–64 ตัวอักษร', 'en'), /4–64 characters/);
    assert.match(translateServerMessage('จำนวนคลิกสูงสุดต้องเป็นจำนวนเต็ม 1–1,000,000', 'en'), /1 to 1,000,000/);
    assert.match(translateServerMessage('ลิงก์ต้องไม่ว่างและยาวไม่เกิน 2048 ตัวอักษร', 'en'), /2048/);
    assert.match(translateServerMessage('สร้าง API key ได้สูงสุด 10 อัน ลบอันที่ไม่ใช้ก่อน', 'en'), /up to 10/);
  });
  it('ข้อความที่ไม่รู้จัก → แสดงของเดิม (ไม่ซ่อน error)', () => assert.equal(translateServerMessage('ข้อผิดพลาดใหม่ที่ยังไม่แปล', 'en'), 'ข้อผิดพลาดใหม่ที่ยังไม่แปล'));
});
