#!/bin/bash
# Скачивает картинки проектов с playdisplay.com в assets/
cd "$(dirname "$0")/assets" || exit 1
urls=(
  "https://playdisplay.com/wp-content/uploads/2026/01/site_ships_23_2-960x960.png"
  "https://playdisplay.com/wp-content/uploads/2026/01/site_airports_23-960x960.png"
  "https://playdisplay.com/wp-content/uploads/2026/01/site_odk_21_2-960x960.png"
  "https://playdisplay.com/wp-content/uploads/2026/01/site_ra_24-1-960x960.png"
  "https://playdisplay.com/wp-content/uploads/2021/06/01_logo_v03-960x960.jpg"
  "https://playdisplay.com/wp-content/uploads/2021/02/ptk_start_2.gif"
  "https://playdisplay.com/wp-content/uploads/2020/03/mig_booth-960x960.jpg"
  "https://playdisplay.com/wp-content/uploads/2020/05/bmw_start.jpg"
  "https://playdisplay.com/wp-content/uploads/2020/04/pano_bg-960x536.jpg"
  "https://playdisplay.com/wp-content/uploads/2020/04/GERB_loop.gif"
  "https://playdisplay.com/wp-content/uploads/2020/04/stalingrad.jpg"
  "https://playdisplay.com/wp-content/uploads/2020/04/coalco.jpg"
  "https://playdisplay.com/wp-content/uploads/2020/03/stm_cover2.jpg"
  "https://playdisplay.com/wp-content/uploads/2020/03/space_st-960x960.jpg"
  "https://playdisplay.com/wp-content/uploads/2020/03/space_sm2-960x960.jpg"
  "https://products.playdisplay.com/wp-content/uploads/2020/03/CLIENTS2.png"
  "https://playdisplay.com/wp-content/uploads/2021/06/pult_preview_cam_01_crop.png"
)
ok=0; fail=0
for u in "${urls[@]}"; do
  if curl -sfL --max-time 60 -O "$u"; then ok=$((ok+1)); echo "✓ $(basename "$u")";
  else fail=$((fail+1)); echo "✗ FAIL: $u"; fi
done
echo "---"
echo "Скачано: $ok, ошибок: $fail"
