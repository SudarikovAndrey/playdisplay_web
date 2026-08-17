#!/usr/bin/env python3
"""ШТАМП ВЕРСИИ НА ФАЙЛЫ КИТА.

Зачем нужен, замером и по факту поломки 17.08.2026: статику на боевом хостинге отдаёт
nginx НАПРЯМУЮ, минуя Apache, и ставит своё `cache-control: max-age=31536000` — год.
Правила mod_expires в site/.htaccess до него не доходят вовсе (это уже записано там же в
комментарии). Значит браузер, один раз открывший страницу, ГОД держит старый css и js.

Как это выглядело: после поставки страница компреда открылась «съехавшей» — логотипы
столбиком, кнопка без стиля. Вёрстка была цела, просто до браузера доехал старый
components.css, в котором ещё нет ни .lockup, ни .to-full.

Лекарство то же, что главная страница уже применяет через build_seo.py: у изменившегося
файла должен меняться АДРЕС. Скрипт дописывает `?v=<8 знаков хеша содержимого>` ко всем
ссылкам на kit/css и kit/js в страницах, которые кит подключают.

Запуск: python3 site/kit/stamp.py   (без аргументов, из любой папки)
Вызывается сам из deploy.sh перед коммитом — держать это ручной ступенью нельзя, её
однажды забудут, и поломка вернётся молча.
"""

import hashlib
import io
import pathlib
import re
import sys

SITE = pathlib.Path(__file__).resolve().parent.parent
KIT = SITE / 'kit'

# Ссылка на файл кита: любой путь, заканчивающийся на kit/<css|js>/<имя>, с версией или без
LINK = re.compile(r'((?:\.\./)*(?:\./)?kit/(?:css|js)/[A-Za-z0-9_.-]+\.(?:css|js))(\?v=[0-9a-f]+)?')


def digest(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:8]


def pages():
    for p in sorted(SITE.rglob('*.html')):
        if '_ARCHIVE' in p.parts:
            continue
        yield p


def stamp(page: pathlib.Path) -> int:
    text = io.open(page, encoding='utf-8').read()
    changed = [0]
    missing = []

    def repl(m):
        rel = m.group(1)
        name = rel.split('kit/', 1)[1]          # css/components.css
        target = KIT / name
        if not target.exists():
            missing.append(rel)
            return m.group(0)
        new = rel + '?v=' + digest(target)
        if new != m.group(0):
            changed[0] += 1
        return new

    out = LINK.sub(repl, text)
    if missing:
        print('  ВНИМАНИЕ, файла нет: ' + ', '.join(sorted(set(missing))))
    if changed[0]:
        io.open(page, 'w', encoding='utf-8').write(out)
    return changed[0]


def main():
    total = 0
    for page in pages():
        n = stamp(page)
        if n:
            total += n
            print('  %s — обновлено ссылок: %d' % (page.relative_to(SITE), n))
    print('штамп версий: изменено ссылок %d' % total if total else 'штамп версий: всё уже свежее')
    return 0


if __name__ == '__main__':
    sys.exit(main())
