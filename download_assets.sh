#!/bin/bash
# Скачивает ВСЕ картинки проектов из site/data/projects.json
# в site/assets/work/<slug>/<имя файла>. Повторный запуск докачивает недостающее.
# Запуск:  bash download_assets.sh
cd "$(dirname "$0")" || exit 1
JSON="site/data/projects.json"
[ -f "$JSON" ] || { echo "нет $JSON"; exit 1; }

python3 - "$JSON" <<'PY' > /tmp/pd_assets.tsv
import json,sys
d=json.load(open(sys.argv[1]))
for p in d["projects"]:
    urls=[p.get("cover")]
    for b in p.get("flow",[]):
        if b.get("t")=="img": urls+=b["src"]
    seen=set()
    for u in urls:
        if u and u not in seen:
            seen.add(u); print(f'{p["slug"]}\t{u}')
PY

ok=0; skip=0; fail=0
while IFS=$'\t' read -r slug url; do
  dir="site/assets/work/$slug"
  mkdir -p "$dir"
  f="$dir/$(basename "$url")"
  # пропускаем и если есть пережатый вариант (png→jpg, gif→mp4) — не тянем тяжёлые оригиналы заново
  if [ -s "$f" ] || [ -s "${f%.png}.jpg" ] || [ -s "${f%.gif}.mp4" ]; then skip=$((skip+1)); continue; fi
  if curl -sfL --retry 2 --max-time 90 -o "$f" "$url"; then
    ok=$((ok+1)); echo "✓ $slug/$(basename "$url")"
  else
    fail=$((fail+1)); echo "✗ FAIL: $url"; rm -f "$f"
  fi
done < /tmp/pd_assets.tsv

echo "---"
echo "Скачано: $ok, уже было: $skip, ошибок: $fail"
du -sh site/assets/work 2>/dev/null
