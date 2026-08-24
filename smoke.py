#!/usr/bin/env python3
# Смоук-проверка сайта ПЕРЕД деплоем. Запуск: python3 smoke.py
#
# Зачем она появилась (24.08.2026). Тестов у сайта не было вовсе, а синхронных
# поколений страниц четыре: /, /en/, /work/*, /en/work/*. Всё, что расходилось,
# ловилось глазами и не сразу. Список того, что реально ломалось и что теперь
# проверяется автоматически:
#
#   • assets/andrey-sudarikov.jpg отдавал 404 с самого переезда в корень — портрет
#     основателя месяцами подменялся монограммой, и никто не замечал;
#   • /en/index.html отставала от русской главной на 50 КБ и несколько поставок,
#     потому что забыли прогнать build_seo.py;
#   • у кейса mig2019 в CASES стоял ролик и постер СОСЕДНЕГО кейса (odk-oak) —
#     копипаста, которую видно только если открыть страницу и узнать чужой кадр;
#   • восемь картинок vdnh-space вели на .gif, которого на диске нет.
#
# Принцип: проверяем ФАЙЛЫ НА ДИСКЕ, а не живой сайт. Так проверка работает без
# сети и до деплоя, то есть может остановить поставку, а не сообщить о поломке
# после неё. Живой сайт проверяется отдельным ключом --live.
#
# ПОБОЧНЫЙ ЭФФЕКТ, о котором надо знать: проверка свежести сборки ПРОГОНЯЕТ
# build_seo.py, а он пишет в site/. То есть смоук не только жалуется, но и
# приводит сгенерированное в порядок — после красного прогона в git status
# появятся изменения, и это нормально, их надо закоммитить.
#
# Зависимостей нет: только стандартная библиотека. Разбор HTML регулярками, а не
# парсером, сознательно — ставить lxml ради шести проверок значит завести сборку
# там, где её нет.
import json, os, re, subprocess, sys, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(ROOT, 'site')
LIVE = '--live' in sys.argv
BASE = 'https://playdisplay.com'

fails, warns = [], []
def bad(where, what):  fails.append('%s: %s' % (where, what))
def warn(where, what): warns.append('%s: %s' % (where, what))


# ---------------------------------------------------------------- 1. sitemap
def sitemap_urls():
    p = os.path.join(SITE, 'sitemap.xml')
    if not os.path.exists(p):
        bad('sitemap.xml', 'файла нет'); return []
    return re.findall(r'<loc>([^<]+)</loc>', open(p, encoding='utf-8').read())


def url_to_file(u):
    """адрес из sitemap → путь к файлу на диске"""
    tail = u[len(BASE):].lstrip('/')
    if tail == '' or tail.endswith('/'):
        return os.path.join(SITE, tail, 'index.html')
    return os.path.join(SITE, tail)


# ---------------------------------------------------------------- 2. страницы
# Проверки на страницу. Ровно один <h1> — не придирка: на SPA-главной их три
# (герой, вьюер, карточка), и это известное исключение, поэтому главная и /en/
# из этой проверки выведены явно, а не тем, что она мягкая.
SPA = ('/index.html', '/en/index.html')

