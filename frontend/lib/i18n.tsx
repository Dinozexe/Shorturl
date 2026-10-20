'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setApiLang } from './api';

export type Lang = 'th' | 'en';
const KEY = 'surl:lang';

const th = {
  // ทั่วไป
  'common.close': 'ปิด',
  'common.closeDialog': 'ปิดหน้าต่าง',
  'common.cancel': 'ยกเลิก',
  'common.retry': 'ลองใหม่',
  'common.copy': 'คัดลอก',
  'common.copied': 'คัดลอกลิงก์แล้ว',
  'common.copyFailed': 'คัดลอกไม่สำเร็จ',
  'common.copyFailedManual': 'คัดลอกไม่สำเร็จ ลองเลือกข้อความแล้วคัดลอกเอง',
  'common.loading': 'กำลังโหลด…',
  'app.title': 'Shorturl By Kittamet',
  'api.network': 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่',
  'api.generic': 'เกิดข้อผิดพลาด กรุณาลองใหม่',
  // header / ตัวควบคุม
  'nav.login': 'เข้าสู่ระบบ',
  'nav.logout': 'ออกจากระบบ',
  'lang.label': 'ภาษา',
  'theme.toLight': 'เปลี่ยนเป็นโหมดสว่าง',
  'theme.toDark': 'เปลี่ยนเป็นโหมดมืด',
  // หน้าแรก
  'home.h1a': 'วางลิงก์ยาว',
  'home.h1b': 'ได้ลิงก์สั้นทันที',
  'home.sub': 'ทำลิงก์ให้สั้น สร้าง QR Code และดูว่ามีคนเปิดกี่ครั้ง จากอุปกรณ์และเว็บไหน ได้ในที่เดียว',
  'home.perk1': 'สร้าง QR Code ให้ทันที',
  'home.perk2': 'ดูสถิติการเปิดลิงก์',
  'home.perk3': 'ตั้งวันหมดอายุหรือปิดลิงก์ได้',
  'home.fact1.title': 'ลิงก์สั้นพร้อม QR Code',
  'home.fact1.body': 'ตั้งชื่อลิงก์เอง หรือให้ระบบสุ่มให้ แล้วดาวน์โหลด QR Code เป็น PNG หรือ SVG',
  'home.fact2.title': 'รู้ว่าใครเปิดจากไหน',
  'home.fact2.body': 'ดูยอดเปิดรายวัน อุปกรณ์ ประเทศ และเว็บที่พามา โดยไม่เก็บ IP จริงของผู้เปิดลิงก์',
  'home.fact3.title': 'คุมลิงก์ได้ตลอด',
  'home.fact3.body': 'ตั้งวันหมดอายุ ปิดลิงก์ชั่วคราว หรือลบทิ้งได้ทุกเมื่อ',
  'hero.placeholder': 'วางลิงก์ที่นี่',
  'hero.label': 'ลิงก์ที่ต้องการทำให้สั้นลง',
  'hero.submit': 'ทำให้สั้นลง',
  'hero.aria': 'ทำให้ลิงก์สั้นลง',
  'hero.empty': 'วางลิงก์ที่ต้องการทำให้สั้นลงก่อน',
  'hero.noteAnon': 'เข้าสู่ระบบสักครั้ง ระบบจะทำให้ลิงก์ที่วางไว้สั้นลงทันที',
  'hero.noteAuthed': 'ระบบจะทำให้ลิงก์ของคุณสั้นลงทันที',
  'decor.long': 'ลิงก์ยาว',
  'decor.short': 'ลิงก์สั้น',
  'decor.qr': 'QR Code',
  'decor.opens7': 'การเปิดลิงก์ 7 วัน',
  'decor.from': 'เปิดจาก',
  'decor.mobile': 'มือถือ',
  'decor.desktop': 'คอมพิวเตอร์',
  // เข้าสู่ระบบ
  'login.h1a': 'เข้าสู่ระบบ',
  'login.h1b': 'เพื่อเริ่มใช้งาน',
  'login.sub': 'เลือกวิธีที่สะดวก ลิงก์สั้นทั้งหมดที่คุณสร้างจะอยู่ในบัญชีของคุณ',
  'login.pending': 'ลิงก์ที่รอทำให้สั้นลง',
  'login.with': 'เข้าสู่ระบบด้วย {name}',
  'login.or': 'หรือ',
  'login.withEmail': 'เข้าสู่ระบบด้วยอีเมล',
  'login.email': 'อีเมล',
  'login.password': 'รหัสผ่าน',
  'login.submit': 'เข้าสู่ระบบ',
  'login.submitting': 'กำลังเข้าสู่ระบบ…',
  'login.other': 'เลือกวิธีอื่น',
  'login.back': 'กลับหน้าแรก',
  'login.failed': 'เข้าสู่ระบบไม่สำเร็จ',
  // dashboard
  'dash.checking': 'กำลังตรวจสอบการเข้าสู่ระบบ…',
  'dash.newTitle': 'สร้างลิงก์สั้นใหม่',
  'dash.myLinks': 'ลิงก์ของฉัน',
  'dash.count': '{n} ลิงก์',
  'dash.countOne': '{n} ลิงก์',
  'dash.searchLabel': 'ค้นหาลิงก์',
  'dash.search': 'ค้นหาจากชื่อลิงก์หรือลิงก์ปลายทาง',
  'dash.loadingList': 'กำลังโหลดรายการ…',
  'dash.emptyTitle': 'ยังไม่มีลิงก์',
  'dash.emptyBody': 'วางลิงก์ในช่องด้านบนแล้วกด “ทำให้สั้นลง” เพื่อสร้างลิงก์แรกของคุณ',
  'dash.noMatch': 'ไม่พบลิงก์ที่ตรงกับ “{q}”',
  'dash.pagesNav': 'เปลี่ยนหน้า',
  'dash.prev': 'ก่อนหน้า',
  'dash.next': 'ถัดไป',
  'dash.page': 'หน้า {p} จาก {n}',
  'dash.enabled': 'เปิดลิงก์แล้ว',
  'dash.disabled': 'ปิดลิงก์แล้ว',
  'dash.statusFail': 'เปลี่ยนสถานะไม่สำเร็จ',
  'dash.deleted': 'ลบลิงก์แล้ว',
  'dash.saved': 'บันทึกแล้ว',
  'dash.loadFail': 'โหลดรายการไม่สำเร็จ',
  'dash.pendingFail': 'ทำให้ลิงก์สั้นลงไม่สำเร็จ',
  // ฟอร์มสร้าง
  'create.aria': 'สร้างลิงก์สั้นใหม่',
  'create.submitting': 'กำลังทำให้สั้นลง…',
  'create.more': 'ตั้งชื่อลิงก์เองหรือวันหมดอายุ',
  'create.alias': 'ชื่อลิงก์ (ไม่บังคับ)',
  'create.aliasPh': 'เช่น promo-2026',
  'create.aliasHelp': '3–30 ตัว ใช้ A–Z a–z 0–9 _ - และต้องขึ้นต้น/ลงท้ายด้วยตัวอักษรหรือตัวเลข เว้นว่างเพื่อให้ระบบสุ่มให้',
  'create.expires': 'หมดอายุเมื่อ (ไม่บังคับ)',
  'create.expiresHelp': 'เว้นว่างถ้าไม่ต้องการให้หมดอายุ',
  'create.failed': 'สร้างลิงก์ไม่สำเร็จ',
  // แถบผลลัพธ์
  'result.aria': 'ลิงก์ที่เพิ่งสร้าง',
  'result.title': 'ลิงก์สั้นของคุณพร้อมแล้ว',
  'result.hide': 'ซ่อน',
  'result.goes': 'ไปที่ {url}',
  'result.copy': 'คัดลอกลิงก์',
  'result.qr': 'ดู QR Code',
  // แถวลิงก์
  'status.active': 'ใช้งานอยู่',
  'status.disabled': 'ปิดอยู่',
  'status.adminDisabled': 'ผู้ดูแลปิด',
  'status.expired': 'หมดอายุ',
  'row.created': 'สร้างเมื่อ {d}',
  'row.expires': 'หมดอายุ {d}',
  'row.expiredOn': 'หมดอายุเมื่อ {d}',
  'row.opens': 'ครั้งที่เปิด',
  'row.qr': 'QR Code',
  'row.stats': 'สถิติ',
  'row.edit': 'แก้ไข',
  'row.turnOff': 'ปิดลิงก์',
  'row.turnOn': 'เปิดลิงก์',
  'row.delete': 'ลบ',
  'row.aria.copy': 'คัดลอกลิงก์ {code}',
  'row.aria.qr': 'QR Code ของ {code}',
  'row.aria.stats': 'สถิติของ {code}',
  'row.aria.edit': 'แก้ไข {code}',
  'row.aria.off': 'ปิดลิงก์ {code}',
  'row.aria.on': 'เปิดลิงก์ {code}',
  'row.aria.delete': 'ลบลิงก์ {code}',
  // QR
  'qr.title': 'QR Code',
  'qr.alt': 'QR Code ของลิงก์ {url}',
  'qr.creating': 'กำลังสร้าง…',
  'qr.loadFail': 'โหลด QR Code ไม่สำเร็จ',
  'qr.local': 'QR Code นี้ชี้ไปที่ localhost จึงสแกนจากมือถือไม่ได้ จะใช้งานได้จริงเมื่อระบบอยู่บนโดเมนจริง',
  'qr.sizeLegend': 'ขนาดไฟล์ PNG',
  'qr.small': 'เล็ก',
  'qr.medium': 'กลาง',
  'qr.large': 'ใหญ่',
  'qr.dlPng': 'ดาวน์โหลด PNG',
  'qr.dlSvg': 'ดาวน์โหลด SVG',
  'qr.dlFail': 'ดาวน์โหลดไม่สำเร็จ',
  // สถิติ
  'stats.title': 'สถิติการเปิดลิงก์',
  'stats.range': 'ช่วงเวลา',
  'stats.lastDays': '{n} วันล่าสุด',
  'stats.loading': 'กำลังโหลดสถิติ… (ครั้งแรกอาจใช้เวลาสักครู่)',
  'stats.loadFail': 'โหลดสถิติไม่สำเร็จ',
  'stats.unavailableTitle': 'ยังโหลดสถิติละเอียดไม่ได้',
  'stats.unavailableBody': 'ระบบสถิติอาจกำลังเริ่มทำงาน ยอดเปิดรวมของลิงก์นี้คือ {n} ครั้ง ลองใหม่อีกครั้งใน 1 นาที',
  'stats.total': 'เปิดทั้งหมด',
  'stats.inWindow': 'ใน {n} วันล่าสุด',
  'stats.unique': 'ผู้เปิดไม่ซ้ำ (โดยประมาณ)',
  'stats.referrers': 'เว็บที่พามา',
  'stats.countries': 'ประเทศ',
  'stats.devices': 'อุปกรณ์',
  'stats.os': 'ระบบปฏิบัติการ',
  'stats.browsers': 'เบราว์เซอร์',
  'stats.noData': 'ยังไม่มีข้อมูล',
  'stats.direct': 'เข้าตรง / ไม่ทราบที่มา',
  'stats.unknown': 'ไม่ทราบ',
  'stats.chartAria': 'ยอดเปิดรายวัน {days} วันล่าสุด รวม {total} ครั้ง สูงสุดวันละ {max} ครั้ง',
  'stats.barTitle': '{d}: {n} ครั้ง',
  'stats.note': 'นับวันตามเวลา UTC (ช้ากว่าเวลาไทย 7 ชั่วโมง) ยอดนับรวมการเปิดซ้ำและบอต/ตัวพรีวิวลิงก์ และเก็บรายละเอียดรายคลิกไว้ 90 วัน ประเทศจะแสดงเมื่อระบบอยู่หลัง Cloudflare',
  'device.desktop': 'คอมพิวเตอร์',
  'device.mobile': 'มือถือ',
  'device.tablet': 'แท็บเล็ต',
  'device.bot': 'บอต/ตัวพรีวิว',
  'device.unknown': 'ไม่ทราบ',
  // แก้ไข / ลบ
  'edit.title': 'แก้ไขลิงก์',
  'edit.short': 'ลิงก์สั้น',
  'edit.aliasNote': 'เปลี่ยนชื่อลิงก์ไม่ได้ เพราะ QR Code ที่แจกไปแล้วจะใช้ไม่ได้',
  'edit.dest': 'ลิงก์ปลายทาง',
  'edit.expires': 'หมดอายุเมื่อ',
  'edit.expiresHelp': 'ล้างค่าเพื่อให้ลิงก์ไม่หมดอายุ',
  'edit.save': 'บันทึก',
  'edit.saving': 'กำลังบันทึก…',
  'edit.failed': 'บันทึกไม่สำเร็จ',
  'del.title': 'ลบลิงก์นี้ถาวร?',
  'del.body': 'ลิงก์สั้นและ QR Code ที่แจกไปแล้วจะใช้ไม่ได้ และประวัติการเปิดของลิงก์นี้จะถูกลบด้วย กู้คืนไม่ได้ ถ้าแค่อยากหยุดใช้ชั่วคราวให้เลือก “ปิดลิงก์” แทน',
  'del.confirm': 'ลบลิงก์',
  'del.deleting': 'กำลังลบ…',
  'del.failed': 'ลบไม่สำเร็จ',
} as const;

