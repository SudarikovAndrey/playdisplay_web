#!/usr/bin/env python3
# Генерирует SEO-обвязку сайта playdisplay ДЛЯ ВСЕХ ЯЗЫКОВ:
#  - статические индексируемые страницы /work/<slug>/ и /en/work/<slug>/ (полный текст проекта)
#  - /en/index.html — копия главной с англоязычными мета-тегами, base, SEO-блоком и словарём
#  - sitemap.xml (обе версии + hreflang), robots.txt, llms.txt
#  - JSON-LD + noscript для русской главной (вставляется между маркерами <!--SEO-->…<!--/SEO-->)
#
# Запуск: python3 build_seo.py — и всё. Промежуточных файлов и ручных ступеней нет:
# кейсы скрипт читает прямо из массива CASES в site/index.html, SEO-блок вставляет сам.
#
# Как устроено двуязычие: русский текст лежит прямо в site/index.html и site/data/*.json.
# Английский приходит словарём site/data/i18n/en.js («русская строка» → «перевод») и
# отдельными файлами данных site/data/en/*.json. Страница /en/ — сгенерированная копия
# главной. Добавить португальский = положить data/i18n/pt.js + data/pt/*.json и вписать
# язык в LANGS здесь и в LANGS в index.html.
#
# Запуск: python3 build_seo.py
import json, os, re, html, hashlib

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(ROOT, 'site')
# КАНОНИЧЕСКИЙ ДОМЕН — одна строка на весь SEO: canonical, hreflang, og:url, sitemap,
# robots, llms, JSON-LD и все страницы работ и услуг считаются от него.
#
# История, чтобы её не переигрывали заново. 19.08.2026 канон срочно перевели на .ru:
# истёкший playdisplay.com регистратор увёл на парковку dnsproxy1/2.fm.nic.ru, и пока
# каноническим был .com, живой .ru перебрасывал посетителя на мёртвый домен — лежал
# весь сайт целиком. 21.08.2026 канон возвращён на .com по решению владельца: домен
# восстановлен, NS снова у timeweb, сертификаты на .com и www.com действуют.
# Возврат сделан на второй день после заплатки НАМЕРЕННО: на .ru за это время
# практически ничего не склеилось, и переигрывать нечего. Чем позже, тем дороже.
#
# ЦЕНА ЭТОГО РЕШЕНИЯ, записана прямо здесь. Пока .ru отдаёт 301 на .com, смерть .com
# роняет сайт целиком, включая .ru и закрытые презентации. Конфигом это не лечится:
# Apache не умеет узнать, что домен снят с делегирования. Лечится только тем, что
# .com не должен истекать — автопродление у регистратора и оплата на несколько лет
# вперёд. Если от этой зависимости решат избавиться, менять надо не BASE, а правило
# канонизации в site/.htaccess: перестать перебрасывать .ru и оставить его жить с
# canonical на .com. Тогда падение .com теряет сайт из выдачи, но не из сети.
BASE = 'https://playdisplay.com'


# ---------- отпечаток общих файлов: styles.css и analytics.js ----------
# Найдено 16.08.2026 замером боевого сайта. Статику отдаёт НЕ Apache, а nginx
# напрямую, поэтому mod_expires из site/.htaccess для неё не исполняется вовсе:
# nginx ставит свой Cache-Control: max-age=31536000 — ГОД. Проверяется так:
#     curl -sI https://playdisplay.com/styles.css | grep -i cache-control
# Следствие: у всех, кто заходил раньше, старые styles.css и analytics.js лежат
# в кэше год, и правка до них не доедет. Для analytics.js это особенно скверно —
# именно там чинили загрузку счётчика и добавляли уважение Do Not Track.
#
# Лечится единственным способом, который нам доступен: разным адресом. Версию
# берём ХЕШЕМ СОДЕРЖИМОГО, а не датой и не числом руками. Причина ровно та же,
# по которой отсюда убрали /tmp/cases.json: ступень, которую надо помнить, однажды
# не делают. Хеш меняется сам и ровно тогда, когда файл действительно изменился —
# не изменился, значит и кэш сбрасывать незачем.
def asset_v(name):
    """?v=<8 знаков хеша> для файла из site/. Пустая строка, если файла нет."""
    p = os.path.join(SITE, name)
    if not os.path.exists(p):
        return ''
    return '?v=' + hashlib.sha1(open(p, 'rb').read()).hexdigest()[:8]


# Список, а не переменная на каждый файл: следующему файлу, которому понадобится
# отпечаток, хватит одной строки, и его не забудут проставить в трёх местах.
# Иконки тоже здесь: nginx кэширует их год, а меняются они редко, но метко.
# /favicon.ico намеренно НЕ в списке — его браузеры просят вслепую, не читая
# разметку, и версия в адресе до них всё равно не доедет.
STAMPED = [
    'styles.css',
    'analytics.js',
    'assets/logos/favicon-32.png',
    'assets/logos/favicon-180.png',
]
VERSIONS = {name: asset_v(name) for name in STAMPED}


def stamp_assets(text, up=''):
    """проставить отпечаток ссылкам на файлы из STAMPED

    Заменяем ВМЕСТЕ со старым ?v=…, иначе от прошлой сборки останется хвост и
    адрес перестанет меняться. Префикс перед именем сохраняем каким был: у страниц
    работ это «../../», у иконок — ведущий «/» от корня домена."""
    for name in STAMPED:
        pat = r'(["\'])((?:\.\./)*|/)?' + re.escape(name) + r'(\?v=[^"\']*)?\1'
        text = re.sub(
            pat,
            lambda m, n=name: '%s%s%s%s%s' % (m.group(1), m.group(2) or '', n, VERSIONS[n], m.group(1)),
            text)
    return text
ORG_DESC = ('playdisplay проектирует пространства и впечатления, которые люди запоминают: '
            'современные музеи, интерактивные экспозиции, visitor centre, шоурумы и '
            'иммерсивные выставки. Превращаем идею, историю или бренд в опыт, который хочется пережить.')
ORG_DESC_EN = ('playdisplay designs spaces and experiences people remember: contemporary museums, '
               'interactive exhibits, visitor centres, showrooms and immersive exhibitions. '
               'We turn ideas, stories, spaces and brands into experiences people want to be part of.')
SOCIALS = [
    'https://www.facebook.com/playdisplay/',
    'https://vimeo.com/playdisplay5',
    'https://www.instagram.com/play.display/',
    'https://www.youtube.com/channel/UCVSeH8Y8m-_OLTm5coboICQ',
]

# ---------- языки ----------
# code: код языка; prefix: путь от корня сайта; data: папка данных; up: сколько уровней до корня
#                                                                     со страницы work/<slug>/
LANGS = [
    {'code': 'ru', 'prefix': '', 'data': 'data', 'locale': 'ru_RU', 'up': '../../'},
    {'code': 'en', 'prefix': 'en/', 'data': 'data/en', 'locale': 'en_US', 'up': '../../../'},
]

# ---------- кейсы: читаем прямо из index.html ----------
# Раньше скрипту нужен был /tmp/cases.json, выложенный руками: кто-то должен был
# выдернуть массив CASES из index.html и сохранить его в JSON. Шаг, который надо
# ПОМНИТЬ, рано или поздно не делают — и не сделали: 03.08.2026 обнаружилось, что
# /en/index.html отстала от главной на 50 КБ и несколько поставок, а ассистент на
# английской версии остался прошлого поколения. Теперь источник один — сам массив
# CASES, единственная правда о кейсах на сайте. Промежуточного файла больше нет.
#
# Массив написан на JS: ключи без кавычек, пути склеены из констант (AW+"…", IMG+"…").
# Разбираем его посимвольно, а не регулярками, потому что внутри строк попадается
# и «https://», и запятые, и двоеточия — regexp на таком материале ломается тихо.

def _js_array_to_json(src, consts):
    """JS-литерал массива → строка JSON. Внутри строк ничего не меняем."""
    out, i, n = [], 0, len(src)

    def read_string(pos):
        """вернуть (содержимое без кавычек, позиция после закрывающей кавычки)"""
        j = pos + 1
        while j < n:
            if src[j] == '\\':
                j += 2
                continue
            if src[j] == '"':
                return src[pos + 1:j], j + 1
            j += 1
        raise ValueError('незакрытая строка в CASES на позиции %d' % pos)

    def skip_blank(pos):
        while pos < n:
            if src[pos] in ' \t\r\n':
                pos += 1
            elif src.startswith('//', pos):
                nl = src.find('\n', pos)
                pos = n if nl < 0 else nl
            else:
                break
        return pos

    while i < n:
        c = src[i]
        if c == '"':
            body, i = read_string(i)
            out.append('"' + body + '"')
            continue
        # AW+"путь" → "assets/work/путь": константы подставляем сразу
        m = re.match(r'(%s)\s*\+\s*(?=")' % '|'.join(consts), src[i:]) if consts else None
        if m:
            body, i = read_string(i + m.end())
            out.append('"' + consts[m.group(1)] + body + '"')
            continue
        # ключ без кавычек: task: → "task":
        m = re.match(r'([A-Za-z_$][\w$]*)\s*:', src[i:])
        if m:
            out.append('"%s":' % m.group(1))
            i += m.end()
            continue
        if src.startswith('//', i):
            nl = src.find('\n', i)
            i = n if nl < 0 else nl
            continue
        if c == ',':
            # висячая запятая перед } или ] — в JSON её быть не может
            nxt = skip_blank(i + 1)
            i += 1
            if nxt < n and src[nxt] in '}]':
                continue
            out.append(',')
            continue
        out.append(c)
        i += 1
    return ''.join(out)


def read_cases():
    src = open(os.path.join(SITE, 'index.html'), encoding='utf-8').read()
    consts = dict(re.findall(r'var\s+(AW|IMG)\s*=\s*"([^"]*)"', src))
    head = 'var CASES = ['
    start = src.find(head)
    if start < 0:
        raise SystemExit('в site/index.html не найден массив CASES — SEO собирать не из чего')
    # конец массива ищем по балансу скобок, пропуская строки: в описаниях есть и «[», и «]»
    i = start + len(head) - 1
    depth, in_str = 0, False
    while i < len(src):
        ch = src[i]
        if in_str:
            if ch == '\\':
                i += 2
                continue
            if ch == '"':
                in_str = False
        elif ch == '"':
            in_str = True
        elif ch in '[{':
            depth += 1
        elif ch in ']}':
            depth -= 1
            if depth == 0:
                break
        i += 1
    else:
        raise SystemExit('массив CASES в site/index.html не закрыт')
    data = json.loads(_js_array_to_json(src[start + len(head) - 1:i + 1], consts))
    # Проверяем то, без чего страницы получатся битыми, — и падаем громко.
    # Тихо собранный неправильный sitemap хуже, чем несобранный.
    for c in data:
        for k in ('slug', 'title', 'desc'):
            if not c.get(k):
                raise SystemExit('в кейсе %r нет поля %s' % (c.get('title') or c.get('slug'), k))
    return data


