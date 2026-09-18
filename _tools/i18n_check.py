#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Проверка языковой версии: не осталось ли на ней русского текста.

    python3 _tools/i18n_check.py pt          # готовые страницы /pt/**
    python3 _tools/i18n_check.py en
    python3 _tools/i18n_check.py pt --dict   # ещё и покрытие словаря для главной

Зачем отдельный инструмент. Перевод главной делается СЛОВАРЁМ по точному совпадению
русской строки, и промах словаря — не ошибка: строка просто остаётся русской. Ни
сборка, ни браузер об этом не скажут. То же и с данными: пропущенное поле выглядит
как обычный текст, только не на том языке.

Проверка смотрит ВИДИМЫЙ текст: скрипты, стили и комментарии вырезаются — в них
кириллица законна, это комментарии разработчика, объясняющие «почему».

На языковой странице кириллицы не должно быть ВООБЩЕ, включая имена собственные:
«Ростех» на португальской странице пишется Rostec, как и на английской.
"""
import html.parser, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, 'site')
CYR = re.compile('[а-яёА-ЯЁ]')
WORD = re.compile('[а-яёА-ЯЁ][а-яёА-ЯЁ-]*')
SKIP_TAGS = {'script', 'style', 'noscript', 'textarea'}
# Переводимые атрибуты — тот же список, что у i18nApply в index.html
ATTRS = ('placeholder', 'title', 'alt', 'aria-label', 'data-hint', 'value', 'content')


class Visible(html.parser.HTMLParser):
    """текстовые узлы и переводимые атрибуты — то, что видит человек"""
    def __init__(self, skip_meta=False):
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.skip_meta = skip_meta   # мета-теги и <title> подменяет сборка, не словарь
        self.in_title = False
        self.hits = []               # (что, текст)

    def handle_starttag(self, tag, attrs):
        if tag in SKIP_TAGS:
            self.depth += 1
            return
        if tag == 'title':
            self.in_title = True
        if self.skip_meta and tag == 'meta':
            return
        for k, v in attrs:
            if k in ATTRS and v and CYR.search(v):
                self.hits.append(('@' + k, v))

    def handle_endtag(self, tag):
        if tag == 'title':
            self.in_title = False
        if tag in SKIP_TAGS and self.depth:
            self.depth -= 1

    def handle_data(self, data):
        if self.depth or not data.strip():
            return
        if self.skip_meta and self.in_title:
            return
        if CYR.search(data):
            self.hits.append(('текст', ' '.join(data.split())))


def scan_file(path, skip_meta=False):
    p = Visible(skip_meta)
    p.feed(open(path, encoding='utf-8').read())
    return p.hits


def scan_lang(code):
    """все собранные страницы языка; для русского — ничего, он исходный"""
    root = SITE if code == 'ru' else os.path.join(SITE, code)
    if not os.path.isdir(root):
        sys.exit('нет папки %s — язык не собран' % os.path.relpath(root, ROOT))
    bad, total, pages = [], 0, 0
    for dirpath, _dirs, files in os.walk(root):
        for fn in files:
            if not fn.endswith('.html'):
                continue
            full = os.path.join(dirpath, fn)
            rel = os.path.relpath(full, SITE)
            if code != 'ru' and not rel.startswith(code + os.sep):
                continue
            pages += 1
            hits = scan_file(full)
            # Главная — SPA: её русский текст переводит словарь в браузере, в файле он
            # лежит по определению. Здесь она проверяется не сканом, а ключом --dict.
            if rel == os.path.join(code, 'index.html'):
                continue
            if hits:
                n = sum(len(WORD.findall(t)) for _, t in hits)
                total += n
                bad.append((rel, n, hits))
    return pages, total, bad


def load_dict(code):
    p = os.path.join(SITE, 'data/i18n/%s.js' % code)
    if not os.path.exists(p):
        return None
    import json
    raw = open(p, encoding='utf-8').read()
    return json.loads(raw.split('=', 1)[1].rsplit(';', 1)[0])


def check_dict(code):
    """строки главной, которым словарь не даёт перевода"""
    dic = load_dict(code)
    if dic is None:
        sys.exit('нет словаря site/data/i18n/%s.js' % code)
    # Смотрим СОБРАННУЮ копию, а не исходную русскую главную: мета-теги и SEO-блок
    # в копии уже подменены на языковые, и попадать в отчёт им незачем. Остаётся ровно
    # то, что должен покрыть словарь, — текст разметки.
    home = os.path.join(SITE, code, 'index.html')
    if not os.path.exists(home):
        sys.exit('нет %s — сначала соберите: python3 build_seo.py'
                 % os.path.relpath(home, ROOT))
    hits = scan_file(home)
    miss, seen = [], set()
    for kind, text in hits:
        t = ' '.join(text.split())
        if not t or t in seen:
            continue
        seen.add(t)
        if t not in dic:
            miss.append((kind, t))
    print()
    print('ПОКРЫТИЕ СЛОВАРЯ для главной (%s): строк в разметке %d, без перевода %d'
          % (code, len(seen), len(miss)))
    for kind, t in miss[:60]:
        print('   [%s] %s' % (kind, t[:100]))
    if len(miss) > 60:
        print('   … ещё %d' % (len(miss) - 60))
    return len(miss)


def main():
    code = sys.argv[1] if len(sys.argv) > 1 else 'pt'
    pages, total, bad = scan_lang(code)
    print('страниц проверено: %d' % pages)
    if not bad:
        print('русского текста на страницах /%s/ нет' % code)
    else:
        print('РУССКИЙ ТЕКСТ НА СТРАНИЦАХ /%s/: %d слов на %d страницах'
              % (code, total, len(bad)))
        for rel, n, hits in sorted(bad, key=lambda x: -x[1]):
            print('   %-44s %4d слов' % (rel, n))
            for kind, t in hits[:3]:
                print('        [%s] %s' % (kind, t[:90]))
            if len(hits) > 3:
                print('        … ещё %d мест' % (len(hits) - 3))
    miss = check_dict(code) if '--dict' in sys.argv else 0
    sys.exit(1 if (bad or miss) else 0)


if __name__ == '__main__':
    main()
