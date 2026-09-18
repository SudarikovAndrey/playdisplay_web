#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Выгрузка всех переводимых строк сайта порциями — под перевод в ChatGPT.

    python3 _tools/i18n_export.py pt

Кладёт батчи в `_i18n/<язык>/in/<раздел>-NN.json`. Каждый батч самодостаточен:
в нём и инструкция переводчику, и русский оригинал, и УЖЕ СДЕЛАННЫЙ АНГЛИЙСКИЙ
перевод строки рядом.

Английский рядом — главное решение этого файла. Терминология студии уже улажена
на английском («экспозиция» → exhibition, а не exposition; «Ростех» → Rostec),
и переводчику незачем решать это заново на каждом батче. Плюс так видно, как
поступили с именами собственными и с длиной: перевод не должен вырасти вдвое,
иначе он не влезет в вёрстку.

Инструкция написана ПО-ПОРТУГАЛЬСКИ намеренно. Русская инструкция с русским
входом уже подводила: модель читала её как «оставь как есть» и возвращала
валидный JSON с непереведённым текстом — ошибки нет, в логе тишина
(записано в CLAUDE.md, раздел про промпт перевода карточки ассистента).

Обратно собирает `_tools/i18n_import.py`.
"""
import ast, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from i18n_check import scan_file

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, 'site')
CYR = re.compile('[а-яёА-ЯЁ]')
BATCH = 9000          # знаков русского текста на батч

# Языки, на которые умеем выгружать. Имя нужно только для инструкции переводчику.
TARGETS = {
    'pt': {'name': 'português do Brasil (pt-BR)', 'tag': 'pt-BR'},
}

# ---------- инструкция переводчику, на языке перевода ----------
HEAD = {'pt': '''INSTRUÇÕES — leia antes de traduzir.

1. Traduza para {name}. Não use português europeu: escreva "time", "ônibus",
   "tela", "arquivo", "celular", e use gerúndio como no Brasil.
2. Preencha APENAS o campo "pt" de cada item. Nunca altere "id", "path", "ru" ou "en".
3. O campo "ru" é o original. O campo "en" é a tradução inglesa já aprovada do
   MESMO texto: use-a como referência de terminologia, de nomes próprios e de
   comprimento. Onde "en" e "ru" divergirem, siga o "ru" quanto ao conteúdo e o
   "en" quanto aos termos.
4. Preserve exatamente: tags HTML (<p>, <b>, <h2>), marcadores de formato (%d, %s),
   quebras de linha, aspas tipográficas e números.
5. Nomes próprios seguem a versão inglesa: Rostec, Rosatom, VDNH, UEC.
   Não translitere de novo a partir do russo.
6. Não deixe NENHUM caractere cirílico na resposta.
7. Este é o site de um estúdio de experiências espaciais: museus, exposições
   interativas, centros de visitantes, showrooms. Escreva como o estúdio fala —
   direto, concreto, sem linguagem de catálogo publicitário.
8. Responda SOMENTE com o JSON completo deste arquivo, com o campo "pt" preenchido
   em todos os itens. Sem comentários antes ou depois.'''}


# ---------- что НЕ едет в другие языки ----------
# 1. Служебные заметки студии о том, как заполнять файл. В данных они выглядят как
#    обычный русский текст, но это не контент сайта: переводить их — платить за перевод
#    внутренней переписки и рисковать тем, что она окажется на странице.
# Путь отсчитывается ОТ КОРНЯ ФАЙЛА, а не от его имени, поэтому список задан по файлам.
SKIP_PREFIX = {
    'projects': ('meta',),   # откуда сняты данные и что значит поле wi
    'trust': ('note',),      # памятка: сканы не публикуем, здесь только суть
}
# Ключи, начинающиеся с подчёркивания (_comment, _комментарий), пропускаются по имени.
# Поле url — тоже: в projects.json лежат мёртвые адреса обложек со старого сайта,
# в них кириллица в пути (/work/судостроение/). Это адрес, а не текст.
SKIP_FIELDS = ('url',)

# 3. ПРОИЗВОДНЫЕ ПОЛЯ — их не переводят, их ВЫЧИСЛЯЮТ при сборке.
#    Одно и то же слово лежит в данных в нескольких местах и связывает их по значению:
#    у Атласа `cat` карточки — это ключ в catLabels и элемент cats; у концепций
#    catLabel обязан совпадать с подписью из cats. Переведи их по отдельности —
#    и «Принцип» станет где Princípio, где Princípios, а фильтр перестанет находить
#    карточки. Переводим ОДИН канонический список, остальное пересобирает импорт.
DERIVED = {
    'concepts': lambda j: {'concepts/%d/catLabel' % i
                           for i in range(len(j.get('concepts') or []))},
    'atlas': lambda j: {'items/%d/cat' % i for i in range(len(j.get('items') or []))},
}

# 2. Разделы, которые существуют ТОЛЬКО по-русски. Сейчас один: коды ОКПД2 на странице
#    мультимедийного оборудования. Классификатор российский, и в английской версии его
#    нет НАМЕРЕННО — это записано в CLAUDE.md как «не пропуск перевода, не доделывайте».
#    Ищем по заголовку, а не по номеру блока: файл ещё будут править, и номер съедет
#    молча, а заголовок либо найдётся, либо нет.
RU_ONLY_HEADINGS = ['Закупка: коды ОКПД2']


def ru_only_paths(data):
    """пути блоков flow, которые в другие языки не едут: от заголовка до следующего"""
    out, found = set(), set()
    for si, srv in enumerate(data.get('services') or []):
        flow = srv.get('flow') or []
        inside = False
        for bi, b in enumerate(flow):
            if b.get('t') == 'h':
                head = (b.get('text') or '').strip()
                inside = head in RU_ONLY_HEADINGS
                if inside:
                    found.add(head)
            if inside:
                out.add('services/%d/flow/%d' % (si, bi))
    missing = set(RU_ONLY_HEADINGS) - found
    if missing:
        sys.exit('не найден раздел «только для русского»: %s.\n'
                 'Либо заголовок переименовали, либо раздел убрали — правило надо '
                 'пересмотреть, а не игнорировать.' % ', '.join(sorted(missing)))
    return out


# ---------- обход данных ----------
def walk(node, path, out, skip=()):
    """собрать (путь, строка) для всех строк с кириллицей, минуя служебное"""
    p = '/'.join(path)
    if path and path[-1].startswith('_'):
        return
    if path and path[-1] in SKIP_FIELDS:
        return
    if any(p == s or p.startswith(s + '/') for s in skip):
        return
    if isinstance(node, str):
        if CYR.search(node):
            out.append((p, node))
    elif isinstance(node, dict):
        for k, v in node.items():
            walk(v, path + [str(k)], out, skip)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            walk(v, path + [str(i)], out, skip)


def at(node, path):
    """значение по пути из walk; None, если такого пути нет"""
    for seg in path.split('/'):
        if isinstance(node, dict):
            if seg not in node:
                return None
            node = node[seg]
        elif isinstance(node, list):
            i = int(seg)
            if i >= len(node):
                return None
            node = node[i]
        else:
            return None
    return node


# Ключи, которых у русского нет по существу: русская главная не собирается из шаблона,
# её мета-теги лежат в самой index.html. Для них оригинал показываем английский.
COPY_ONLY = ('prose/home_title', 'prose/home_desc', 'prose/home_keys',
             'prose/home_og_title', 'prose/llms_lang_line', 'prose/llms_projects_heading')


def item_note(path):
    """подсказка переводчику для строк, которые переводятся не как текст"""
    if path in COPY_ONLY:
        return ('O original aqui está em inglês: esta linha não existe em russo '
                '(a home russa não é montada a partir de modelo). Traduza do "ru", '
                'que neste item contém o texto inglês.')
    if '/keywords/' in path:
        return ('Consulta de busca, não frase corrida: escreva o que as pessoas '
                'realmente digitam no Brasil, em vez de traduzir palavra por palavra.')
    if path.startswith('prose/lib_ui/ru/') and path.rsplit('/', 1)[-1] in ('pos', 'man', 'kind'):
        return ('Formas de plural separadas por " | ". O russo tem três, o português tem '
                'duas: repita a forma plural na segunda e na terceira posição.')
    if path == 'prose/nbsp_words':
        return ('NÃO traduza. Escreva a lista equivalente em português: preposições, '
                'artigos e conjunções curtas que não devem ficar sozinhas no fim da '
                'linha (a, o, os, as, de, do, da, em, no, na, com, por, para, um, uma, '
                'e, ou, que, se, ao). Separe por espaços.')
    return None


# Строки, обёрнутые в перевод прямо в коде: PD_T('…') в сцене, T('…') на лендинге.
# Обёртка И ЕСТЬ пометка «это увидит человек» — отдельного списка держать не надо,
# и забыть внести строку в словарь невозможно: обернул — она сама приедет в выгрузку.
# Комментарии не трогаем: искать надо вызов, а не любую кириллицу рядом.
TCALL = re.compile(r"""(?<![A-Za-z0-9_$.])(?:PD_T|T)\(\s*(['"])((?:[^'"\\]|\\.)*?)\1""")


def wrapped_strings(paths):
    """русские строки, обёрнутые в PD_T()/T() в коде страниц"""
    out, seen = [], set()
    for rel in paths:
        full = os.path.join(SITE, rel)
        if not os.path.exists(full):
            continue
        src = open(full, encoding='utf-8').read()
        for m in TCALL.finditer(src):
            t = m.group(2).replace('\\n', ' ').replace("\\'", "'").replace('\\"', '"')
            t = ' '.join(t.split())
            if t and CYR.search(t) and t not in seen:
                seen.add(t)
                out.append(t)
    return out


def load_dict(code):
    """словарь site/data/i18n/<code>.js: русская строка → перевод"""
    p = os.path.join(SITE, 'data/i18n/%s.js' % code)
    raw = open(p, encoding='utf-8').read()
    return json.loads(raw.split('=', 1)[1].rsplit(';', 1)[0])


def og_cards():
    """тексты карточек превью из _tools/og.py, без импорта: там нужен Pillow.

    Берём разбором синтаксиса — у каждой карточки элементы 2..4 это надстрочник,
    заголовок и подпись, и все три записаны обычными строковыми литералами."""
    src = open(os.path.join(ROOT, '_tools', 'og.py'), encoding='utf-8').read()
    tree = ast.parse(src)
    got = {}
    for node in tree.body:
        if not isinstance(node, ast.Assign):
            continue
        name = getattr(node.targets[0], 'id', '')
        if name not in ('CARDS', 'CARDS_EN'):
            continue
        rows = []
        for el in node.value.elts:
            key = el.elts[0].value                       # имя файла — это ключ
            rows.append((key, [ast.literal_eval(x) for x in el.elts[2:5]]))
        got[name] = rows
    return got.get('CARDS', []), got.get('CARDS_EN', [])


# ---------- сбор разделов ----------
def collect(code):
    """[(раздел, [(путь, ru, en), ...]), ...] — всё, что надо перевести"""
    out = []

    # 1. проза генератора
    prose = json.load(open(os.path.join(SITE, 'data/i18n/prose.json'), encoding='utf-8'))
    items = []
    for key, v in prose.items():
        ru, en = v.get('ru'), v.get('en')
        if key == 'nbsp_words':
            # это не перевод, а список служебных слов ЯЗЫКА: предлоги и артикли,
            # которые приклеиваются к следующему слову неразрывным пробелом
            items.append(('prose/%s' % key, ' '.join(ru or []), ' '.join(en or [])))
            continue
        base = ru if ru is not None else en
        if isinstance(base, list):
            for i, s in enumerate(base):
                e = (en or [])[i] if isinstance(en, list) and i < len(en) else None
                items.append(('prose/%s/%d' % (key, i), s, e))
        elif isinstance(base, dict):                       # lib_ui: {ru:{...}, en:{...}}
            for k2, s in (ru or {}).items():
                e = (en or {}).get(k2)
                if isinstance(s, list):
                    items.append(('prose/%s/ru/%s' % (key, k2), ' | '.join(s),
                                  ' | '.join(e or [])))
                else:
                    items.append(('prose/%s/ru/%s' % (key, k2), s, e))
        else:
            items.append(('prose/%s' % key, base, en))
    out.append(('prose', items))

    # 2. словарь интерфейса: ключ словаря — сама русская строка.
    #
    # Берём не только то, что уже лежит в en.js, но и строки, которые ПОЯВИЛИСЬ
    # в разметке главной позже словаря. Иначе новый язык унаследовал бы дыры старого:
    # промах словаря не ошибка, строка просто остаётся русской, и ни сборка, ни браузер
    # об этом не скажут. На 18.09.2026 таких строк восемь — они же не переведены и на /en/.
    d = load_dict('en')
    items = [('dict/%d' % i, ru, en) for i, (ru, en) in enumerate(d.items())]
    extra, seen = [], set(d)
    for _kind, text in scan_file(os.path.join(SITE, 'index.html'), skip_meta=True):
        t = ' '.join(text.split())
        if t and t not in seen:
            seen.add(t)
            extra.append(t)
    # и строки, обёрнутые в перевод в коде лендинга и сцены
    for t in wrapped_strings(('index.html', 'hero-scene.html')):
        if t not in seen:
            seen.add(t)
            extra.append(t)
    items += [('dict+/%d' % i, t, None) for i, t in enumerate(extra)]
    if extra:
        print('(в разметке главной найдено строк без перевода даже в en.js: %d)' % len(extra))
    out.append(('dict', items))

    # 3. файлы данных
    for name in ('projects', 'services', 'concepts', 'atlas', 'library', 'trust'):
        ru_p = os.path.join(SITE, 'data', name + '.json')
        if not os.path.exists(ru_p):
            continue
        ru_j = json.load(open(ru_p, encoding='utf-8'))
        en_p = os.path.join(SITE, 'data/en', name + '.json')
        en_j = json.load(open(en_p, encoding='utf-8')) if os.path.exists(en_p) else {}
        found = []
        skip = set(SKIP_PREFIX.get(name, ()))
        if name == 'services':
            skip |= ru_only_paths(ru_j)
        if name in DERIVED:
            skip |= DERIVED[name](ru_j)
        walk(ru_j, [], found, skip)
        out.append((name, [(path, s, at(en_j, path)) for path, s in found]))

    # 4. карточки превью
    ru_c, en_c = og_cards()
    en_map = dict(en_c)
    items = []
    for key, vals in ru_c:
        ev = en_map.get(key, [None, None, None])
        for i, s in enumerate(vals):
            items.append(('og/%s/%d' % (key, i), s, ev[i] if i < len(ev) else None))
    out.append(('og', items))
    return out


def main():
    code = sys.argv[1] if len(sys.argv) > 1 else 'pt'
    if code not in TARGETS:
        sys.exit('не знаю язык %r; известны: %s' % (code, ', '.join(TARGETS)))
    tgt = TARGETS[code]
    base = os.path.join(ROOT, '_i18n', code)
    in_dir = os.path.join(base, 'in')
    os.makedirs(in_dir, exist_ok=True)
    os.makedirs(os.path.join(base, 'out'), exist_ok=True)

    index, total, files = {}, 0, 0
    for section, items in collect(code):
        items = [(p, ru, en) for p, ru, en in items if ru]
        # режем на порции по объёму русского текста, не по числу строк:
        # у библиотеки строки короткие, у концепций — абзацами
        chunks, cur, size = [], [], 0
        for it in items:
            if cur and size + len(it[1]) > BATCH:
                chunks.append(cur); cur, size = [], 0
            cur.append(it); size += len(it[1])
        if cur:
            chunks.append(cur)
        for n, chunk in enumerate(chunks, 1):
            fid = '%s-%02d' % (section, n)
            payload = {
                '_instrucoes': HEAD[code].format(name=tgt['name']),
                '_arquivo': '%s (%d de %d)' % (fid, n, len(chunks)),
                'idioma': tgt['tag'],
                'itens': [dict([('id', '%s#%03d' % (fid, i)), ('path', p), ('ru', ru),
                                ('en', en)]
                               + ([('nota', item_note(p))] if item_note(p) else [])
                               + [('pt', '')])
                          for i, (p, ru, en) in enumerate(chunk, 1)],
            }
            with open(os.path.join(in_dir, fid + '.json'), 'w', encoding='utf-8') as f:
                json.dump(payload, f, ensure_ascii=False, indent=1)
                f.write('\n')
            index[fid] = {'section': section, 'paths': [p for p, _, _ in chunk]}
            files += 1
        n_chars = sum(len(ru) for _, ru, _ in items)
        total += n_chars
        print('%-10s строк %5d   знаков %7d   батчей %d'
              % (section, len(items), n_chars, len(chunks)))

    with open(os.path.join(base, 'index.json'), 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
        f.write('\n')
    print('-' * 52)
    print('ИТОГО знаков %d, файлов %d → %s'
          % (total, files, os.path.relpath(in_dir, ROOT)))
    print('Переведённые файлы класть в %s' % os.path.relpath(os.path.join(base, 'out'), ROOT))


if __name__ == '__main__':
    main()