def check_page(u, path):
    name = u[len(BASE):] or '/'
    if not os.path.exists(path):
        bad(name, 'файла нет на диске: %s' % os.path.relpath(path, ROOT)); return
    html = open(path, encoding='utf-8', errors='replace').read()

    t = re.search(r'<title>(.*?)</title>', html, re.S)
    if not t or not t.group(1).strip():
        bad(name, 'пустой или отсутствующий <title>')

    d = re.search(r'<meta name="description" content="([^"]*)"', html)
    if not d or not d.group(1).strip():
        bad(name, 'нет описания (meta description)')
    elif len(d.group(1)) > 350:
        warn(name, 'описание длиннее 350 знаков — в выдаче обрежется')

    if not any(path.endswith(s.replace('/', os.sep)) for s in SPA):
        n = len(re.findall(r'<h1[\s>]', html))
        if n != 1:
            bad(name, 'заголовков <h1>: %d, должен быть ровно один' % n)

    c = re.search(r'<link rel="canonical" href="([^"]+)"', html)
    if not c:
        bad(name, 'нет canonical')
    elif c.group(1).rstrip('/') != u.rstrip('/'):
        bad(name, 'canonical ведёт не на себя: %s' % c.group(1))

    # Иконка вкладки. До 16.08.2026 её не было ни на одной странице.
    if 'rel="icon"' not in html:
        bad(name, 'нет иконки вкладки (rel="icon")')

    # Локальные картинки и скрипты: чего нет на диске, того не будет и на сайте.
    #
    # <base href="/"> обязателен к учёту, иначе проверка врёт. На /en/index.html он
    # стоит именно для того, чтобы относительные пути считались ОТ КОРНЯ САЙТА, а не
    # от папки страницы: английская главная — копия русской, и переписывать в ней все
    # пути было бы лишней работой. Без этой поправки проверка объявила битыми
    # тридцать восемь живых файлов — первый же прогон это и показал.
    base = re.search(r'<base\s+href="([^"]+)"', html)
    page_dir = os.path.join(SITE, base.group(1).strip('/')) if base else os.path.dirname(path)
    for m in re.finditer(r'(?:src|href)="([^"#?:]+\.(?:jpg|jpeg|png|webp|svg|css|js|ico|mp4|woff2))', html):
        ref = m.group(1)
        cand = os.path.join(SITE, ref.lstrip('/')) if ref.startswith('/') else os.path.join(page_dir, ref)
        if not os.path.exists(cand):
            bad(name, 'битая ссылка на файл: %s' % ref)


# ---------------------------------------------------------------- 3. данные кейсов
def check_cases():
    """Ролики и постеры кейсов: существуют ли, и не делят ли два кейса один файл.

    Второе — не паранойя. Именно так у mig2019 оказался ролик odk-oak: строку
    соседнего кейса скопировали и поменяли только slug, title и обложку."""
    idx = open(os.path.join(SITE, 'index.html'), encoding='utf-8').read()
    seen = {}
    for m in re.finditer(r'slug:"([a-z0-9-]+)"', idx):
        slug = m.group(1)
        line = idx[idx.rfind('\n', 0, m.start()) + 1: idx.find('\n', m.end())]
        lm = re.search(r'local:"([^"]+)"', line)
        pm = re.search(r'lposter:AW\+"([^"]+)"', line)
        if not lm:
            continue
        v = lm.group(1)
        for f in (v, v.replace('.mp4', '-m.mp4')):
            if not os.path.exists(os.path.join(SITE, f)):
                bad('кейс %s' % slug, 'нет файла %s' % f)
        if pm and not os.path.exists(os.path.join(SITE, 'assets/work', pm.group(1))):
            bad('кейс %s' % slug, 'нет постера %s' % pm.group(1))
        if v in seen:
            bad('кейс %s' % slug, 'тот же ролик, что у %s: %s' % (seen[v], v))
        seen[v] = slug


def check_data():
    """Русский и английский наборы данных обязаны совпадать по составу."""
    ru = json.load(open(os.path.join(SITE, 'data/projects.json'), encoding='utf-8'))['projects']
    en = json.load(open(os.path.join(SITE, 'data/en/projects.json'), encoding='utf-8'))['projects']
    rs, es = [p['slug'] for p in ru], [p['slug'] for p in en]
    if rs != es:
        bad('данные', 'состав кейсов ru и en расходится: %s' % (set(rs) ^ set(es)))
    for p in ru:
        r = p.get('result')
        if r and not (r.get('text') or r.get('figures')):
            bad('кейс %s' % p['slug'], 'result есть, но пустой')
    # Ролики и постеры из ленты
    for path in ('data/projects.json', 'data/en/projects.json'):
        d = json.load(open(os.path.join(SITE, path), encoding='utf-8'))
        for p in d['projects']:
            for b in p.get('flow') or []:
                for key in ('src', 'poster'):
                    f = b.get(key)
                    if isinstance(f, str) and f.startswith(('videos/', 'assets/')):
                        if not os.path.exists(os.path.join(SITE, f)):
                            bad('%s %s' % (path, p['slug']), 'нет файла %s' % f)
                        if f.endswith('.mp4') and not os.path.exists(
                                os.path.join(SITE, f.replace('.mp4', '-m.mp4'))):
                            bad('%s %s' % (path, p['slug']), 'нет мобильной копии %s' % f)