CASES_LIST = read_cases()
cases = {c['slug']: c for c in CASES_LIST}
ORDER = [c['slug'] for c in CASES_LIST]


def load_dict(code):
    """словарь «русская строка» → перевод из site/data/i18n/<code>.js"""
    if code == 'ru': return {}
    p = os.path.join(SITE, 'data/i18n/%s.js' % code)
    if not os.path.exists(p): return {}
    raw = open(p, encoding='utf-8').read()
    return json.loads(raw.split('=', 1)[1].rsplit(';', 1)[0])


def esc(t): return html.escape(t or '', quote=True)


class Lang:
    """всё, что нужно, чтобы собрать страницы одного языка"""
    def __init__(self, spec):
        self.__dict__.update(spec)
        self.pmap = {p['slug']: p for p in
                     json.load(open(os.path.join(SITE, self.data, 'projects.json'), encoding='utf-8'))['projects']}
        self.dic = load_dict(self.code)

    def t(self, s):
        """перевод строки интерфейса; для русского — она же"""
        if not s or self.code == 'ru': return s
        return self.dic.get(s, self.dic.get(re.sub(r'\s+', ' ', s).strip(), s))

    def url(self, tail=''):
        return '%s/%s%s' % (BASE, self.prefix, tail)

    # Обрыв описания посреди слова — 21.08.2026. Резали ровно по 157 знаков, и в
    # сниппете выдачи выходило «раскрыл свою уникальную архитектуру и х…». Так было на
    # всех 30 страницах работ: описание — единственный текст, который человек читает
    # ДО перехода, и обрубок в нём стоит клика. Режем по границе слова, а висящий
    # предлог или союз в конце отбрасываем — «и…» не несёт смысла, но занимает место.
    HANGING = {'и', 'а', 'но', 'в', 'во', 'на', 'с', 'со', 'для', 'по', 'из', 'от', 'к',
               'о', 'об', 'у', 'за', 'до', 'при', 'над', 'под', 'что', 'как', 'чтобы',
               'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for',
               'with', 'by', 'from', 'that', 'as'}

    @classmethod
    def _clip(cls, d, limit=158):
        """описание не длиннее limit, обрыв — по границе слова"""
        if len(d) <= limit:
            return d
        cut = d[:limit - 1]
        sp = cut.rfind(' ')
        if sp > 0:
            cut = cut[:sp]
        words = cut.split()
        while words and words[-1].strip('.,;:!?()«»"\'').lower() in cls.HANGING:
            words.pop()
        cut = ' '.join(words).rstrip(' ,;:.–—-')
        return (cut + '…') if cut else d[:limit - 1] + '…'

    def meta_desc(self, slug):
        c = cases.get(slug, {}); p = self.pmap.get(slug, {})
        # ЦИФРА ПЕРВОЙ, если она есть (22.08.2026). Описание — единственный текст,
        # который человек читает ДО перехода, и в выдаче его сканируют, а не читают.
        # «2 млн посетителей за восемь месяцев» останавливает взгляд, «Отрасль, которую
        # можно рассмотреть вблизи» — нет. Берём главную цифру из result.figures: она
        # про аудиторию заказчика, а не про нашу производительность.
        fig = ((p.get('result') or {}).get('figures') or [])
        head = ('%s %s.' % (fig[0]['n'], fig[0]['label'])) if fig else ''
        parts = [head, self.t(c.get('punch')), p.get('goal') or self.t(c.get('desc'))]
        d = ' '.join(x for x in parts if x)
        d = re.sub(r'\s+', ' ', d).strip()
        return self._clip(d)


def cover_url(slug, pmap):
    c = cases.get(slug, {})
    img = c.get('img') or ''
    if img.startswith('http'): return img
    if not img: return pmap[slug].get('cover') or ''
    # в CASES путь уже полный («assets/work/...»), второй префикс давал
    # /assets/work/assets/work/... — картинка соцсетей не открывалась
    return BASE + '/' + img.lstrip('/')


# ---------- статические страницы проектов ----------
MISSING = []   # картинки, которых нет на диске: печатаем списком в конце сборки


def render_flow(L, p, slug):
    out = []
    if p.get('goal'): out.append('<section><h2>%s</h2><p>%s</p></section>' % (L.t('Цель проекта'), esc(p['goal'])))
    if p.get('solution'): out.append('<section><h2>%s</h2><p>%s</p></section>' % (L.t('Решение'), esc(p['solution'])))
    for b in p.get('flow', []):
        t = b['t']
        if t == 'h': out.append('<h2>%s</h2>' % esc(b['text']))
        elif t == 'p': out.append('<p>%s</p>' % esc(b['text']))
        elif t == 'steps':
            out.append('<ol class="steps">' + ''.join('<li>%s</li>' % esc(i) for i in b['items']) + '</ol>')
        elif t == 'notes':
            out.append('<ol class="notes">' + ''.join('<li>%s</li>' % esc(i) for i in b['items']) + '</ol>')
        elif t == 'stats':
            out.append('<ul class="stats">' + ''.join('<li><b>%s</b> %s</li>' % (esc(i['n']), esc(i['label'])) for i in b['items']) + '</ul>')
        elif t == 'img':
            for u in b['src']:
                fn = u.split('/')[-1]
                local = 'assets/work/%s/%s' % (slug, fn)
                cand = os.path.join(SITE, local)
                # png мог быть пережат в jpg
                if not os.path.exists(cand) and local.endswith('.png') and os.path.exists(cand[:-4] + '.jpg'):
                    local = local[:-4] + '.jpg'
                    cand = os.path.join(SITE, local)
                # gif из Behance у нас лежит как mp4 с кадром-постером: в данных остался
                # .gif, на диске — <имя>.mp4 и <имя>_poster.jpg. Замер 21.08.2026 показал
                # 8 таких битых картинок на страницах vdnh-space (русской и английской).
                if not os.path.exists(cand) and local.endswith('.gif'):
                    poster = local[:-4] + '_poster.jpg'
                    if os.path.exists(os.path.join(SITE, poster)):
                        local, cand = poster, os.path.join(SITE, poster)
                # ЧЕГО НЕТ НА ДИСКЕ — НЕ ВЫВОДИМ. Раньше <img> печатался всегда, и на
                # mig2019 уезжало пять ссылок на файлы, которых нет ни у нас, ни в
                # источнике (проверено: 404 и на боевом). Битая картинка хуже
                # отсутствующей: она видна посетителю и портит оценку страницы.
                if not os.path.exists(cand):
                    MISSING.append('%s/%s: %s' % (L.code, slug, fn))
                    continue
                out.append('<img src="%s%s" alt="%s — %s" loading="lazy">' % (L.up, local, esc(p['title']), esc(p.get('subtitle') or '')))
        elif t in ('yt', 'vimeo'):
            url = ('https://www.youtube.com/watch?v=' + b['id']) if t == 'yt' else ('https://vimeo.com/' + b['id'])
            out.append('<p><a href="%s" rel="noopener">%s</a></p>' % (url, L.t('Смотреть видео проекта →')))
    # РЕЗУЛЬТАТ — последним разделом страницы. Аудит 15.08.2026: блока результата не
    # было ни в одном из 15 кейсов, а для продажи музея это главный отсутствующий
    # текст. Он же самый цитируемый фрагмент: и поисковик, и языковая модель ищут
    # «сколько людей прошло и что изменилось», а не описание процесса.
    # Цифры печатаем списком ПЕРЕД прозой: числа находят выборкой, проза объясняет.
    r = p.get('result') or {}
    if r.get('text') or r.get('figures'):
        sec = ['<section class="result"><h2>%s</h2>' % L.t('Результат')]
        if r.get('figures'):
            sec.append('<ul class="stats">' + ''.join(
                '<li><b>%s</b> %s</li>' % (esc(i['n']), esc(i['label'])) for i in r['figures']) + '</ul>')
        for para in (r.get('text') or []):
            sec.append('<p>%s</p>' % esc(para))
        sec.append('</section>')
        out.append(''.join(sec))
    return '\n'.join(out)


def project_jsonld(L, slug):
    p = L.pmap.get(slug, {})
    data = {
        "@context": "https://schema.org", "@type": "CreativeWork",
        "name": p.get('title'), "headline": p.get('title'),
        "description": L.meta_desc(slug),
        "url": L.url('work/%s/' % slug),
        "image": cover_url(slug, L.pmap),
        "inLanguage": L.code,
        "creator": {"@type": "Organization", "name": "playdisplay", "url": BASE + '/'},
        "keywords": ", ".join((p.get('tags') or []) + [p.get('client') or '',
                              L.t('мультимедиа инсталляция')]),
    }
    if p.get('year'): data["dateCreated"] = str(p['year'])
    if p.get('client'): data["about"] = p['client']
    crumbs = {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "playdisplay", "item": L.url()},
            {"@type": "ListItem", "position": 2, "name": L.t('Проекты'), "item": L.url('#work')},
            {"@type": "ListItem", "position": 3, "name": p.get('title'),
             "item": L.url('work/%s/' % slug)},
        ],
    }
    # два объекта в одном <script>: JSON-массив — валидный JSON-LD
    return json.dumps([data, crumbs], ensure_ascii=False, indent=0)


def alternates(tail):
    """hreflang: у каждой страницы есть сёстры на других языках"""
    out = []
    for spec in LANGS:
        out.append('<link rel="alternate" hreflang="%s" href="%s/%s%s">' % (spec['code'], BASE, spec['prefix'], tail))
    out.append('<link rel="alternate" hreflang="x-default" href="%s/%s">' % (BASE, tail))
    return '\n'.join(out)