export type MsgKey = keyof typeof th;

const en: Record<MsgKey, string> = {
  'common.close': 'Close',
  'common.closeDialog': 'Close dialog',
  'common.cancel': 'Cancel',
  'common.retry': 'Try again',
  'common.copy': 'Copy',
  'common.copied': 'Link copied',
  'common.copyFailed': 'Couldn\'t copy',
  'common.copyFailedManual': 'Couldn\'t copy. Select the text and copy it manually.',
  'common.loading': 'Loading…',
  'app.title': 'Shorturl By Kittamet',
  'api.network': 'Can\'t reach the server. Check your connection and try again.',
  'api.generic': 'Something went wrong. Please try again.',
  'nav.login': 'Log in',
  'nav.logout': 'Log out',
  'lang.label': 'Language',
  'theme.toLight': 'Switch to light mode',
  'theme.toDark': 'Switch to dark mode',
  'home.h1a': 'Paste a long link',
  'home.h1b': 'Get a short one instantly',
  'home.sub': 'Shorten links, make QR codes, and see how many people opened them — and from which devices and sites — all in one place.',
  'home.perk1': 'QR code made instantly',
  'home.perk2': 'See who opens your links',
  'home.perk3': 'Set an expiry or switch a link off',
  'home.fact1.title': 'Short links with QR codes',
  'home.fact1.body': 'Pick your own name or let us generate one, then download the QR code as PNG or SVG.',
  'home.fact2.title': 'Know where clicks come from',
  'home.fact2.body': 'Daily opens, devices, countries and referring sites — without storing visitors\' actual IP addresses.',
  'home.fact3.title': 'Stay in control',
  'home.fact3.body': 'Set an expiry date, switch a link off for a while, or delete it any time.',
  'hero.placeholder': 'Paste your link here',
  'hero.label': 'Link to shorten',
  'hero.submit': 'Shorten',
  'hero.aria': 'Shorten a link',
  'hero.empty': 'Paste the link you want to shorten first.',
  'hero.noteAnon': 'Log in once and we\'ll shorten the link you pasted right away.',
  'hero.noteAuthed': 'We\'ll shorten your link right away.',
  'decor.long': 'Long link',
  'decor.short': 'Short link',
  'decor.qr': 'QR code',
  'decor.opens7': 'Opens, last 7 days',
  'decor.from': 'Opened on',
  'decor.mobile': 'Mobile',
  'decor.desktop': 'Desktop',
  'login.h1a': 'Log in',
  'login.h1b': 'to get started',
  'login.sub': 'Pick whichever is easiest. Everything you shorten stays in your account.',
  'login.pending': 'Link waiting to be shortened',
  'login.with': 'Continue with {name}',
  'login.or': 'or',
  'login.withEmail': 'Continue with email',
  'login.email': 'Email',
  'login.password': 'Password',
  'login.submit': 'Log in',
  'login.submitting': 'Logging in…',
  'login.other': 'Choose another way',
  'login.back': 'Back to home',
  'login.failed': 'Couldn\'t log you in.',
  'dash.checking': 'Checking your session…',
  'dash.newTitle': 'Create a new short link',
  'dash.myLinks': 'My links',
  'dash.count': '{n} links',
  'dash.countOne': '{n} link',
  'dash.searchLabel': 'Search links',
  'dash.search': 'Search by short name or destination',
  'dash.loadingList': 'Loading your links…',
  'dash.emptyTitle': 'No links yet',
  'dash.emptyBody': 'Paste a long link above and press “Shorten” to make your first one.',
  'dash.noMatch': 'No links match “{q}”.',
  'dash.pagesNav': 'Pagination',
  'dash.prev': 'Previous',
  'dash.next': 'Next',
  'dash.page': 'Page {p} of {n}',
  'dash.enabled': 'Link turned on',
  'dash.disabled': 'Link turned off',
  'dash.statusFail': 'Couldn\'t change the status.',
  'dash.deleted': 'Link deleted',
  'dash.saved': 'Saved',
  'dash.loadFail': 'Couldn\'t load your links.',
  'dash.pendingFail': 'Couldn\'t shorten the link.',
  'create.aria': 'Create a new short link',
  'create.submitting': 'Shortening…',
  'create.more': 'Custom name or expiry date',
  'create.alias': 'Link name (optional)',
  'create.aliasPh': 'e.g. promo-2026',
  'create.aliasHelp': '3–30 characters: A–Z a–z 0–9 _ - ; must start and end with a letter or number. Leave empty for a random one.',
  'create.expires': 'Expires on (optional)',
  'create.expiresHelp': 'Leave empty for no expiry.',
  'create.failed': 'Couldn\'t create the link.',
  'result.aria': 'Link you just created',
  'result.title': 'Your short link is ready',
  'result.hide': 'Hide',
  'result.goes': 'Goes to {url}',
  'result.copy': 'Copy link',
  'result.qr': 'View QR code',
  'status.active': 'Active',
  'status.disabled': 'Off',
  'status.adminDisabled': 'Disabled by admin',
  'status.expired': 'Expired',
  'row.created': 'Created {d}',
  'row.expires': 'Expires {d}',
  'row.expiredOn': 'Expired {d}',
  'row.opens': 'opens',
  'row.qr': 'QR code',
  'row.stats': 'Stats',
  'row.edit': 'Edit',
  'row.turnOff': 'Turn off',
  'row.turnOn': 'Turn on',
  'row.delete': 'Delete',
  'row.aria.copy': 'Copy link {code}',
  'row.aria.qr': 'QR code for {code}',
  'row.aria.stats': 'Stats for {code}',
  'row.aria.edit': 'Edit {code}',
  'row.aria.off': 'Turn off link {code}',
  'row.aria.on': 'Turn on link {code}',
  'row.aria.delete': 'Delete link {code}',
  'qr.title': 'QR code',
  'qr.alt': 'QR code for {url}',
  'qr.creating': 'Creating…',
  'qr.loadFail': 'Couldn\'t load the QR code.',
  'qr.local': 'This QR code points to localhost, so a phone can\'t scan it. It will work once the app is on a real domain.',
  'qr.sizeLegend': 'PNG size',
  'qr.small': 'Small',
  'qr.medium': 'Medium',
  'qr.large': 'Large',
  'qr.dlPng': 'Download PNG',
  'qr.dlSvg': 'Download SVG',
  'qr.dlFail': 'Download failed.',
  'stats.title': 'Link statistics',
  'stats.range': 'Time range',
  'stats.lastDays': 'Last {n} days',
  'stats.loading': 'Loading statistics… (the first load may take a moment)',
  'stats.loadFail': 'Couldn\'t load the statistics.',
  'stats.unavailableTitle': 'Detailed statistics aren\'t available yet',
  'stats.unavailableBody': 'The statistics service may still be starting up. Total opens for this link: {n}. Try again in a minute.',
  'stats.total': 'Total opens',
  'stats.inWindow': 'In the last {n} days',
  'stats.unique': 'Unique visitors (approx.)',
  'stats.referrers': 'Referring sites',
  'stats.countries': 'Countries',
  'stats.devices': 'Devices',
  'stats.os': 'Operating systems',
  'stats.browsers': 'Browsers',
  'stats.noData': 'No data yet',
  'stats.direct': 'Direct / unknown source',
  'stats.unknown': 'Unknown',
  'stats.chartAria': 'Daily opens over the last {days} days: {total} in total, up to {max} per day.',
  'stats.barTitle': '{d} — opens: {n}',
  'stats.note': 'Days are counted in UTC (7 hours behind Thailand). Counts include repeat opens and bots/link previews. Per-click details are kept for 90 days. Countries appear when the app runs behind Cloudflare.',
  'device.desktop': 'Desktop',
  'device.mobile': 'Mobile',
  'device.tablet': 'Tablet',
  'device.bot': 'Bots / previews',
  'device.unknown': 'Unknown',
  'edit.title': 'Edit link',
  'edit.short': 'Short link',
  'edit.aliasNote': 'The short name can\'t be changed because QR codes already shared would stop working.',
  'edit.dest': 'Destination link',
  'edit.expires': 'Expires on',
  'edit.expiresHelp': 'Clear the value for no expiry.',
  'edit.save': 'Save',
  'edit.saving': 'Saving…',
  'edit.failed': 'Couldn\'t save.',
  'del.title': 'Delete this link for good?',
  'del.body': 'The short link and any QR codes you shared will stop working, and its click history will be deleted. This can\'t be undone. To pause it instead, choose “Turn off”.',
  'del.confirm': 'Delete link',
  'del.deleting': 'Deleting…',
  'del.failed': 'Couldn\'t delete.',
};

