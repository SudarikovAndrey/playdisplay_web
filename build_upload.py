#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Сборка пакета для загрузки на хостинг (timeweb).

Сайт живёт в site/, но на хостинге лежит в подпапке /new/ — поэтому пакет
нельзя просто скопировать: адреса в canonical, og:url и sitemap должны знать
о префиксе, а от индексации превью надо закрыть, иначе поисковики увидят
две версии одного сайта и выберут не ту.

Запуск:
    python3 build_upload.py                # превью:  https://playdisplay.com/new/  + noindex
    python3 build_upload.py --base /       # боевой:  https://playdisplay.com/      + индексация

Результат в deploy/:
    new/                          готовая папка — можно залить файловым менеджером
    playdisplay_new_full.zip      всё вместе, включая видео (~145 МБ)
    playdisplay_new_light.zip     без видео (~44 МБ) — если ролики на сервере уже лежат

Оба архива распаковываются БЕЗ верхней папки: содержимое кладётся прямо в /new/.
"""
import argparse, os, re, shutil, sys, zipfile

ROOT   = os.path.dirname(os.path.abspath(__file__))
SITE   = os.path.join(ROOT, 'site')
DEPLOY = os.path.join(ROOT, 'deploy')
OUT    = os.path.join(DEPLOY, 'new')
DOMAIN = 'https://playdisplay.com'

ap = argparse.ArgumentParser()
ap.add_argument('--base', default='/new/', help='префикс на сайте: /new/ (превью) или / (боевой)')
ap.add_argument('--index', action='store_true', help='разрешить индексацию даже для превью')
args = ap.parse_args()

base = '/' + args.base.strip('/') + '/' if args.base.strip('/') else '/'
staging = base != '/'
allow_index = args.index or not staging

print(f'сборка: {DOMAIN}{base}  индексация: {"да" if allow_index else "нет"}')

# ---- 1. чистая копия site/ ------------------------------------------------
if os.path.exists(OUT): shutil.rmtree(OUT)
os.makedirs(DEPLOY, exist_ok=True)
shutil.copytree(SITE, OUT, ignore=shutil.ignore_patterns('.DS_Store'))

def edit(rel, fn):
    """Правит файл в сборке. Молча пропускает отсутствующий — не все файлы обязательны."""
    p = os.path.join(OUT, rel)
    if not os.path.isfile(p): return False
    s = open(p, encoding='utf-8').read()
    s2 = fn(s)
    if s2 != s: open(p, 'w', encoding='utf-8').write(s2)
    return s2 != s

# ---- 2. адреса главной ---------------------------------------------------
# canonical и og:url говорят поисковику «настоящий адрес этой страницы».
# На превью это должен быть адрес превью, иначе вес уходит на чужую страницу.
def home_urls(s):
    s = s.replace(f'href="{DOMAIN}/"',    f'href="{DOMAIN}{base}"')
    s = s.replace(f'content="{DOMAIN}/"', f'content="{DOMAIN}{base}"')
    return s
print('  index.html: адреса', 'изменены' if edit('index.html', home_urls) else 'уже верные')

# ---- 3. индексация -------------------------------------------------------
ROBOTS_ON  = 'index,follow,max-image-preview:large'
ROBOTS_OFF = 'noindex,nofollow'
want = ROBOTS_ON if allow_index else ROBOTS_OFF

def robots_meta(s):
    return re.sub(r'(<meta name="robots" content=")[^"]*(")', r'\g<1>' + want + r'\g<2>', s)

pages = ['index.html'] + [f'work/{d}/index.html' for d in sorted(os.listdir(os.path.join(OUT, 'work')))
                          if os.path.isdir(os.path.join(OUT, 'work', d))]
changed = sum(1 for p in pages if edit(p, robots_meta))
print(f'  meta robots → {want}: правок {changed} из {len(pages)} страниц')

# ---- 4. sitemap и robots.txt --------------------------------------------
def sitemap(s):
    return s.replace(f'<loc>{DOMAIN}/', f'<loc>{DOMAIN}{base}')
edit('sitemap.xml', sitemap)

rp = os.path.join(OUT, 'robots.txt')
if allow_index:
    print('  robots.txt: оставлен как в site/ (индексация разрешена)')
else:
    open(rp, 'w', encoding='utf-8').write(
        '# Превью-версия сайта. Закрыта от индексации, чтобы не конкурировать\n'
        f'# с основным доменом. Боевая сборка: python3 build_upload.py --base /\n'
        'User-agent: *\nDisallow: /\n')
    print('  robots.txt: Disallow: / (превью закрыто)')

# ---- 5. каноникалы страниц кейсов ---------------------------------------
# В site/ они указывают на корень домена. На превью это тоже надо сдвинуть,
# иначе каждая страница кейса ссылается на несуществующий пока боевой адрес.
n = 0
for d in sorted(os.listdir(os.path.join(OUT, 'work'))):
    if edit(f'work/{d}/index.html', lambda s: s.replace(f'"{DOMAIN}/work/', f'"{DOMAIN}{base}work/')):
        n += 1
print(f'  canonical в страницах кейсов сдвинут: {n}')

# ---- 6. llms.txt --------------------------------------------------------
edit('llms.txt', lambda s: s.replace(f'{DOMAIN}/work/', f'{DOMAIN}{base}work/')
                            .replace(f'{DOMAIN}/sitemap.xml', f'{DOMAIN}{base}sitemap.xml'))

# ---- 7. архивы ----------------------------------------------------------
def make_zip(name, skip_videos):
    path = os.path.join(DEPLOY, name)
    if os.path.exists(path): os.remove(path)
    n = 0
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for dirpath, dirnames, filenames in os.walk(OUT):
            dirnames[:] = [d for d in dirnames if d != '__MACOSX']
            for f in sorted(filenames):
                if f == '.DS_Store': continue
                full = os.path.join(dirpath, f)
                rel = os.path.relpath(full, OUT)          # без верхней папки
                if skip_videos and rel.startswith('videos' + os.sep): continue
                z.write(full, rel); n += 1
    mb = os.path.getsize(path) / 1048576
    print(f'  {name}: {n} файлов, {mb:.0f} МБ')

make_zip('playdisplay_new_full.zip', skip_videos=False)
make_zip('playdisplay_new_light.zip', skip_videos=True)

print(f'\nготово: {os.path.relpath(DEPLOY, ROOT)}/')
print('залить содержимое архива в папку /new/ на хостинге (файлы кладутся в корень /new/, без вложенной папки)')