PAGE = '''<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{pagetitle} — playdisplay</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{canon}">
{alts}
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="article">
<meta property="og:title" content="{pagetitle} — playdisplay">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{canon}">
<meta property="og:image" content="{cover}">
<meta property="og:locale" content="{locale}">
<meta property="og:site_name" content="playdisplay">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{pagetitle} — playdisplay">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{cover}">
<script type="application/ld+json">{jsonld}</script>
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" href="/assets/logos/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/assets/logos/favicon-180.png">
<script src="{up}analytics.js" defer></script>
<style>
  body {{ margin:0; background:#040c10; color:#e9f4f6; font:400 18px/1.7 -apple-system,'Segoe UI',Roboto,sans-serif; }}
  .wrap {{ max-width:1000px; margin:0 auto; padding:64px 24px 100px; }}
  a {{ color:#2be0c6; }}
  h1 {{ font-size:clamp(34px,6vw,64px); line-height:1.05; margin:0 0 10px; letter-spacing:-.02em; }}
  h2 {{ font-size:clamp(22px,3vw,32px); margin:52px 0 14px; }}
  .meta {{ display:flex; flex-wrap:wrap; gap:28px; color:#9fb4c8; font:500 13px/1.5 monospace; letter-spacing:.14em; text-transform:uppercase; margin:24px 0 40px; }}
  .meta b {{ display:block; color:#fff; font:600 18px sans-serif; letter-spacing:0; text-transform:none; margin-top:6px; }}
  img {{ width:100%; height:auto; display:block; margin:16px 0; border-radius:4px; }}
  ol.steps, ol.notes {{ padding-left:1.3em; }} ol li {{ margin:10px 0; }}
  ul.stats {{ list-style:none; padding:0; display:flex; flex-wrap:wrap; gap:30px; }}
  ul.stats b {{ font-size:34px; color:#2be0c6; display:block; }}
  /* Результат — итог страницы, отделён линией. Цифры янтарные, а не бирюзовые:
     бирюза в кейсе означает «как мы это делали», янтарь — «что из этого вышло». */
  section.result {{ margin-top:56px; padding-top:40px; border-top:1px solid #1d2b31; }}
  section.result ul.stats b {{ color:#ff6a3d; font-size:42px; }}
  .cta {{ display:inline-block; margin-top:44px; padding:15px 26px; border:1px solid #2be0c6; color:#2be0c6; text-decoration:none; font-weight:600; }}
  .crumbs {{ font:500 13px monospace; letter-spacing:.14em; text-transform:uppercase; color:#9fb4c8; margin-bottom:40px; }}
  .srvline {{ margin-top:44px; padding-top:22px; border-top:1px solid rgba(159,180,200,.22); color:#9fb4c8; font-size:16px; }}
  footer {{ margin-top:80px; color:#9fb4c8; font-size:14px; }}
</style>
</head>
<body>
<main class="wrap">
  <nav class="crumbs"><a href="{home}">playdisplay</a> / <a href="{home}#work">{work}</a> / {title}</nav>
  <article>
    <h1>{title}</h1>
    <p style="color:#9fb4c8;font-size:20px">{subtitle}</p>
    <div class="meta">{metablk}</div>
    {flow}
    {srvline}
    <a class="cta" href="{home}#/work/{slug}">{cta}</a>
  </article>
  <footer>
    <p>{footer}</p>
    <p><a href="{home}">{f_home}</a> · <a href="{home}#work">{f_all}</a>{srv_foot}</p>
  </footer>
</main>
</body>
</html>
'''


def metablk(L, slug):
    p = L.pmap.get(slug, {})
    rows = []
    if p.get('client'): rows.append('<div>%s<b>%s</b></div>' % (L.t('Заказчик'), esc(p['client'])))
    if p.get('term'): rows.append('<div>%s<b>%s</b></div>' % (L.t('Срок реализации'), esc(p['term'])))
    if p.get('year'): rows.append('<div>%s<b>%s</b></div>' % (L.t('Год'), esc(str(p['year']))))
    return ''.join(rows)


FOOT_RU = ('playdisplay — пространства, которые люди запоминают: музеи, интерактивные экспозиции, '
           'visitor centre и иммерсивные выставки.')
FOOT_EN = ('playdisplay — spaces people remember: museums, interactive exhibits, visitor centres '
           'and immersive exhibitions.')

langs = [Lang(spec) for spec in LANGS]

def load_services(L):
    p = os.path.join(SITE, L.data, 'services.json')
    if not os.path.exists(p):
        return []
    return json.load(open(p, encoding='utf-8'))['services']


for L in langs:
    L.services = load_services(L)
    L.smap = {s['slug']: s for s in L.services}
    # Ссылка на концепции нужна в подвале страниц услуг, а сами концепции читаются ниже.
    # Проверяем наличие файла данных, а не загруженный список: порядок загрузки менять
    # ради одной строки дороже, чем один os.path.exists.
    L.cnc_foot = (' · <a href="%sconcepts/">%s</a>' % (L.up + L.prefix, esc(L.t('Концепции')))
                  if os.path.exists(os.path.join(SITE, L.data, 'concepts.json')) else '')
    if os.path.exists(os.path.join(SITE, L.data, 'atlas.json')):
        L.cnc_foot += ' · <a href="%satlas/">%s</a>' % (L.up + L.prefix, esc(L.t('Атлас')))

# языки, у которых услуги есть: только они попадают в hreflang и в sitemap
SRV_LANGS = [L for L in langs if L.services]
SRV_ORDER = [s['slug'] for s in SRV_LANGS[0].services] if SRV_LANGS else []

# Кейсы, название которых СОВПАДАЕТ во всех языках (23.08.2026). Вебмастер считает
# такую пару дублем заголовков и держит это ошибкой: hreflang связывает страницы, но
# title у них буквально один и тот же. Нашлось три — BMW X5, PTK Group, Urban Forum 2018:
# у них название языконезависимое, переводить нечего.
#
# Лечим не «дописать что-нибудь разное», а добавлением направления: «BMW X5 — шоурум»
# и «BMW X5 — showroom». Дубль расходится, и в заголовок попадает фраза, которую люди
# действительно ищут. Правило самоподдерживающееся: появится ещё один кейс с
# языконезависимым именем — он попадёт сюда сам, руками ничего не вписывать.
#
# Меняется ТОЛЬКО <title> и og/twitter. <h1> и хлебные крошки остаются с чистым
# названием проекта: там уточнение только мешает.
SAME_TITLE = set()
if len(langs) > 1:
    for slug in ORDER:
        names = {(L.pmap.get(slug) or {}).get('title') for L in langs if L.pmap.get(slug)}
        if len(names) == 1 and len(names & {None}) == 0:
            SAME_TITLE.add(slug)


# Обратный указатель кейс → услуги (21.08.2026). Связь до этого была только в одну
# сторону: со страницы услуги в кейсы. Человек, пришедший из поиска на кейс, не узнавал,
# что у студии есть направление, в которое этот кейс входит, — и уходил, не увидев, что
# ещё мы делаем. Считаем из тех же services.json, отдельного списка не держим: второй
# список рассинхронизируется с первым.
for L in langs:
    L.case_srv = {}
    for s in L.services:
        for slug in s['cases']:
            L.case_srv.setdefault(slug, []).append(s)


def page_title(L, slug):
    """<title> страницы работы: с направлением, если название одинаково во всех языках"""
    t = (L.pmap.get(slug) or {}).get('title') or ''
    if slug not in SAME_TITLE:
        return t
    items = L.case_srv.get(slug) or []
    if not items:
        return t
    nav = (items[0].get('nav') or items[0].get('title') or '').strip()
    if not nav:
        return t
    return '%s — %s' % (t, nav[0].lower() + nav[1:])


def srv_of_case(L, slug):
    """строка «Направление: <ссылки>» для страницы работы; пусто, если услуг нет"""
    items = (L.case_srv.get(slug) or [])[:2]
    if not items:
        return ''
    links = ' · '.join('<a href="%sservices/%s/">%s</a>' % (L.up + L.prefix, s['slug'], esc(s.get('nav') or s['title']))
                       for s in items)
    return '<p class="srvline">%s %s</p>' % (esc(L.t('Направление:')), links)


# ссылка на услуги в подвале страниц работ — только у языка, где услуги существуют
for L in langs:
    L.up_srv = L.up
    L.srv_foot = ('' if not L.services else
                  ' · <a href="%sservices/">%s</a>' % (L.up + L.prefix, esc(L.t('Услуги'))))
    # ссылка на концепции добавляется той же строкой; список концепций читается ниже,
    # поэтому дособерём srv_foot после их загрузки


for L in langs:
    n = 0
    for slug in ORDER:
        p = L.pmap.get(slug)
        if not p: continue
        d = os.path.join(SITE, L.prefix, 'work', slug)
        os.makedirs(d, exist_ok=True)
        open(os.path.join(d, 'index.html'), 'w', encoding='utf-8').write(stamp_assets(PAGE.format(
            lang=L.code, title=esc(p['title']), pagetitle=esc(page_title(L, slug)), subtitle=esc(p.get('subtitle') or ''),
            desc=esc(L.meta_desc(slug)), canon=L.url('work/%s/' % slug), alts=alternates('work/%s/' % slug),
            slug=slug, cover=esc(cover_url(slug, L.pmap)), locale=L.locale, home=L.up + L.prefix,
            jsonld=project_jsonld(L, slug), metablk=metablk(L, slug), flow=render_flow(L, p, slug), up=L.up,
            work=L.t('Проекты'), cta=L.t('Открыть интерактивную версию →'),
            footer=(FOOT_EN if L.code == 'en' else FOOT_RU),
            f_home=L.t('На главную'), f_all=L.t('Все проекты'), srv_foot=L.srv_foot,
            srvline=srv_of_case(L, slug))))
        n += 1
    print('project pages [%s]: %d' % (L.code, n))


# ---------- посадочные страницы услуг /services/<slug>/ ----------
# Зачем они появились (21.08.2026). Замер Вебмастера и GA4: за 30 дней 3 клика из
# поиска, видимость по популярным запросам 7 %, ВСЕ запросы брендовые («playdisplay»,
# «плей дисплей»). Небрендовый был ровно один — «интерактивный макет территории с
# отображением информации через проектор», один показ и один клик. То есть спрос
# существует, а страницы, которая на него отвечает, на сайте нет: ключевые запросы
# жили только в <meta keywords> главной — теге, который поисковики игнорируют с 2009-го.
# Кейс на такой запрос не отвечает: он про конкретного заказчика, а человек ищет услугу.
#
# Устройство намеренно повторяет страницы работ: статика, оба языка, своя разметка,
# перелинковка. Содержание — в site/data/services.json (и data/en/services.json),
# чтобы правка текста не требовала трогать генератор. Языка без файла просто нет:
# hreflang не должен обещать страницу, которой не существует.


def srv_alternates(tail):
    # hreflang только по языкам, где страница РЕАЛЬНО есть
    out = ['<link rel="alternate" hreflang="%s" href="%s/%s%s">' % (L.code, BASE, L.prefix, tail)
           for L in SRV_LANGS]
    if SRV_LANGS:
        out.append('<link rel="alternate" hreflang="x-default" href="%s/%s%s">'
                   % (BASE, SRV_LANGS[0].prefix, tail))
    return '\n'.join(out)


