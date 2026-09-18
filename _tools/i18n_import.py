#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сборка переведённых батчей обратно в данные сайта.

    python3 _tools/i18n_import.py pt            # проверить и собрать
    python3 _tools/i18n_import.py pt --dry      # только проверить

Читает `_i18n/<язык>/out/*.json` — те же файлы, что раздал `i18n_export.py`, но
с заполненным полем "pt". Пишет:

    site/data/<язык>/*.json      данные раздела
    site/data/i18n/<язык>.js     словарь интерфейса
    site/data/i18n/prose.json    проза генератора (колонка языка)
    site/data/i18n/og/<язык>.json тексты карточек превью

ПРОВЕРЯЕТ, а не просто раскладывает. Модель отвечает валидным JSON и тогда, когда
перевода в нём нет: это уже случалось на переводе карточки ассистента — русский
текст внутри правильной структуры, ошибки нет, в логе тишина. Поэтому здесь
сверяются: полнота, остатки кириллицы, теги HTML и подстановки %d/%s. Порченый
батч не попадает в данные ЦЕЛИКОМ — чинить надо его, а не сайт.
"""
import json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from i18n_export import collect, ru_only_paths, load_dict, CYR, SITE, ROOT

TAG = re.compile(r'</?[a-z][a-z0-9]*[^>]*>', re.I)
FMT = re.compile(r'%[sd]')


def set_at(node, path, value):
    """положить значение по пути вида services/3/flow/2/text"""
    segs = path.split('/')
    for seg in segs[:-1]:
        node = node[int(seg)] if isinstance(node, list) else node[seg]
    last = segs[-1]
    if isinstance(node, list):
        node[int(last)] = value
    else:
        node[last] = value


def drop_paths(data, paths):
    """убрать блоки по путям; удаляем с конца, иначе индексы разъезжаются"""
    for path in sorted(paths, key=lambda p: [int(x) if x.isdigit() else x
                                             for x in p.split('/')], reverse=True):
        segs = path.split('/')
        node = data
        for seg in segs[:-1]:
            node = node[int(seg)] if isinstance(node, list) else node[seg]
        last = segs[-1]
        if isinstance(node, list):
            del node[int(last)]
        else:
            node.pop(last, None)


def rebuild_derived(name, data, ru_src):
    """Пересобрать поля, которые связывают данные ПО ЗНАЧЕНИЮ.

    Переводчику их не отдавали: одно и то же слово лежит в нескольких местах, и три
    независимых перевода разошлись бы — фильтр Атласа перестал бы находить карточки,
    а подпись категории у концепции не совпала бы с подписью в списке фильтра."""
    if name == 'atlas':
        ru_cats = ru_src.get('cats') or []
        pt_cats = data.get('cats') or []
        m = dict(zip(ru_cats, pt_cats))
        data['catLabels'] = {m.get(k, k): v for k, v in (data.get('catLabels') or {}).items()}
        for i, it in enumerate(data.get('items') or []):
            it['cat'] = m.get((ru_src['items'][i] or {}).get('cat'), it.get('cat'))
    elif name == 'concepts':
        by_id = {c['id']: c.get('label') for c in (data.get('cats') or []) if c.get('id')}
        for c in data.get('concepts') or []:
            if c.get('cat') in by_id:
                c['catLabel'] = by_id[c['cat']]


def check(path, ru, pt):
    """что не так с переводом строки; пустой список — всё в порядке"""
    bad = []
    if not pt or not pt.strip():
        bad.append('пусто')
        return bad
    if CYR.search(pt):
        bad.append('осталась кириллица: %s' % CYR.findall(pt)[:6])
    if pt.strip() == ru.strip():
        bad.append('строка не переведена — совпадает с русской')
    t_ru, t_pt = sorted(TAG.findall(ru)), sorted(TAG.findall(pt))
    if t_ru != t_pt:
        bad.append('разметка разошлась: было %s, стало %s' % (t_ru, t_pt))
    if sorted(FMT.findall(ru)) != sorted(FMT.findall(pt)):
        bad.append('подстановки %%d/%%s потерялись: было %s, стало %s'
                   % (FMT.findall(ru), FMT.findall(pt)))
    return bad


def main():
    code = sys.argv[1] if len(sys.argv) > 1 else 'pt'
    dry = '--dry' in sys.argv
    base = os.path.join(ROOT, '_i18n', code)
    out_dir = os.path.join(base, 'out')
    if not os.path.isdir(out_dir):
        sys.exit('нет папки %s — переведённые батчи класть туда'
                 % os.path.relpath(out_dir, ROOT))

    # ---------- эталон: что вообще должно быть переведено ----------
    want = {}          # путь → (раздел, русский текст)
    for section, items in collect(code):
        for p, ru, _en in items:
            if ru:
                want[p] = (section, ru)

    # ---------- что пришло ----------
    got, problems, seen_files = {}, [], []
    for fn in sorted(os.listdir(out_dir)):
        if not fn.endswith('.json'):
            continue
        seen_files.append(fn)
        try:
            d = json.load(open(os.path.join(out_dir, fn), encoding='utf-8'))
        except ValueError as e:
            problems.append('%s: не разбирается как JSON — %s' % (fn, e))
            continue
        for it in d.get('itens') or []:
            p, pt = it.get('path'), it.get(code) or ''
            if p not in want:
                problems.append('%s [%s]: путь %r неизвестен — батч не от этой выгрузки'
                                % (fn, it.get('id'), p))
                continue
            ru = want[p][1]
            if it.get('ru') is not None and it['ru'] != ru:
                problems.append('%s [%s]: русский оригинал изменён — данные разошлись '
                                'с выгрузкой, надо выгрузить заново' % (fn, it.get('id')))
                continue
            bad = check(p, ru, pt)
            if bad:
                problems.append('%s [%s] %s: %s' % (fn, it.get('id'), p, '; '.join(bad)))
                continue
            got[p] = pt

    missing = [p for p in want if p not in got]
    print('батчей прочитано: %d' % len(seen_files))
    print('строк ожидается : %d' % len(want))
    print('строк принято   : %d' % len(got))
    if missing:
        by_sec = {}
        for p in missing:
            by_sec.setdefault(want[p][0], []).append(p)
        print('НЕ ХВАТАЕТ      : %d' % len(missing))
        for sec in sorted(by_sec):
            print('   %-10s %d' % (sec, len(by_sec[sec])))
    if problems:
        print()
        print('ЗАМЕЧАНИЯ (%d), эти строки НЕ приняты:' % len(problems))
        for x in problems[:40]:
            print('   ' + x)
        if len(problems) > 40:
            print('   … ещё %d' % (len(problems) - 40))
    if dry:
        return
    if missing or problems:
        sys.exit('\nв данные ничего не записано: сначала чиним батчи.\n'
                 'Проверить ещё раз — тот же запуск с ключом --dry.')

    # ---------- раскладываем ----------
    os.makedirs(os.path.join(SITE, 'data', code), exist_ok=True)
    written = []

    # 1. файлы данных
    for name in ('projects', 'services', 'concepts', 'atlas', 'library', 'trust'):
        src = os.path.join(SITE, 'data', name + '.json')
        if not os.path.exists(src):
            continue
        data = json.load(open(src, encoding='utf-8'))
        for p, pt in got.items():
            head = p.split('/')[0]
            if want[p][0] != name:
                continue
            set_at(data, p, pt)
        rebuild_derived(name, data, json.load(open(src, encoding='utf-8')))
        if name == 'services':
            # разделы, которых в других языках не бывает (коды ОКПД2), убираем ПОСЛЕ
            # подстановки: до неё пути ещё считаются по русскому файлу
            drop_paths(data, ru_only_paths(json.load(open(src, encoding='utf-8'))))
        dst = os.path.join(SITE, 'data', code, name + '.json')
        with open(dst, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
            f.write('\n')
        written.append(os.path.relpath(dst, ROOT))

    # 2. словарь интерфейса: ключ — русская строка, как и в en.js
    ru_keys = list(load_dict('en').keys())
    dic = {}
    for p, pt in got.items():
        if p.startswith('dict/'):
            dic[ru_keys[int(p.split('/')[1])]] = pt
        elif p.startswith('dict+/'):
            # строки, которых в en.js не было вовсе: ключ — сама русская строка
            dic[want[p][1]] = pt
    dst = os.path.join(SITE, 'data/i18n/%s.js' % code)
    with open(dst, 'w', encoding='utf-8') as f:
        f.write('window.PD_I18N = ')
        json.dump(dic, f, ensure_ascii=False, indent=1)
        f.write(';\n')
    written.append(os.path.relpath(dst, ROOT))

    # 3. проза генератора — колонкой в общий файл
    pp = os.path.join(SITE, 'data/i18n/prose.json')
    prose = json.load(open(pp, encoding='utf-8'))
    for p, pt in got.items():
        if not p.startswith('prose/'):
            continue
        segs = p.split('/')[1:]
        key = segs[0]
        if key == 'nbsp_words':
            prose[key][code] = pt.split()
        elif len(segs) == 1:
            prose[key][code] = pt
        elif segs[1] == 'ru':                      # lib_ui/ru/<подпись>
            slot = prose[key].setdefault(code, {})
            slot[segs[2]] = pt.split(' | ') if ' | ' in pt else pt
        else:                                      # список: knows_about/<i>
            slot = prose[key].setdefault(code, [])
            i = int(segs[1])
            while len(slot) <= i:
                slot.append('')
            slot[i] = pt
    with open(pp, 'w', encoding='utf-8') as f:
        json.dump(prose, f, ensure_ascii=False, indent=1)
        f.write('\n')
    written.append(os.path.relpath(pp, ROOT))

    # 4. карточки превью
    cards = {}
    for p, pt in got.items():
        if not p.startswith('og/'):
            continue
        _, fname, idx = p.split('/')
        cards.setdefault(fname, ['', '', ''])[int(idx)] = pt
    if cards:
        d = os.path.join(SITE, 'data/i18n/og')
        os.makedirs(d, exist_ok=True)
        dst = os.path.join(d, code + '.json')
        with open(dst, 'w', encoding='utf-8') as f:
            json.dump(cards, f, ensure_ascii=False, indent=1)
            f.write('\n')
        written.append(os.path.relpath(dst, ROOT))

    print()
    print('записано:')
    for w in written:
        print('   ' + w)
    print()
    print('дальше: python3 build_seo.py, затем _tools/venv/bin/python _tools/og.py')


if __name__ == '__main__':
    main()
