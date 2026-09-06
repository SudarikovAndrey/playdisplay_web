#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""HDR-версия картинки для сайта: PNG 16 бит с профилем Rec. ITU-R BT.2100 PQ.

Зачем. Обычный цвет в браузере не бывает ярче белого интерфейса — ни CSS, ни sRGB/P3
картинка. Файл с PQ-профилем браузер (Chrome, Safari) на HDR-экране показывает ЯРЧЕ
белого: так сделан баннер ANTI на LinkedIn (06.09.2026), у него ровно этот профиль.
На SDR-экране и в Firefox картинка выглядит как обычная — браузер сам сжимает в SDR.

Как. sRGB → линейный свет → умножаем на яркость в нитах → sRGB-праймари в BT.2020 →
кривая PQ → 16 бит. Профиль вшивается чанком iCCP (снят с логотипа ANTI, _tools/bt2100pq.icc).
Альфа переносится как есть. Декодирует исходник ffmpeg (в системе есть, PIL — нет).

Ориентиры яркости: 203 нит = «белый как у SDR» (картинка не отличается от исходной);
500–600 — заметное свечение для сайта; 1000 — как демо, на грани.

    python3 _tools/hdr-png.py in.png out.png --nits 600
"""
import argparse, os, struct, subprocess, sys, zlib

M1, M2, C1, C2, C3 = 0.1593017578125, 78.84375, 0.8359375, 18.8515625, 18.6875
# sRGB (BT.709) → BT.2020, линейные значения
MAT = ((0.6274, 0.3293, 0.0433), (0.0691, 0.9195, 0.0114), (0.0164, 0.0880, 0.8956))

def pq(nits):
    y = max(nits, 0.0) / 10000.0
    p = y ** M1
    return ((C1 + C2 * p) / (1 + C3 * p)) ** M2

def srgb_lin(c8):
    c = c8 / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

def probe(path):
    out = subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
                                   '-show_entries', 'stream=width,height', '-of', 'csv=p=0', path])
    w, h = out.decode().strip().split(',')[:2]
    return int(w), int(h)

def chunk(tag, data):
    return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('src'); ap.add_argument('dst')
    ap.add_argument('--nits', type=float, default=600, help='яркость sRGB-белого исходника, нит')
    ap.add_argument('--icc', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bt2100pq.icc'))
    a = ap.parse_args()

    w, h = probe(a.src)
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', a.src, '-f', 'rawvideo', '-pix_fmt', 'rgba', '-'])
    assert len(raw) == w * h * 4, 'ffmpeg отдал неожиданный объём'

    cache = {}
    rows = []
    for y in range(h):
        row = bytearray([0])  # фильтр строки: none
        base = y * w * 4
        for x in range(w):
            i = base + x * 4
            k = raw[i:i + 3]
            v = cache.get(k)
            if v is None:
                lr, lg, lb = (srgb_lin(k[0]), srgb_lin(k[1]), srgb_lin(k[2]))
                v = tuple(int(round(min(max(pq((m[0] * lr + m[1] * lg + m[2] * lb) * a.nits), 0.0), 1.0) * 65535))
                          for m in MAT)
                cache[k] = v
            row += struct.pack('>HHHH', v[0], v[1], v[2], raw[i + 3] * 257)
        rows.append(bytes(row))

    icc = open(a.icc, 'rb').read()
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 16, 6, 0, 0, 0))
           + chunk(b'iCCP', b'BT.2100 PQ\x00\x00' + zlib.compress(icc, 9))
           + chunk(b'IDAT', zlib.compress(b''.join(rows), 9))
           + chunk(b'IEND', b''))
    open(a.dst, 'wb').write(png)
    print('%s: %dx%d, %d нит, %d КБ' % (a.dst, w, h, a.nits, len(png) // 1024))

if __name__ == '__main__':
    main()