def render_blocks(blocks):
    # те же типы блоков, что у кейсов: h, p, steps, notes, stats
    out = []
    for b in blocks:
        t = b['t']
        if t == 'h':
            out.append('<h2>%s</h2>' % esc(b['text']))
        elif t == 'p':
            out.append('<p>%s</p>' % esc(b['text']))
        elif t == 'steps':
            out.append('<ol class="steps">' + ''.join('<li>%s</li>' % esc(i) for i in b['items']) + '</ol>')
        elif t == 'notes':
            out.append('<ul class="notes">' + ''.join('<li>%s</li>' % esc(i) for i in b['items']) + '</ul>')
        elif t == 'stats':
            out.append('<ul class="stats">' + ''.join('<li><b>%s</b> %s</li>'
                       % (esc(i['n']), esc(i['label'])) for i in b['items']) + '</ul>')
        else:
            raise SystemExit('неизвестный тип блока услуги: %r' % t)
    return '\n'.join(out)


def render_cases(L, slugs):
    # связанные проекты — та самая перелинковка, которой между разделами не было
    li = []
    for slug in slugs:
        p = L.pmap.get(slug)
        if not p:
            raise SystemExit('в услуге указан проект %r, которого нет в projects.json' % slug)
        li.append('<li><a href="%swork/%s/"><b>%s</b></a> — %s</li>'
                  % (L.up_srv + L.prefix, slug, esc(p['title']), esc(p.get('subtitle') or L.meta_desc(slug))))
    return '<ul class="cases">' + ''.join(li) + '</ul>'


def srv_figures(L, slugs):
    """цифры аудитории из связанных кейсов — на страницу услуги

    Аудит 15.08.2026 писал: «Цифры про нас, а не про клиента» — «3 нед. самый быстрый
    стенд», «115 инсталляций». Это про нашу производительность, а покупателя интересует
    его выгода. Теперь у части кейсов есть result.figures — числа про аудиторию
    заказчика, и они собираются сюда автоматически. Ничего не придумывается: если у
    связанных кейсов цифр нет, блока нет.
    """
    rows = []
    for slug in slugs:
        p = L.pmap.get(slug) or {}
        for f in ((p.get('result') or {}).get('figures') or [])[:1]:
            rows.append((f['n'], f['label'], p.get('title'), slug))
    if not rows:
        return ''
    li = ''.join('<li><b>%s</b> %s<br><a href="%swork/%s/">%s</a></li>'
                 % (esc(n), esc(label), L.up_srv + L.prefix, slug, esc(title))
                 for n, label, title, slug in rows)
    return '<h2>%s</h2><ul class="stats figures">%s</ul>' % (esc(L.t('Сколько людей это увидело')), li)


def render_faq(items):
    return ''.join('<div class="qa"><h3>%s</h3><p>%s</p></div>' % (esc(q['q']), esc(q['a']))
                   for q in items)


def service_jsonld(L, s):
    svc = {
        "@context": "https://schema.org", "@type": "Service",
        "name": s['title'],
        "description": s['subtitle'],
        "url": L.url('services/%s/' % s['slug']),
        "serviceType": s['title'],
        "provider": {"@type": "Organization", "name": "playdisplay", "url": BASE + '/'},
        "areaServed": "Worldwide",
        "inLanguage": L.code,
        "keywords": ", ".join(s.get('keywords') or []),
    }
    crumbs = {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "playdisplay", "item": L.url()},
            {"@type": "ListItem", "position": 2, "name": L.t('Услуги'), "item": L.url('services/')},
            {"@type": "ListItem", "position": 3, "name": s['title'],
             "item": L.url('services/%s/' % s['slug'])},
        ],
    }
    # FAQPage прямо на странице услуги, а не отдельной свалкой вопросов: вопрос
    # цитируется вместе со страницей, которая на него отвечает.
    #
    # ЧЕГО ОТ НЕЁ ЖДАТЬ, а чего нет (проверено 21.08.2026). Расширенных сниппетов в
    # Google эта разметка больше НЕ даёт: FAQ-сниппеты сузили до государственных и
    # медицинских сайтов в августе 2023-го, а 7 мая 2026 убрали совсем. Сам тип
    # FAQPage при этом не отменён и вреда не приносит — документация Google прямо
    # говорит, что удалять его не нужно. Польза осталась в двух местах: Яндекс
    # разметку читает, и вопрос с ответом — самый удобный для цитирования кусок для
    # поисковых ИИ. Так что вопросы держим за содержание, а не за сниппет.
    faq = {
        "@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": [{"@type": "Question", "name": q['q'],
                        "acceptedAnswer": {"@type": "Answer", "text": q['a']}}
                       for q in s.get('faq') or []],
    }
    out = [svc, crumbs]
    if faq["mainEntity"]:
        out.append(faq)
    return json.dumps(out, ensure_ascii=False, indent=0)


SRV_CSS = '''
  body { margin:0; background:#040c10; color:#e9f4f6; font:400 18px/1.7 -apple-system,'Segoe UI',Roboto,sans-serif; }
  .wrap { max-width:1000px; margin:0 auto; padding:64px 24px 100px; }
  a { color:#2be0c6; }
  h1 { font-size:clamp(34px,6vw,64px); line-height:1.05; margin:0 0 10px; letter-spacing:-.02em; }
  h2 { font-size:clamp(22px,3vw,32px); margin:52px 0 14px; }
  h3 { font-size:20px; margin:28px 0 6px; color:#fff; }
  .lead { color:#9fb4c8; font-size:22px; line-height:1.5; margin:0 0 8px; }
  ol.steps { padding-left:1.3em; } li { margin:10px 0; }
  ul.notes { list-style:none; padding-left:0; }
  ul.notes li { padding-left:1.2em; position:relative; }
  ul.notes li:before { content:"\\2014"; position:absolute; left:0; color:#2be0c6; }
  ul.stats { list-style:none; padding:0; display:flex; flex-wrap:wrap; gap:30px; }
  ul.stats b { font-size:34px; color:#2be0c6; display:block; }
  ul.stats.figures { gap:34px 40px; }
  ul.stats.figures li { max-width:250px; }
  ul.stats.figures b { color:#ff6a3d; font-size:40px; line-height:1.05; }
  ul.stats.figures a { font-size:14px; }
  ul.cases { list-style:none; padding:0; }
  ul.cases li { margin:16px 0; padding-left:1.2em; position:relative; }
  ul.cases li:before { content:"\\2192"; position:absolute; left:0; color:#2be0c6; }
  ul.cases b { color:#fff; }
  .qa { border-top:1px solid rgba(159,180,200,.22); padding-top:6px; }
  .qa p { color:#c8d8e2; }
  .other { list-style:none; padding:0; display:flex; flex-wrap:wrap; gap:10px 18px; font-size:16px; }
  .cta { display:inline-block; margin-top:44px; padding:15px 26px; border:1px solid #2be0c6; color:#2be0c6; text-decoration:none; font-weight:600; }
  .crumbs { font:500 13px monospace; letter-spacing:.14em; text-transform:uppercase; color:#9fb4c8; margin-bottom:40px; }
  footer { margin-top:80px; color:#9fb4c8; font-size:14px; border-top:1px solid rgba(159,180,200,.22); padding-top:22px; }
'''

SERVICE_PAGE = '''<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} — playdisplay</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{canon}">
{alts}
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
<meta property="og:type" content="website">
<meta property="og:title" content="{title} — playdisplay">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{canon}">
<meta property="og:image" content="{cover}">
<meta property="og:locale" content="{locale}">
<meta property="og:site_name" content="playdisplay">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title} — playdisplay">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{cover}">
<script type="application/ld+json">{jsonld}</script>
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" href="/assets/logos/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/assets/logos/favicon-180.png">
<script src="{up}analytics.js" defer></script>
<style>{css}</style>
</head>
<body>
<main class="wrap">
  <nav class="crumbs"><a href="{home}">playdisplay</a> / <a href="{srvhome}">{t_services}</a> / {title}</nav>
  <article>
    <h1>{title}</h1>
    <p class="lead">{subtitle}</p>
    {flow}
    {figures}
    <h2>{t_cases}</h2>
    {cases}
    {faqblock}
    <a class="cta" href="{home}">{cta}</a>
  </article>
  <footer>
    <p>{footer}</p>
    <h3 style="margin-top:26px">{t_other}</h3>
    <ul class="other">{other}</ul>
    <p style="margin-top:22px"><a href="{home}">{f_home}</a> · <a href="{home}#work">{f_all}</a> · <a href="{srvhome}">{t_services}</a>{cnc_foot}</p>
  </footer>
</main>
</body>
</html>
'''

HUB_PAGE = '''<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} — playdisplay</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{canon}">
{alts}
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
<meta property="og:type" content="website">
<meta property="og:title" content="{title} — playdisplay">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{canon}">
<meta property="og:image" content="{cover}">
<meta property="og:locale" content="{locale}">
<meta property="og:site_name" content="playdisplay">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="{cover}">
<script type="application/ld+json">{jsonld}</script>
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" href="/assets/logos/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/assets/logos/favicon-180.png">
<script src="{up}analytics.js" defer></script>
<style>{css}</style>
</head>
<body>
<main class="wrap">
  <nav class="crumbs"><a href="{home}">playdisplay</a> / {title}</nav>
  <article>
    <h1>{title}</h1>
    <p class="lead">{lead}</p>
    <ul class="cases">{items}</ul>
    <a class="cta" href="{home}">{cta}</a>
  </article>
  <footer>
    <p>{footer}</p>
    <p><a href="{home}">{f_home}</a> · <a href="{home}#work">{f_all}</a></p>
  </footer>
</main>
</body>
</html>
'''

HUB_LEAD_RU = ('Пять направлений, в которых мы работаем с 2011 года. Внутри каждого — что входит, '
               'как идёт работа, что определяет срок и стоимость, и проекты, на которых это уже сделано.')
HUB_LEAD_EN = ('Five directions we have been working in since 2011. Each page covers what is included, '
               'how the work goes, what drives cost and schedule, and the projects where we have done it.')