# ---------------------------------------------------------------- 4. сборка свежая
def check_build_current():
    """build_seo.py не должен ничего менять: если меняет — забыли прогнать.

    Ровно так /en/ отстала от главной на несколько поставок. Проверяем через git:
    прогоняем сборку и смотрим, не появилось ли изменений."""
    if not os.path.isdir(os.path.join(ROOT, '.git')):
        warn('сборка', 'не git-репозиторий, свежесть не проверить'); return
    before = subprocess.run(['git', 'status', '--porcelain', 'site'], cwd=ROOT,
                            capture_output=True, text=True).stdout
    r = subprocess.run([sys.executable, 'build_seo.py'], cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0:
        bad('сборка', 'build_seo.py упал: %s' % (r.stderr.strip().splitlines() or ['?'])[-1]); return
    after = subprocess.run(['git', 'status', '--porcelain', 'site'], cwd=ROOT,
                           capture_output=True, text=True).stdout
    if after != before:
        # Имена берём из ОБЪЕДИНЕНИЯ разниц в обе стороны: файл мог не появиться в
        # списке, а сменить статус (был ' M', стал 'M '), и односторонняя разница
        # тогда пуста — сообщение выходило без имён вовсе.
        moved = (set(after.splitlines()) ^ set(before.splitlines()))
        names = sorted({x[3:].strip() for x in moved}) or ['(не удалось назвать)']
        bad('сборка', 'build_seo.py изменил файлы — значит его забыли прогнать: %s'
            % ', '.join(names[:5]))
        # ВАЖНО: сборка уже прогнана, файлы на диске УЖЕ обновлены. То есть проверка
        # не только пожаловалась, но и починила — осталось закоммитить. Молчать об
        # этом нельзя: иначе человек увидит непонятные изменения в git status.
        print('  ! сборка прогнана, файлы на диске обновлены — их надо закоммитить')


# ---------------------------------------------------------------- 5. обязательное
def check_required():
    for f in ('favicon.ico', 'assets/logos/favicon-32.png', 'assets/logos/favicon-180.png',
              'assets/andrey-sudarikov.jpg', 'assets/fonts/fonts.css',
              'assets/vendor/three-r128/three.min.js', 'robots.txt', 'llms.txt'):
        if not os.path.exists(os.path.join(SITE, f)):
            bad('обязательные файлы', 'нет %s' % f)
    # Внешние зависимости на первом экране. Их убрали 15.08.2026 — если вернутся,
    # первый экран снова начнёт зависеть от чужих серверов.
    for f in ('index.html', 'hero-scene.html'):
        html = open(os.path.join(SITE, f), encoding='utf-8').read()
        for host in ('cdnjs.cloudflare.com', 'unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'):
            if re.search(r'(?:src|href)="https?://%s' % re.escape(host), html):
                bad(f, 'вернулась внешняя зависимость: %s' % host)


# ---------------------------------------------------------------- 6. живой сайт
def check_live(urls):
    for u in urls:
        try:
            rq = urllib.request.Request(u, headers={'User-Agent': 'pd-smoke/1'})
            with urllib.request.urlopen(rq, timeout=30) as r:
                if r.status != 200:
                    bad('живой %s' % u, 'код %d' % r.status)
        except urllib.error.HTTPError as e:
            bad('живой %s' % u, 'код %d' % e.code)
        except Exception as e:
            bad('живой %s' % u, 'не открылся: %s' % e)


# ---------------------------------------------------------------- запуск
urls = sitemap_urls()
print('Смоук-проверка: адресов в sitemap %d%s' % (len(urls), ', плюс живой сайт' if LIVE else ''))

for u in urls:
    check_page(u, url_to_file(u))
check_cases()
check_data()
check_required()
check_build_current()
if LIVE:
    check_live(urls)

print()
if warns:
    print('Замечания (%d):' % len(warns))
    for w in warns[:20]:
        print('  ~ %s' % w)
    if len(warns) > 20:
        print('  ~ … и ещё %d' % (len(warns) - 20))
    print()
if fails:
    print('ОШИБКИ (%d):' % len(fails))
    for f in fails[:40]:
        print('  ✗ %s' % f)
    if len(fails) > 40:
        print('  ✗ … и ещё %d' % (len(fails) - 40))
    print()
    print('Деплоить нельзя.')
    sys.exit(1)

print('Всё сходится. Проверено: страницы, кейсы, данные, обязательные файлы, свежесть сборки.')
