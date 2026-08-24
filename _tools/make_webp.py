#!/usr/bin/env python3
"""Делает .webp рядом с картинками статических страниц (кейсы и концепции).

    _tools/venv/bin/python _tools/make_webp.py          # только недостающее
    _tools/venv/bin/python _tools/make_webp.py --force   # переделать всё

Зачем именно так, а не иначе — три решения, каждое из замера 23.08.2026.

1. ФОРМАТ ИСХОДНИКА РЕШАЕТ РЕЖИМ СЖАТИЯ. У фотографий (jpeg) режим с потерями,
   quality=85: экономия 32 %. У графики (png — карты, схемы, инструкции) режим БЕЗ
   потерь: экономия 54 % и пиксель в пиксель. Наоборот делать нельзя, и это не
   вкусовщина: lossless на фотографии дал +209…+275 % к весу, а q85 на карте с
   плоскими заливками — всего −6 % при заметной потере. Формат, в котором студия
   сохранила файл, и есть указание на его содержание.

2. ЕСЛИ WEBP ПОЛУЧИЛСЯ ТЯЖЕЛЕЕ — ВЫБРАСЫВАЕМ. Такое бывает: на 179 картинках
   нашлось три (mig_des_booth3, 5, 10). Держать их рядом бессмысленно, а генератор
   и так подставит <picture> только когда файл существует.

3. НИЧЕГО НЕ ПЕРЕЗАПИСЫВАЕТСЯ. Исходный jpeg/png остаётся на месте и уходит в
   <picture> запасным источником: браузер без webp получит его, а мы не теряем
   оригинал. Поэтому скрипт безопасно запускать сколько угодно раз.

4. АНИМИРОВАННЫЕ GIF НЕ ТРОГАЕМ, И ЭТО РЕШЕНИЕ, А НЕ НЕДОДЕЛКА. Их две
   (Panorama_Test1 и Test3 на pano360), вместе 1,4 МБ из 3,3 МБ той страницы, и
   анимированный webp срезал бы 61-66 % — соблазнительно. Но Pillow 12 НЕ ЗАПИСЫВАЕТ
   длительность кадров: файл получается с 99 кадрами и duration=None, Pillow открывает
   его без жалоб, а браузер показывает статичную картинку. Проверено в браузере: три
   снимка canvas с интервалом 700 мс дали один и тот же кадр. Пробовал и seek+copy, и
   ImageSequence, и duration списком — не помогло.
   Анимация — это содержание. Потерять её ради 0,9 МБ нельзя, поэтому gif остаётся gif.
   Правильный инструмент для этого — gif2webp из пакета webp (brew install webp) или
   перевод в <video>, но и то и другое выходит за рамки этого скрипта.

Итог замера: 35,0 МБ -> 23,6 МБ по jpeg и png (33 %).
"""
import os, sys, io
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIRS = ['site/assets/work', 'site/assets/concepts']
FORCE = '--force' in sys.argv

made = skipped = heavier = fresh = 0
saved_before = saved_after = 0

for d in DIRS:
    base = os.path.join(ROOT, d)
    if not os.path.isdir(base):
        print('нет папки', d)
        continue
    for cur, dirs, files in os.walk(base):
        for fn in sorted(files):
            ext = os.path.splitext(fn)[1].lower()
            if ext not in ('.jpg', '.jpeg', '.png'):
                continue
            src = os.path.join(cur, fn)
            dst = os.path.splitext(src)[0] + '.webp'
            if os.path.exists(dst) and not FORCE and os.path.getmtime(dst) >= os.path.getmtime(src):
                fresh += 1
                continue
            try:
                im = Image.open(src)
            except Exception as e:
                print('  не открылась:', os.path.relpath(src, ROOT), e)
                skipped += 1
                continue
            buf = io.BytesIO()
            if ext == '.png':
                im.convert('RGB').save(buf, 'WEBP', lossless=True, method=6)
            else:
                im.convert('RGB').save(buf, 'WEBP', quality=85, method=6)
            cs, ws = os.path.getsize(src), buf.tell()
            if ws >= cs:
                # webp не помог — не держим лишний файл и убираем прежний, если был
                if os.path.exists(dst):
                    os.remove(dst)
                heavier += 1
                continue
            open(dst, 'wb').write(buf.getvalue())
            made += 1
            saved_before += cs
            saved_after += ws

print('сделано webp: %d | уже свежих: %d | webp тяжелее, пропущено: %d | не открылось: %d'
      % (made, fresh, heavier, skipped))
if made:
    print('по сделанным: %.1f МБ -> %.1f МБ, экономия %.1f МБ (%.0f%%)'
          % (saved_before / 1048576, saved_after / 1048576,
             (saved_before - saved_after) / 1048576, (1 - saved_after / saved_before) * 100))