for L in SRV_LANGS:
    # со страницы services/<slug>/ до корня столько же уровней, сколько с work/<slug>/
    L.up_srv = L.up
    for s in L.services:
        tail = 'services/%s/' % s['slug']
        d = os.path.join(SITE, L.prefix, 'services', s['slug'])
        os.makedirs(d, exist_ok=True)
        others = ''.join('<li><a href="%s%s/">%s</a></li>'
                         % (L.up_srv + L.prefix + 'services/', o['slug'], esc(o.get('nav') or o['title']))
                         for o in L.services if o['slug'] != s['slug'])
        faqblock = ('<h2>%s</h2>%s' % (esc(L.t('Частые вопросы')), render_faq(s['faq']))) if s.get('faq') else ''
        open(os.path.join(d, 'index.html'), 'w', encoding='utf-8').write(stamp_assets(SERVICE_PAGE.format(
            lang=L.code, title=esc(s['title']), subtitle=esc(s['subtitle']),
            desc=esc(Lang._clip(s['subtitle'])), canon=L.url(tail), alts=srv_alternates(tail),
            cover=esc(cover_url(s['cases'][0], L.pmap)), locale=L.locale, css=SRV_CSS,
            jsonld=service_jsonld(L, s), up=L.up_srv, home=L.up_srv + L.prefix,
            srvhome=L.up_srv + L.prefix + 'services/',
            flow=render_blocks(s['flow']), cases=render_cases(L, s['cases']), faqblock=faqblock,
            figures=srv_figures(L, s['cases']),
            cnc_foot=L.cnc_foot,
            t_services=esc(L.t('Услуги')), t_cases=esc(L.t('Проекты, где это сделано')),
            t_other=esc(L.t('Другие направления')), other=others,
            cta=esc(L.t('Забронировать креативную сессию →')),
            footer=(FOOT_EN if L.code == 'en' else FOOT_RU),
            f_home=esc(L.t('На главную')), f_all=esc(L.t('Все проекты')))))
    # хаб /services/: без него страницы услуг — сироты, на которые ведёт только sitemap
    hub_items = ''.join('<li><a href="%s/"><b>%s</b></a> — %s</li>'
                        % (s['slug'], esc(s['title']), esc(s['subtitle'])) for s in L.services)
    hub_ld = json.dumps([
        {"@context": "https://schema.org", "@type": "ItemList",
         "name": L.t('Услуги playdisplay'),
         "itemListElement": [{"@type": "ListItem", "position": i + 1,
                              "url": L.url('services/%s/' % s['slug']), "name": s['title']}
                             for i, s in enumerate(L.services)]},
        {"@context": "https://schema.org", "@type": "BreadcrumbList",
         "itemListElement": [
             {"@type": "ListItem", "position": 1, "name": "playdisplay", "item": L.url()},
             {"@type": "ListItem", "position": 2, "name": L.t('Услуги'), "item": L.url('services/')}]},
    ], ensure_ascii=False, indent=0)
    dh = os.path.join(SITE, L.prefix, 'services')
    os.makedirs(dh, exist_ok=True)
    up_hub = '../' if L.code == 'ru' else '../../'
    open(os.path.join(dh, 'index.html'), 'w', encoding='utf-8').write(stamp_assets(HUB_PAGE.format(
        lang=L.code, title=esc(L.t('Услуги')),
        desc=esc(Lang._clip(HUB_LEAD_EN if L.code == 'en' else HUB_LEAD_RU)),
        canon=L.url('services/'), alts=srv_alternates('services/'), locale=L.locale, css=SRV_CSS,
        cover=esc(cover_url(L.services[0]['cases'][0], L.pmap)),
        jsonld=hub_ld, up=up_hub, home=up_hub + L.prefix,
        lead=esc(HUB_LEAD_EN if L.code == 'en' else HUB_LEAD_RU), items=hub_items,
        cta=esc(L.t('Забронировать креативную сессию →')),
        footer=(FOOT_EN if L.code == 'en' else FOOT_RU),
        f_home=esc(L.t('На главную')), f_all=esc(L.t('Все проекты')))))
    print('service pages [%s]: %d + хаб' % (L.code, len(L.services)))

# ---------- страницы концепций /concepts/<id>/ ----------
# Зачем (22.08.2026). В site/data/concepts.json лежат 28 концепций, заполненных
# студией целиком: у каждой есть замысел, что решает, как устроено, что чувствует
# человек, механики, объяснение «почему так» и где применимо — около 32 000 знаков
# на обеих локалях, плюс обложки и галереи. И всё это жило ТОЛЬКО внутри SPA:
# концепции открываются оверлеем без собственного адреса, то есть для поиска их
# не существовало. Главная при этом обещает «Авторские концепции. Сценарии.
# Форматы. Готовые к реализации» — обещание было, страниц не было.
#
# Каждая концепция — свой длинный запрос («AR-портал в музее», «фасад, который
# реагирует на людей»), и таких запросов у конкурентов нет вовсе. Ничего не
# придумывается: текст берётся как есть, генератор только раскладывает поля.
#
# line и need в данных совпадают у всех 28 — печатаем один раз, иначе на странице
# был бы дословный повтор в двух местах.
def load_concepts(L):
    p = os.path.join(SITE, L.data, 'concepts.json')
    if not os.path.exists(p):
        return [], {}
    d = json.load(open(p, encoding='utf-8'))
    labels = {c['id']: c['label'] for c in (d.get('cats') or []) if c.get('id') != 'all'}
    return d.get('concepts') or [], labels


for L in langs:
    L.concepts, L.cat_labels = load_concepts(L)

CNC_LANGS = [L for L in langs if L.concepts]
# Дособерём подвал страниц работ: concepts загружаются позже services, а ссылка нужна
# в одной строке с услугами. Страницы работ уже отрисованы к этому моменту, поэтому
# ниже они перерисовываются — дешевле, чем тасовать порядок загрузки данных.
for L in langs:
    if L.concepts:
        L.srv_foot += ' · <a href="%sconcepts/">%s</a>' % (L.up + L.prefix, esc(L.t('Концепции')))
    if os.path.exists(os.path.join(SITE, L.data, 'atlas.json')):
        L.srv_foot += ' · <a href="%satlas/">%s</a>' % (L.up + L.prefix, esc(L.t('Атлас')))
CNC_ORDER = [c['id'] for c in CNC_LANGS[0].concepts] if CNC_LANGS else []

# Страницы работ отрисованы до загрузки концепций, а их подвал теперь содержит и
# ссылку на /concepts/. Перерисовываем — это тот же цикл, что выше, и он дешевле,
# чем переставлять порядок загрузки данных ради одной строки в подвале.
for L in langs:
    if not L.concepts:
        continue
    for slug in ORDER:
        p_ = L.pmap.get(slug)
        if not p_:
            continue
        d_ = os.path.join(SITE, L.prefix, 'work', slug)
        open(os.path.join(d_, 'index.html'), 'w', encoding='utf-8').write(stamp_assets(PAGE.format(
            lang=L.code, title=esc(p_['title']), pagetitle=esc(page_title(L, slug)), subtitle=esc(p_.get('subtitle') or ''),
            desc=esc(L.meta_desc(slug)), canon=L.url('work/%s/' % slug), alts=alternates('work/%s/' % slug),
            slug=slug, cover=esc(cover_url(slug, L.pmap)), locale=L.locale, home=L.up + L.prefix,
            jsonld=project_jsonld(L, slug), metablk=metablk(L, slug), flow=render_flow(L, p_, slug), up=L.up,
            work=L.t('Проекты'), cta=L.t('Открыть интерактивную версию →'),
            footer=(FOOT_EN if L.code == 'en' else FOOT_RU),
            f_home=L.t('На главную'), f_all=L.t('Все проекты'), srv_foot=L.srv_foot,
            srvline=srv_of_case(L, slug))))
    print('work pages footer [%s]: обновлён' % L.code)



def cnc_alternates(tail):
    out = ['<link rel="alternate" hreflang="%s" href="%s/%s%s">' % (L.code, BASE, L.prefix, tail)
           for L in CNC_LANGS]
    if CNC_LANGS:
        out.append('<link rel="alternate" hreflang="x-default" href="%s/%s%s">'
                   % (BASE, CNC_LANGS[0].prefix, tail))
    return '\n'.join(out)


def cnc_gallery(L, c):
    # только картинки: видео на статической странице потребовало бы плеера и веса,
    # а задача страницы — быть читаемой и попадать в поиск, а не заменять SPA
    out = []
    for item in (c.get('gallery') or []):
        if item.get('type') != 'image':
            continue
        src = item.get('src') or ''
        if not src or not os.path.exists(os.path.join(SITE, src)):
            MISSING.append('%s/concept %s: %s' % (L.code, c['id'], src))
            continue
        out.append('<img src="%s%s" alt="%s" loading="lazy">' % (L.up_srv, src, esc(c.get('title') or '')))
    return '\n'.join(out)


def cnc_body(L, c):
    out = []

    def block(title, value, kind='p'):
        if not value:
            return
        out.append('<h2>%s</h2>' % esc(L.t(title)))
        if kind == 'ul':
            out.append('<ul class="notes">' + ''.join('<li>%s</li>' % esc(i) for i in value) + '</ul>')
        else:
            out.append('<p>%s</p>' % esc(value))

    block('Что это решает', c.get('solves'), 'ul')
    block('Как это устроено', c.get('essence'))
    if c.get('feel'):
        out.append('<blockquote class="feel">%s</blockquote>' % esc(c['feel']))
    block('Механики', c.get('mechanics'), 'ul')
    block('Почему так', c.get('comment'))
    block('Где применимо', c.get('spaces'))
    block('Что можно показать', c.get('adapt'))
    return '\n'.join(out)


def cnc_jsonld(L, c):
    data = {
        "@context": "https://schema.org", "@type": "CreativeWork",
        "name": c.get('title'), "headline": c.get('title'),
        "description": Lang._clip(c.get('line') or ''),
        "url": L.url('concepts/%s/' % c['id']),
        "inLanguage": L.code,
        "creator": {"@type": "Organization", "name": "playdisplay", "url": BASE + '/'},
        "genre": c.get('catLabel') or '',
        "keywords": ", ".join(x for x in [(c.get('catLabel') or ''), L.t('концепция экспозиции'),
                                          L.t('интерактивная инсталляция')] if x),
    }
    cov = c.get('cover')
    if cov and os.path.exists(os.path.join(SITE, cov)):
        data["image"] = BASE + '/' + cov.lstrip('/')
    crumbs = {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "playdisplay", "item": L.url()},
            {"@type": "ListItem", "position": 2, "name": L.t('Концепции'), "item": L.url('concepts/')},
            {"@type": "ListItem", "position": 3, "name": c.get('title'),
             "item": L.url('concepts/%s/' % c['id'])},
        ],
    }
    return json.dumps([data, crumbs], ensure_ascii=False, indent=0)