const DICT: Record<Lang, Record<MsgKey, string>> = { th, en };

function makeFmt(lang: Lang) {
  const locale = lang === 'th' ? 'th-TH' : 'en-GB';
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const num = new Intl.NumberFormat(locale);
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const regions = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames([lang], { type: 'region' }) : null;
  return {
    date: (iso: string) => date.format(new Date(iso)),
    number: (n: number) => num.format(n),
    /** yyyy-mm-dd (UTC จากเซิร์ฟเวอร์) → วันที่แบบสั้น */
    day: (d: string) => day.format(new Date(`${d}T00:00:00Z`)),
    country: (code: string) => {
      try {
        return regions?.of(code) ?? code;
      } catch {
        return code;
      }
    },
  };
}

export type Fmt = ReturnType<typeof makeFmt>;
export type TFn = (key: MsgKey, vars?: Record<string, string | number>) => string;

interface I18nState {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: TFn;
  fmt: Fmt;
}

const I18nContext = createContext<I18nState | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('th');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'en' || saved === 'th') setLangState(saved);
    } catch {
      /* ใช้ภาษาไทยเป็นค่าเริ่มต้น */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = DICT[lang]['app.title'];
    setApiLang(lang);
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* ไม่จำค่าข้ามรอบ */
    }
  }, []);

  const t = useCallback<TFn>(
    (key, vars) => {
      let s = DICT[lang][key] ?? DICT.th[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
      return s;
    },
    [lang],
  );

  const fmt = useMemo(() => makeFmt(lang), [lang]);
  const value = useMemo(() => ({ lang, setLang, t, fmt }), [lang, setLang, t, fmt]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nState {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n ต้องอยู่ใน I18nProvider');
  return ctx;
}

/** ข้อความของภาษานั้นๆ นอก React (เช่น error ใน api.ts) */
export function messageFor(lang: Lang, key: MsgKey): string {
  return DICT[lang][key];
}
