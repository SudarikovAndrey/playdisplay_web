#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Шапка возврата на архивных страницах старого сайта.

    python3 old-banner.py            # показать, что будет сделано
    python3 old-banner.py --apply    # вставить

ЗАЧЕМ. В ~/wordpress_2/public_html/old лежит снимок сайта на WordPress.
Он не мёртвый груз: правило .htaccess отправляет туда неизвестные адреса
вида /work/<слаг>/, и Google до сих пор показывает эти страницы в выдаче —
проверено 18.09.2026, «Голографический куб — PLAYDISPLAY» находится поиском.

Но внутри архива ни одной ссылки на новый сайт: все href ведут на
../../index.html снимка 2020 года. Человек, попавший туда из поиска,
упирался в тупик и уходил. Шапка даёт ему выход — на новый сайт целиком
и на соответствующий кейс, если такой есть.

Скрипт идемпотентный: повторный запуск ничего не портит, метка MARK ищется
перед вставкой. Архив вне git (249 МБ, в основном картинки), поэтому правка
делается скриптом из репозитория, а не руками — так её видно и можно
повторить или откатить.
"""

import io
import os
import re
import sys

MARK = '<!-- pd-archive-banner -->'

# Старый слаг -> страница нового сайта. Слаги, которых нет в словаре,
# на новом сайте не повторены (Changi, Оживайка, Petrol Bowl, лампа Jihi,
# Summer 17, голографический куб) — для них ведём на список работ.
MAP = {
    'bmwx5': '/work/bmwx5/',
    'coalco': '/work/coalco/',
    'mig2019': '/work/mig2019/',
    'pano360': '/work/pano360/',
    'ptk-group': '/work/ptk-group/',
    'rostec': '/work/rostec/',
    'ростех-экспо': '/work/rostec/',
    'sinara': '/work/sinara/',
    'stallingrad': '/work/stalingrad/',
    'urban-forum-2018': '/work/urban-forum-2018/',
    'vdnh_space': '/work/vdnh-space/',
    'vdnh_space-2': '/work/vdnh-space-center/',
    'аэропорты-россии': '/work/airports/',
    'одк-оак': '/work/odk-oak/',
    'судостроение': '/work/industry-rf/',
}

# Стили инлайном: своей таблицы стилей у архива нет смысла трогать, а чужая
# может переопределить что угодно — поэтому !important на ключевых свойствах.
TPL = MARK + '''
<div style="position:relative!important;z-index:2147483647!important;
 background:#070f13!important;color:#c8d8e2!important;
 font:400 15px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif!important;
 padding:12px 20px!important;text-align:center!important;
 border-bottom:1px solid rgba(43,224,198,.35)!important;box-sizing:border-box!important">
 Это архив прежней версии сайта.
 <a href="https://playdisplay.com{link}" style="color:#2be0c6!important;
  text-decoration:none!important;font-weight:600!important;white-space:nowrap">{label} &#8594;</a>
</div>
'''


def slug_of(path):
    """Слаг кейса из пути вида .../old/work/<слаг>/index.html."""
    parts = path.replace('\\', '/').split('/')
    if 'work' in parts:
        i = parts.index('work')
        if i + 1 < len(parts) and parts[i + 1] not in ('index.html',):
            return parts[i + 1]
    return ''


def banner_for(path):
    slug = slug_of(path)
    if slug in MAP:
        return TPL.format(link=MAP[slug], label='Эта работа на новом сайте')
    return TPL.format(link='/#work', label='Перейти на playdisplay.com')


def process(root, apply):
    changed = skipped = 0
    for dirpath, _dirs, files in os.walk(root):
        for name in files:
            if not name.endswith('.html'):
                continue
            path = os.path.join(dirpath, name)
            try:
                html = io.open(path, encoding='utf-8', errors='replace').read()
            except Exception as e:
                sys.stderr.write('не прочитан %s: %s\n' % (path, e))
                continue
            if MARK in html:
                skipped += 1
                continue
            m = re.search(r'<body[^>]*>', html, re.I)
            if not m:
                sys.stderr.write('без <body>: %s\n' % path)
                continue
            new = html[:m.end()] + banner_for(path) + html[m.end():]
            rel = os.path.relpath(path, root)
            print('%s  %s' % ('вставлю ' if not apply else 'вставлено', rel))
            if apply:
                io.open(path, 'w', encoding='utf-8').write(new)
            changed += 1
    print('')
    print('страниц с шапкой: %d, уже было: %d' % (changed, skipped))
    if not apply:
        print('это был показ; чтобы применить — запустить с --apply')


if __name__ == '__main__':
    root = os.path.expanduser('~/wordpress_2/public_html/old')
    args = [a for a in sys.argv[1:] if not a.startswith('-')]
    if args:
        root = args[0]
    if not os.path.isdir(root):
        sys.exit('нет каталога: %s' % root)
    process(root, '--apply' in sys.argv)