CNC_CSS = SRV_CSS + '''
  blockquote.feel { margin:26px 0 0; padding:18px 22px; border-left:2px solid #2be0c6;
                    background:rgba(43,224,198,.06); color:#fff; font-size:21px; line-height:1.5; }
  .catline { font:500 13px monospace; letter-spacing:.14em; text-transform:uppercase; color:#2be0c6; margin:0 0 14px; }
  ul.cncs { list-style:none; padding:0; }
  ul.cncs li { margin:14px 0; padding-left:1.2em; position:relative; }
  ul.cncs li:before { content:"\\2192"; position:absolute; left:0; color:#2be0c6; }
  ul.cncs b { color:#fff; }
  h3.cat { font-size:15px; letter-spacing:.14em; text-transform:uppercase; color:#9fb4c8; margin:38px 0 10px; }
'''

CONCEPT_PAGE = '''<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} — playdisplay</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{canon}">
{alts}
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
<meta property="og:type" content="article">
<meta property="og:title" content="{title} — playdisplay">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{canon}">
<meta property="og:image" content="{cover}">
<meta property="og:locale" content="{locale}">
<meta property="og:site_name" content="playdisplay">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title} — playdisplay">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{cover}">
<script type="application/ld+json">{jsonld}</script>
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" href="/assets/logos/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/assets/logos/favicon-180.png">
<script src="{up}analytics.js" defer></script>
<style>{css}</style>
</head>
<body>
<main class="wrap">
  <nav class="crumbs"><a href="{home}">playdisplay</a> / <a href="{cnchome}">{t_concepts}</a> / {title}</nav>
  <article>
    <p class="catline">{catlabel}</p>
    <h1>{title}</h1>
    <p class="lead">{lead}</p>
    {body}
    {gallery}
    <a class="cta" href="{home}">{cta}</a>
  </article>
  <footer>
    <p>{footer}</p>
    <h3 style="margin-top:26px">{t_more}</h3>
    <ul class="other">{siblings}</ul>
    <p style="margin-top:22px"><a href="{home}">{f_home}</a> · <a href="{cnchome}">{t_concepts}</a> · <a href="{srvhome}">{t_services}</a> · <a href="{atlashome}">{t_atlas}</a> · <a href="{home}#work">{f_all}</a></p>
  </footer>
</main>
</body>
</html>
'''

# Хаб концепций берёт общий шаблон, но список у него сгруппирован по категориям:
# <h3>+<ul> нельзя вкладывать в <ul class="cases"> — получилась бы невалидная разметка.
CNC_HUB_PAGE = HUB_PAGE.replace('<ul class="cases">{items}</ul>', '{items}')

CNC_HUB_LEAD_RU = ('Двадцать восемь готовых к реализации концепций: замысел, что он решает, как устроен '
                   'и где применим. Это не портфолио — это форматы, которые можно взять в проект.')
CNC_HUB_LEAD_EN = ('Twenty-eight concepts ready to be built: the idea, what it solves, how it works and '
                   'where it applies. Not a portfolio — formats you can take into a project.')

for L in CNC_LANGS:
    by_cat = {}
    for c in L.concepts:
        by_cat.setdefault(c.get('cat') or 'other', []).append(c)
    for c in L.concepts:
        tail = 'concepts/%s/' % c['id']
        d = os.path.join(SITE, L.prefix, 'concepts', c['id'])
        os.makedirs(d, exist_ok=True)
        # соседи по той же категории: перелинковка внутри раздела, а не только в хаб
        sib = [o for o in by_cat.get(c.get('cat'), []) if o['id'] != c['id']][:5]
        siblings = ''.join('<li><a href="%s%s/">%s</a></li>' % (L.up_srv + L.prefix + 'concepts/', o['id'], esc(o.get('title')))
                           for o in sib)
        cov = c.get('cover') or ''
        cover = (BASE + '/' + cov.lstrip('/')) if cov and os.path.exists(os.path.join(SITE, cov)) else esc(cover_url(ORDER[0], L.pmap))
        open(os.path.join(d, 'index.html'), 'w', encoding='utf-8').write(stamp_assets(CONCEPT_PAGE.format(
            lang=L.code, title=esc(c.get('title')), lead=esc(c.get('line') or ''),
            desc=esc(Lang._clip(c.get('line') or '')), canon=L.url(tail), alts=cnc_alternates(tail),
            cover=esc(cover), locale=L.locale, css=CNC_CSS, jsonld=cnc_jsonld(L, c),
            up=L.up_srv, home=L.up_srv + L.prefix, cnchome=L.up_srv + L.prefix + 'concepts/',
            atlashome=L.up_srv + L.prefix + 'atlas/', t_atlas=esc(L.t('Атлас')),
            srvhome=L.up_srv + L.prefix + 'services/',
            catlabel=esc(c.get('catLabel') or ''), body=cnc_body(L, c), gallery=cnc_gallery(L, c),
            t_concepts=esc(L.t('Концепции')), t_services=esc(L.t('Услуги')),
            t_more=esc(L.t('Ещё концепции этого типа')), siblings=siblings,
            cta=esc(L.t('Забронировать креативную сессию →')),
            footer=(FOOT_EN if L.code == 'en' else FOOT_RU),
            f_home=esc(L.t('На главную')), f_all=esc(L.t('Все проекты')))))
    # хаб /concepts/: группируем по категориям — так список из 28 читается
    groups = []
    for cat in [x['id'] for x in [{'id': k} for k in ('museum', 'brand', 'public', 'future')] if x['id'] in by_cat]:
        items = ''.join('<li><a href="%s/"><b>%s</b></a> — %s</li>' % (o['id'], esc(o.get('title')), esc(o.get('line') or ''))
                        for o in by_cat[cat])
        groups.append('<h3 class="cat">%s</h3><ul class="cncs">%s</ul>' % (esc(L.cat_labels.get(cat, cat)), items))
    hub_ld = json.dumps([
        {"@context": "https://schema.org", "@type": "ItemList",
         "name": L.t('Концепции playdisplay'),
         "itemListElement": [{"@type": "ListItem", "position": i + 1,
                              "url": L.url('concepts/%s/' % c['id']), "name": c.get('title')}
                             for i, c in enumerate(L.concepts)]},
        {"@context": "https://schema.org", "@type": "BreadcrumbList",
         "itemListElement": [
             {"@type": "ListItem", "position": 1, "name": "playdisplay", "item": L.url()},
             {"@type": "ListItem", "position": 2, "name": L.t('Концепции'), "item": L.url('concepts/')}]},
    ], ensure_ascii=False, indent=0)
    dh = os.path.join(SITE, L.prefix, 'concepts')
    os.makedirs(dh, exist_ok=True)
    up_hub = '../' if L.code == 'ru' else '../../'
    open(os.path.join(dh, 'index.html'), 'w', encoding='utf-8').write(stamp_assets(CNC_HUB_PAGE.format(
        lang=L.code, title=esc(L.t('Концепции')),
        desc=esc(Lang._clip(CNC_HUB_LEAD_EN if L.code == 'en' else CNC_HUB_LEAD_RU)),
        canon=L.url('concepts/'), alts=cnc_alternates('concepts/'), locale=L.locale, css=CNC_CSS,
        cover=esc(cover_url(ORDER[0], L.pmap)),
        jsonld=hub_ld, up=up_hub, home=up_hub + L.prefix,
        lead=esc(CNC_HUB_LEAD_EN if L.code == 'en' else CNC_HUB_LEAD_RU), items=''.join(groups),
        cta=esc(L.t('Забронировать креативную сессию →')),
        footer=(FOOT_EN if L.code == 'en' else FOOT_RU),
        f_home=esc(L.t('На главную')), f_all=esc(L.t('Все проекты')))))
    print('concept pages [%s]: %d + хаб' % (L.code, len(L.concepts)))


ATLAS_PAGE = '''<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} — playdisplay</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{canon}">
{alts}
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
<meta property="og:type" content="article">
<meta property="og:title" content="{h1}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{canon}">
<meta property="og:image" content="{cover}">
<meta property="og:locale" content="{locale}">
<meta property="og:site_name" content="playdisplay">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{h1}">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{cover}">
<script type="application/ld+json">{jsonld}</script>
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" href="/assets/logos/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/assets/logos/favicon-180.png">
<script src="{up}analytics.js" defer></script>
<style>{css}</style>
</head>
<body>
<main class="wrap">
  <nav class="crumbs"><a href="{home}">playdisplay</a> / {title}</nav>
  <article>
    <h1>{h1}</h1>
    <p class="lead">{lead}</p>
    {groups}
    <a class="cta" href="{home}">{cta}</a>
  </article>
  <footer>
    <p>{footer}</p>
    <p style="margin-top:22px"><a href="{home}">{f_home}</a> · <a href="{cnchome}">{t_concepts}</a> · <a href="{srvhome}">{t_services}</a> · <a href="{home}#work">{f_all}</a></p>
  </footer>
</main>
</body>
</html>
'''


def atlas_alternates(tail):
    ls = [L for L in langs if getattr(L, 'has_atlas', False) or os.path.exists(os.path.join(SITE, L.data, 'atlas.json'))]
    out = ['<link rel="alternate" hreflang="%s" href="%s/%s%s">' % (L.code, BASE, L.prefix, tail) for L in ls]
    if ls:
        out.append('<link rel="alternate" hreflang="x-default" href="%s/%s%s">' % (BASE, ls[0].prefix, tail))
    return '\n'.join(out)


# ---------- /atlas/ — 50 принципов ОДНОЙ страницей ----------
# Почему одной, а не пятьюдесятью (22.08.2026). У элементов «Атласа» есть только
# title (~35 знаков) и desc (~110). Пятьдесят страниц по 140 знаков — это ровно то
# тонкое содержание, за которое поисковики понижают САЙТ ЦЕЛИКОМ, а не отдельные
# страницы. Собранные вместе те же данные дают ~7 000 знаков связного текста:
# это манифест студии, законная сильная страница и естественный повод сослаться.
#
# Заодно снимается находка аудита: «Атлас — витрина без содержимого», раздел
# выглядит интерактивным и не открывается. Теперь у него есть настоящий адрес.
def load_atlas(L):
    p = os.path.join(SITE, L.data, 'atlas.json')
    if not os.path.exists(p):
        return None
    return json.load(open(p, encoding='utf-8'))


ATLAS_LEAD_RU = ('Пятьдесят принципов, приёмов и наблюдений, по которым студия работает. Не манифест '
                 'ради манифеста: это то, на что мы опираемся, когда решаем, каким будет объект.')
ATLAS_LEAD_EN = ('Fifty principles, techniques and observations the studio works by. Not a manifesto for '
                 'its own sake: this is what we lean on when deciding what an object will be.')

