#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Статические ttf из веб-шрифтов сайта — для растеризатора OG-карточек.

    _tools/venv/bin/python _tools/mkfonts.py

Зачем. На сайте лежат только woff2, а Pillow их не открывает. Брать взамен
похожий шрифт нельзя: превью ссылки — рекламный носитель, и лицо в нём должно
быть тем же, что в шапке. Поэтому пересобираем те же самые файлы.

Что делаем. Google-подмножества разбиты по алфавитам (latin, latin-ext,
cyrillic, cyrillic-ext) — по отдельности ни одно не покрывает русский
заголовок с латинской маркой. Сливаем нужные, а если исходник вариативный,
сперва фиксируем ось wght: Pillow вариативность игнорирует и рисует Regular.

Результат — _tools/fonts/*.ttf, в git не попадает (собирается из site/).
"""
import os, sys, glob
from fontTools.ttLib import TTFont
from fontTools.merge import Merger
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'site', 'assets', 'fonts')
OUT = os.path.join(ROOT, '_tools', 'fonts')

# (имя на выходе, префикс подмножеств, вес)
FACES = [
    ('Unbounded-800.ttf', 'unbounded-800', 800),
    ('Unbounded-700.ttf', 'unbounded-700', 700),
    ('Onest-500.ttf',     'onest-500',     500),
    ('Onest-400.ttf',     'onest-400',     400),
]
# порядок важен: первым идёт подмножество, чьи метрики станут метриками слияния
PARTS = ['cyrillic', 'latin', 'latin-ext', 'cyrillic-ext']


def static(path, wght):
    """woff2 -> ttf, вариативный -> зафиксированный на нужном весе"""
    f = TTFont(path)
    f.flavor = None                      # снимаем woff2-упаковку
    if 'fvar' in f:
        f = instancer.instantiateVariableFont(f, {'wght': wght}, inplace=False)
    return f


def build(name, prefix, wght):
    tmp = []
    for part in PARTS:
        p = os.path.join(SRC, '%s-%s.woff2' % (prefix, part))
        if not os.path.exists(p):
            continue
        f = static(p, wght)
        t = os.path.join(OUT, '.%s-%s.ttf' % (prefix, part))
        f.save(t); tmp.append(t)
    if not tmp:
        return None
    dest = os.path.join(OUT, name)
    if len(tmp) == 1:
        os.replace(tmp[0], dest)
    else:
        # Merger валится на дублях: каждое подмножество несёт .notdef и пробел.
        Merger().merge(tmp).save(dest)
        for t in tmp:
            os.remove(t)
    n = len(TTFont(dest).getBestCmap())
    return dest, n


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    probe = 'PLAYDISPLAY® Оборудование вывода — 24 позиции'
    for name, prefix, wght in FACES:
        r = build(name, prefix, wght)
        if not r:
            print('%-20s пропущен: нет %s-*.woff2' % (name, prefix)); continue
        dest, n = r
        cm = set(TTFont(dest).getBestCmap())
        miss = ''.join(sorted({c for c in probe if ord(c) not in cm}))
        print('%-20s символов: %3d | нет: %s' % (name, n, miss or 'всё есть'))
