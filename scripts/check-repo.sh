#!/usr/bin/env bash
# ตรวจความเรียบร้อยของ repo ก่อน merge — รันได้ทั้งใน CI และในเครื่อง: ./scripts/check-repo.sh
# 1) ไม่มีไฟล์ .env ถูก track  2) ไม่มีค่าลับหลุดในไฟล์ที่ track  3) render.yaml ไม่มีค่าลับจริง  4) CLI ไวยากรณ์ถูก
set -u
cd "$(dirname "$0")/.."
fail=0
bad() { echo "✗ $1"; fail=1; }

# 1) .env ห้ามเข้า git (.env.example ไม่มีในโปรเจกต์นี้ เพราะเจ้าของโปรเจกต์เลือกไม่เก็บ)
tracked_env=$(git ls-files | grep -E '(^|/)\.env($|\.)' || true)
[ -n "$tracked_env" ] && bad "ไฟล์ .env ถูก track ใน git: $tracked_env"

# 2) รูปแบบค่าลับที่รู้จัก (อนุญาตเฉพาะ host ในเครื่อง/ชื่อ service ใน docker และค่าตัวอย่าง)
patterns=(
  'GOCSPX-[A-Za-z0-9_-]{20,}'                       # Google OAuth client secret
  'npg_[A-Za-z0-9]{12,}'                            # Neon password
  'AKIA[0-9A-Z]{16}'                                # AWS access key id
  'ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}' # GitHub token
  '-----BEGIN ([A-Z]+ )?PRIVATE KEY-----'           # private key
  'surl_[A-Za-z0-9_-]{32}'                          # API key ของระบบนี้ (ความยาวเต็ม)
  '(postgres(ql)?|rediss?)://[^/:@[:space:]<>]+:[^/@[:space:]<>*.]{8,}@(?!localhost|127\.0\.0\.1|postgres|redis|host\.docker\.internal|example)'
)
for p in "${patterns[@]}"; do
  hits=$(git grep -nIP -e "$p" -- . ':(exclude)package-lock.json' ':(exclude)**/package-lock.json' 2>/dev/null || true)
  [ -n "$hits" ] && bad "พบรูปแบบค่าลับ /$p/:"$'\n'"$(echo "$hits" | sed 's/^/    /' | cut -c1-160)"
done

# 3) render.yaml: ทุกตัวแปรต้องมีค่าสาธารณะ (value) หรือถามตอนสร้าง (sync: false) และห้ามมีค่าของ secret ตรงๆ
python3 - <<'PY' || fail=1
import re, sys, yaml
d = yaml.safe_load(open('render.yaml'))
SECRET = re.compile(r'(SECRET|PASSWORD|KEY|SALT|DATABASE_URL|REDIS_URL|TOKEN)$')
ok = True
for s in d['services']:
    for e in s['envVars']:
        if SECRET.search(e['key']) and 'value' in e and e['key'] not in ('INTERNAL_API_KEY_NOT_SECRET',):
            print(f"✗ render.yaml: {s['name']}.{e['key']} มีค่าลับตรงๆ (ต้องเป็น sync: false)"); ok = False
        if 'value' not in e and e.get('sync') is not False and 'generateValue' not in e:
            print(f"✗ render.yaml: {s['name']}.{e['key']} ไม่มี value/sync:false"); ok = False
sys.exit(0 if ok else 1)
PY

# 4) CLI
node --check cli/surl.mjs || bad "cli/surl.mjs ไวยากรณ์ผิด"

[ "$fail" -eq 0 ] && echo "✓ repo เรียบร้อย" || { echo "พบปัญหาข้างบน"; exit 1; }