for L in langs:
    a = load_atlas(L)
    L.has_atlas = bool(a)
    if not a:
        continue
    items, labels = a['items'], (a.get('catLabels') or {})
    groups = []
    for cat in (a.get('cats') or []):
        rows = [x for x in items if x.get('cat') == cat]
        if not rows:
            continue
        li = ''.join('<li id="%s"><b>%s</b><span>%s</span></li>' % (esc(x['id']), esc(x['title']), esc(x['desc']))
                     for x in rows)
        groups.append('<h2>%s</h2><ol class="atlas">%s</ol>' % (esc(labels.get(cat, cat)), li))
    tail = 'atlas/'
    ld = json.dumps([
        {"@context": "https://schema.org", "@type": "Article",
         "headline": L.t('Атлас: принципы студии playdisplay'),
         "description": Lang._clip(ATLAS_LEAD_EN if L.code == 'en' else ATLAS_LEAD_RU),
         "url": L.url(tail), "inLanguage": L.code,
         "author": {"@type": "Organization", "name": "playdisplay", "url": BASE + '/'},
         "publisher": {"@type": "Organization", "name": "playdisplay", "url": BASE + '/'}},
        {"@context": "https://schema.org", "@type": "BreadcrumbList",
         "itemListElement": [
             {"@type": "ListItem", "position": 1, "name": "playdisplay", "item": L.url()},
             {"@type": "ListItem", "position": 2, "name": L.t('Атлас'), "item": L.url(tail)}]},
    ], ensure_ascii=False, indent=0)
    d = os.path.join(SITE, L.prefix, 'atlas')
    os.makedirs(d, exist_ok=True)
    up = '../' if L.code == 'ru' else '../../'
    css = CNC_CSS + '''
  ol.atlas { counter-reset:none; padding-left:0; list-style:none; }
  ol.atlas li { margin:22px 0; padding-left:0; }
  ol.atlas b { display:block; color:#fff; font-size:20px; line-height:1.35; margin-bottom:5px; }
  ol.atlas span { color:#c8d8e2; }
'''
    open(os.path.join(d, 'index.html'), 'w', encoding='utf-8').write(stamp_assets(ATLAS_PAGE.format(
        lang=L.code, title=esc(L.t('Атлас')),
        h1=esc(L.t('Атлас: как мы думаем о пространстве')),
        desc=esc(Lang._clip(ATLAS_LEAD_EN if L.code == 'en' else ATLAS_LEAD_RU)),
        canon=L.url(tail), alts=atlas_alternates(tail), locale=L.locale, css=css, jsonld=ld,
        cover=esc(cover_url(ORDER[0], L.pmap)), up=up, home=up + L.prefix,
        cnchome=up + L.prefix + 'concepts/', srvhome=up + L.prefix + 'services/',
        lead=esc(ATLAS_LEAD_EN if L.code == 'en' else ATLAS_LEAD_RU), groups=''.join(groups),
        t_concepts=esc(L.t('Концепции')), t_services=esc(L.t('Услуги')),
        cta=esc(L.t('Забронировать креативную сессию →')),
        footer=(FOOT_EN if L.code == 'en' else FOOT_RU),
        f_home=esc(L.t('На главную')), f_all=esc(L.t('Все проекты')))))
    print('atlas page [%s]: %d принципов' % (L.code, len(items)))


# ---------- sitemap.xml: обе версии + перекрёстные hreflang ----------
XH = 'xmlns:xhtml="http://www.w3.org/1999/xhtml"'
def sm_alts(tail):
    return ''.join('<xhtml:link rel="alternate" hreflang="%s" href="%s/%s%s"/>' % (s['code'], BASE, s['prefix'], tail)
                   for s in LANGS)
urls = []
for tail, prio in [('', '1.0')] + [('work/%s/' % s, '0.8') for s in ORDER]:
    for spec in LANGS:
        urls.append('<url><loc>%s/%s%s</loc>%s<changefreq>monthly</changefreq><priority>%s</priority></url>'
                    % (BASE, spec['prefix'], tail, sm_alts(tail), prio))
# Самостоятельная русская продуктовая страница без английского дубля. Держим её здесь,
# а не только в готовом sitemap: генератор запускается перед деплоем и иначе удалит URL.
urls.append('<url><loc>%s/digital/</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>' % BASE)
# услуги: hreflang перечисляем только по языкам, где страница есть
def sm_srv_alts(tail):
    return ''.join('<xhtml:link rel="alternate" hreflang="%s" href="%s/%s%s"/>' % (L.code, BASE, L.prefix, tail)
                   for L in SRV_LANGS)
for tail, prio in [('services/', '0.9')] + [('services/%s/' % s, '0.9') for s in SRV_ORDER]:
    for L in SRV_LANGS:
        urls.append('<url><loc>%s/%s%s</loc>%s<changefreq>monthly</changefreq><priority>%s</priority></url>'
                    % (BASE, L.prefix, tail, sm_srv_alts(tail), prio))
# концепции: та же логика, свой список языков
def sm_cnc_alts(tail):
    return ''.join('<xhtml:link rel="alternate" hreflang="%s" href="%s/%s%s"/>' % (L.code, BASE, L.prefix, tail)
                   for L in CNC_LANGS)
for tail, prio in [('concepts/', '0.8')] + [('concepts/%s/' % c, '0.7') for c in CNC_ORDER]:
    for L in CNC_LANGS:
        urls.append('<url><loc>%s/%s%s</loc>%s<changefreq>monthly</changefreq><priority>%s</priority></url>'
                    % (BASE, L.prefix, tail, sm_cnc_alts(tail), prio))
# атлас — одна страница на язык
_atl = [L for L in langs if getattr(L, 'has_atlas', False)]
for L in _atl:
    urls.append('<url><loc>%s/%satlas/</loc>%s<changefreq>monthly</changefreq><priority>0.8</priority></url>'
                % (BASE, L.prefix,
                   ''.join('<xhtml:link rel="alternate" hreflang="%s" href="%s/%satlas/"/>' % (x.code, BASE, x.prefix) for x in _atl)))
open(os.path.join(SITE, 'sitemap.xml'), 'w', encoding='utf-8').write(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" %s>\n' % XH +
    '\n'.join(urls) + '\n</urlset>\n')

# ---------- robots.txt (пускаем всех, включая AI-краулеры) ----------
open(os.path.join(SITE, 'robots.txt'), 'w', encoding='utf-8').write(
    'User-agent: *\nAllow: /\n\n'
    '# AI/LLM crawlers welcome\n'
    'User-agent: GPTBot\nAllow: /\n'
    'User-agent: OAI-SearchBot\nAllow: /\n'
    'User-agent: ChatGPT-User\nAllow: /\n'
    'User-agent: PerplexityBot\nAllow: /\n'
    'User-agent: ClaudeBot\nAllow: /\n'
    'User-agent: Claude-Web\nAllow: /\n'
    'User-agent: Google-Extended\nAllow: /\n'
    'User-agent: Applebot-Extended\nAllow: /\n'
    'User-agent: CCBot\nAllow: /\n\n'
    'Sitemap: %s/sitemap.xml\n' % BASE)

# ---------- llms.txt: русская и английская части ----------
RU, EN = langs[0], langs[1]
lines = ['# playdisplay', '', '> ' + ORG_DESC, '',
         'Студия playdisplay проектирует и реализует мультимедийные инсталляции, '
         'голографические кубы, решения дополненной и виртуальной реальности, '
         'проекционные и выставочные пространства. Основатель — Андрей Судариков. '
         'О студии рассказывал Discovery Channel. Среди клиентов — BMW, Ростех, '
         'Росатом, ОДК, аэропорты и национальные музеи России.', '',
         'English version: %s/en/' % BASE, '',
         '## Услуги / Services', '']
# ссылками, а не плоским перечнем: модель цитирует то, на что может сослаться
for _s in RU.services:
    lines.append('- [%s](%s/services/%s/): %s' % (_s['title'], BASE, _s['slug'], _s['subtitle']))
lines.append('- Полный цикл: от идеи до запуска (full cycle: concept to launch)')
lines += ['', '## Проекты', '']
for slug in ORDER:
    p = RU.pmap.get(slug, {})
    lines.append('- [%s](%s/work/%s/): %s' % (p.get('title'), BASE, slug, RU.meta_desc(slug)))
lines += ['', '## Projects (English)', '']
for slug in ORDER:
    p = EN.pmap.get(slug, {})
    lines.append('- [%s](%s/en/work/%s/): %s' % (p.get('title'), BASE, slug, EN.meta_desc(slug)))
# ---- Результаты: цифры отдельным разделом (22.08.2026) ----
# Языковой модели нужен не рассказ о процессе, а «сколько людей прошло и что
# изменилось». Такой фрагмент она цитирует целиком, поэтому даём его списком с
# адресом кейса рядом: сослаться модель может только на то, у чего есть URL.
# Печатаем ТОЛЬКО заполненное — у 10 кейсов из 15 результата пока нет.
_res = [(slug, RU.pmap.get(slug, {})) for slug in ORDER]
_res = [(s, p) for s, p in _res if (p.get('result') or {}).get('figures') or (p.get('result') or {}).get('text')]
if _res:
    lines += ['', '## Результаты проектов / Project outcomes', '']
    for slug, p in _res:
        r = p.get('result') or {}
        figs = '; '.join('%s — %s' % (f['n'], f['label']) for f in (r.get('figures') or []))
        head = '- [%s](%s/work/%s/)' % (p.get('title'), BASE, slug)
        lines.append('%s: %s' % (head, figs) if figs else head + ':')
        for para in (r.get('text') or [])[:1]:
            lines.append('  %s' % re.sub(r'\s+', ' ', para).strip())

# ---- Концепции: 28 готовых форматов, у каждого свой адрес ----
if RU.concepts:
    lines += ['', '## Концепции / Concepts', '',
              'Готовые к реализации форматы. У каждого своя страница с разбором: что решает, '
              'как устроено, где применимо.', '']
    for _c in RU.concepts:
        lines.append('- [%s](%s/concepts/%s/): %s' % (_c.get('title'), BASE, _c['id'], _c.get('line') or ''))

if os.path.exists(os.path.join(SITE, RU.data, 'atlas.json')):
    lines += ['', '## Атлас — принципы студии / Studio principles', '',
              '- [%s](%s/atlas/): 50 принципов, приёмов и наблюдений, по которым студия работает.'
              % (RU.t('Атлас: как мы думаем о пространстве'), BASE)]

lines += ['', '## Контакт / Contact', '',
          '- Сайт: %s/' % BASE,
          '- Email: info@playdisplay.com',
          '- Основатель: Андрей Судариков (Andrey Sudarikov)',
          '- Первый шаг: бесплатная 30-минутная креативная сессия — кнопка «Забронировать креативную сессию» на %s/' % BASE,
          '- Языки: русский, английский, португальский']
open(os.path.join(SITE, 'llms.txt'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')

# ---------- JSON-LD + noscript для главной ----------
def home_block(L):
    items = [{"@type": "ListItem", "position": i + 1, "url": L.url('work/%s/' % slug),
              "name": L.pmap.get(slug, {}).get('title')} for i, slug in enumerate(ORDER)]
    ld = [
        {"@context": "https://schema.org", "@type": "Organization", "name": "playdisplay",
         "url": BASE + '/', "description": (ORG_DESC_EN if L.code == 'en' else ORG_DESC),
         "logo": BASE + '/assets/logos/logo.svg', "sameAs": SOCIALS,
         "email": "info@playdisplay.com", "foundingDate": "2011",
         "areaServed": "Worldwide",
         "knowsAbout": ([
             "museum concept design", "interactive exhibition design", "multimedia installations",
             "immersive exhibitions", "visitor centre design", "projection mapping",
             "augmented and virtual reality", "interactive showrooms"
         ] if L.code == 'en' else [
             "разработка концепции музея", "дизайн интерактивной экспозиции",
             "мультимедийные инсталляции", "иммерсивные выставки", "visitor centre",
             "проекционный маппинг", "дополненная и виртуальная реальность",
             "интерактивные шоурумы"
         ]),
         "contactPoint": {"@type": "ContactPoint", "contactType": "sales",
                          "email": "info@playdisplay.com",
                          "availableLanguage": ["Russian", "English", "Portuguese"]},
         "founder": {"@type": "Person", "name": L.t('Андрей Судариков')},
         # Каталог услуг ссылками (21.08.2026). knowsAbout выше — это слова, по которым
         # нас можно опознать; hasOfferCatalog — адреса, на которые можно сослаться.
         # Разница важна для поисковых ИИ: процитировать они могут только то, у чего
         # есть URL. Список берётся из services.json, руками ничего не дублируется.
         **({"hasOfferCatalog": {
             "@type": "OfferCatalog",
             "name": L.t('Услуги playdisplay'),
             "itemListElement": [
                 {"@type": "Offer",
                  "itemOffered": {"@type": "Service", "name": s['title'],
                                  "description": s['subtitle'],
                                  "url": L.url('services/%s/' % s['slug'])}}
                 for s in L.services]}} if L.services else {})},
        {"@context": "https://schema.org", "@type": "WebSite", "name": "playdisplay",
         "url": L.url(), "inLanguage": L.code},
        {"@context": "https://schema.org", "@type": "ItemList",
         "name": ('playdisplay projects' if L.code == 'en' else 'Проекты playdisplay'),
         "itemListElement": items},
    ]
    ld_block = '\n'.join('<script type="application/ld+json">%s</script>' % json.dumps(x, ensure_ascii=False) for x in ld)
    ns_items = ''.join('<li><a href="%swork/%s/">%s</a> — %s</li>'
                       % ('' if L.code == 'ru' else '/' + L.prefix, slug,
                          esc(L.pmap[slug].get('title')), esc(L.meta_desc(slug)))
                       for slug in ORDER if slug in L.pmap)
    # В noscript кладём и концепции: у страниц /concepts/ нет входа из разметки SPA
    # (концепции открываются оверлеем без адреса), а обходчику нужен путь. Ссылки
    # в noscript краулеры читают — это дешевле и безопаснее, чем править живой SPA.
    ns_cnc = ''
    if getattr(L, 'concepts', None):
        ns_cnc = ('<section><h2>%s</h2><ul>%s</ul></section>'
                  % (esc(L.t('Концепции')),
                     ''.join('<li><a href="%sconcepts/%s/">%s</a> — %s</li>'
                             % ('' if L.code == 'ru' else '/' + L.prefix, c['id'],
                                esc(c.get('title')), esc(c.get('line') or ''))
                             for c in L.concepts)))
    ns_atl = ''
    if os.path.exists(os.path.join(SITE, L.data, 'atlas.json')):
        ns_atl = '<p><a href="%satlas/">%s</a></p>' % ('' if L.code == 'ru' else '/' + L.prefix,
                                                       esc(L.t('Атлас: как мы думаем о пространстве')))
    noscript = ('<noscript><section><h2>%s</h2><ul>%s</ul></section>%s%s</noscript>'
                % (('playdisplay projects' if L.code == 'en' else 'Проекты playdisplay'), ns_items, ns_cnc, ns_atl))
    return '<!--SEO-->\n' + ld_block + '\n' + noscript + '\n<!--/SEO-->'

# ---------- SEO-блок русской главной вставляем САМИ ----------
# Раньше блок писался в /tmp/seo_block.html, а вставлять его между маркерами
# <!--SEO-->…<!--/SEO--> должен был человек руками. Это ровно та же болезнь, что и
# /tmp/cases.json: ступень, которую надо помнить, однажды не делают. Английская версия
# всё это время вставлялась автоматически (см. ниже) — русская почему-то нет.
# Замена идёт строго между маркерами, поэтому запуск повторяем сколько угодно раз.
_home = open(os.path.join(SITE, 'index.html'), encoding='utf-8').read()
if '<!--SEO-->' not in _home:
    raise SystemExit('в site/index.html нет маркеров <!--SEO-->…<!--/SEO--> — вставлять некуда')
_new = re.sub(r'<!--SEO-->.*?<!--/SEO-->', lambda m: home_block(RU), _home, count=1, flags=re.S)
# отпечаток общих файлов проставляем здесь же: /en/index.html делается копией
# этого текста и получает его заодно, без второй ступени
_new = stamp_assets(_new)
if _new != _home:
    open(os.path.join(SITE, 'index.html'), 'w', encoding='utf-8').write(_new)
    print('index.html: обновлён (SEO-блок / отпечатки: %s)'
          % ', '.join('%s%s' % (n, VERSIONS[n]) for n in STAMPED))
else:
    print('index.html: уже актуален')

# ---------- /en/index.html — копия главной под английский ----------
src = _new
EN_TITLE = ('playdisplay — spaces people remember: museums, exhibitions, interactive exhibits')
EN_DESC = ORG_DESC_EN
EN_KEYS = ('museum concept design, interactive exhibit design, turnkey multimedia exhibition, '
           'visitor centre concept, immersive exhibition, interactive showroom, multimedia installation, '
           'projection mapping, museum exhibition, playdisplay, Andrey Sudarikov')
en = src
en = en.replace('<html lang="ru">', '<html lang="en">', 1)
# base — чтобы относительные пути (assets, videos, data) считались от корня, а не от /en/
en = en.replace('<head>', '<head>\n<base href="/">', 1)
en = re.sub(r'<title>.*?</title>', '<title>%s</title>' % esc(EN_TITLE), en, count=1, flags=re.S)
en = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="%s">' % esc(EN_DESC), en, count=1)
en = re.sub(r'<meta name="keywords" content="[^"]*">', '<meta name="keywords" content="%s">' % esc(EN_KEYS), en, count=1)
en = re.sub(r'\n?<link rel="alternate" hreflang="[^"]*" href="[^"]*">', '', en)   # чужие/русские — долой
en = en.replace('<link rel="canonical" href="%s/">' % BASE,
                '<link rel="canonical" href="%s/en/">\n%s' % (BASE, alternates('')), 1)
en = en.replace('<meta property="og:locale" content="ru_RU">', '<meta property="og:locale" content="en_US">', 1)
en = re.sub(r'<meta property="og:title" content="[^"]*">',
            '<meta property="og:title" content="playdisplay — spaces people remember">', en, count=1)
en = re.sub(r'<meta property="og:description" content="[^"]*">',
            '<meta property="og:description" content="%s">' % esc(EN_DESC), en, count=1)
en = en.replace('<meta property="og:url" content="%s/">' % BASE,
                '<meta property="og:url" content="%s/en/">' % BASE, 1)
en = re.sub(r'<meta name="twitter:title" content="[^"]*">',
            '<meta name="twitter:title" content="playdisplay — spaces people remember">', en, count=1)
en = re.sub(r'<meta name="twitter:description" content="[^"]*">',
            '<meta name="twitter:description" content="%s">' % esc(EN_DESC), en, count=1)
# язык и словарь — до основного скрипта, поэтому в самом конце head
# к словарю добавляем отпечаток содержимого: браузер держит его в кэше, и без метки
# правки перевода доезжали бы до посетителя только после сброса кэша
import hashlib
dic_path = os.path.join(SITE, 'data/i18n/en.js')
dic_ver = hashlib.sha1(open(dic_path, 'rb').read()).hexdigest()[:8]
# сцене язык передаём в адресе: она подхватит тот же словарь
en = re.sub(r'(src="hero-scene\.html[^"]*)"',
            lambda m: m.group(1) + '&lang=en"', en, count=1)
en = en.replace('</head>', "<script>window.PD_LANG='en';</script>\n"
                           '<script src="data/i18n/en.js?v=%s"></script>\n</head>' % dic_ver, 1)
# SEO-блок русской главной меняем на английский
en = re.sub(r'<!--SEO-->.*?<!--/SEO-->', lambda m: home_block(EN), en, count=1, flags=re.S)
# ссылка «Услуги» в меню: на английской копии ведёт в английский раздел.
# У /en/index.html стоит <base href="/">, поэтому и относительный путь, и абсолютный
# без префикса увели бы посетителя на русские страницы. Подписи переводит словарь
# на клиенте, адрес словарь не трогает — его меняем здесь.
_n_srv = en.count('href="/services/"')
if _n_srv != 2:
    raise SystemExit('в главной ожидались 2 ссылки на /services/ (шапка и мобильное меню), найдено %d' % _n_srv)
en = en.replace('href="/services/"', 'href="/en/services/"')
en = en.replace('name="Landing — Spatial Capture (RU)"', 'name="Landing — Spatial Capture (EN)"', 1)
en = en.replace('PlayDisplay long-form landing (RU)', 'PlayDisplay long-form landing (EN)', 1)
os.makedirs(os.path.join(SITE, 'en'), exist_ok=True)
open(os.path.join(SITE, 'en/index.html'), 'w', encoding='utf-8').write(en)
print('en/index.html: %.0f КБ, словарь %d строк' % (len(en) / 1024, len(EN.dic)))
print('sitemap/robots/llms + home JSON-LD ready; noscript items:', len(ORDER))
if MISSING:
    # без dict.fromkeys список удваивался: страницы работ рисуются дважды (второй раз —
    # чтобы в подвал попала ссылка на концепции), и одна и та же пропажа попадала в отчёт
    # два раза. Дубли в отчёте заставляют искать проблему там, где её нет.
    uniq = list(dict.fromkeys(MISSING))
    print('ПРОПУЩЕНЫ КАРТИНКИ (файла нет на диске), %d шт.:' % len(uniq))
    for m in uniq:
        print('   ', m)

