#!/usr/bin/env python3
# Генерирует SEO-обвязку сайта playdisplay ДЛЯ ВСЕХ ЯЗЫКОВ:
#  - статические индексируемые страницы /work/<slug>/ и /en/work/<slug>/ (полный текст проекта)
#  - /en/index.html — копия главной с англоязычными мета-тегами, base, SEO-блоком и словарём
#  - sitemap.xml (обе версии + hreflang), robots.txt, llms.txt
#  - JSON-LD + noscript для русской главной (в /tmp/seo_block.html, вставляется между маркерами)
#
# Как устроено двуязычие: русский текст лежит прямо в site/index.html и site/data/*.json.
# Английский приходит словарём site/data/i18n/en.js («русская строка» → «перевод») и
# отдельными файлами данных site/data/en/*.json. Страница /en/ — сгенерированная копия
# главной. Добавить португальский = положить data/i18n/pt.js + data/pt/*.json и вписать
# язык в LANGS здесь и в LANGS в index.html.
#
# Запуск: python3 build_seo.py
import json, os, re, html

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(ROOT, 'site')
BASE = 'https://playdisplay.com'
ORG_DESC = ('playdisplay проектирует пространства и впечатления, которые люди запоминают: '
            'современные музеи, интерактивные экспозиции, visitor centre, шоурумы и '
            'иммерсивные выставки. Превращаем идею, историю или бренд в опыт, который хочется пережить.')
ORG_DESC_EN = ('playdisplay designs spaces and experiences people remember: contemporary museums, '
               'interactive exhibits, visitor centres, showrooms and immersive exhibitions. '
               'We turn an idea, a story or a brand into an experience worth living through.')
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

cases = {c['slug']: c for c in json.load(open('/tmp/cases.json', encoding='utf-8'))}
ORDER = [c['slug'] for c in json.load(open('/tmp/cases.json', encoding='utf-8'))]


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

    def meta_desc(self, slug):
        c = cases.get(slug, {}); p = self.pmap.get(slug, {})
        parts = [self.t(c.get('punch')), p.get('goal') or self.t(c.get('desc'))]
        d = ' '.join(x for x in parts if x)
        d = re.sub(r'\s+', ' ', d).strip()
        return (d[:157] + '…') if len(d) > 158 else d


def cover_url(slug, pmap):
    c = cases.get(slug, {})
    img = c.get('img') or ''
    if img.startswith('http'): return img
    return BASE + '/assets/work/' + img if img else (pmap[slug].get('cover') or '')


# ---------- статические страницы проектов ----------
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
                # png мог быть пережат в jpg
                cand = os.path.join(SITE, local)
                if not os.path.exists(cand) and local.endswith('.png') and os.path.exists(cand[:-4] + '.jpg'):
                    local = local[:-4] + '.jpg'
                out.append('<img src="%s%s" alt="%s — %s" loading="lazy">' % (L.up, local, esc(p['title']), esc(p.get('subtitle') or '')))
        elif t in ('yt', 'vimeo'):
            url = ('https://www.youtube.com/watch?v=' + b['id']) if t == 'yt' else ('https://vimeo.com/' + b['id'])
            out.append('<p><a href="%s" rel="noopener">%s</a></p>' % (url, L.t('Смотреть видео проекта →')))
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
    return json.dumps(data, ensure_ascii=False, indent=0)


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
<title>{title} — playdisplay</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{canon}">
{alts}
<meta name="robots" content="index,follow,max-image-preview:large">
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
  .cta {{ display:inline-block; margin-top:44px; padding:15px 26px; border:1px solid #2be0c6; color:#2be0c6; text-decoration:none; font-weight:600; }}
  .crumbs {{ font:500 13px monospace; letter-spacing:.14em; text-transform:uppercase; color:#9fb4c8; margin-bottom:40px; }}
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
    <a class="cta" href="{home}#/work/{slug}">{cta}</a>
  </article>
  <footer>
    <p>{footer}</p>
    <p><a href="{home}">{f_home}</a> · <a href="{home}#work">{f_all}</a></p>
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

for L in langs:
    n = 0
    for slug in ORDER:
        p = L.pmap.get(slug)
        if not p: continue
        d = os.path.join(SITE, L.prefix, 'work', slug)
        os.makedirs(d, exist_ok=True)
        open(os.path.join(d, 'index.html'), 'w', encoding='utf-8').write(PAGE.format(
            lang=L.code, title=esc(p['title']), subtitle=esc(p.get('subtitle') or ''),
            desc=esc(L.meta_desc(slug)), canon=L.url('work/%s/' % slug), alts=alternates('work/%s/' % slug),
            slug=slug, cover=esc(cover_url(slug, L.pmap)), locale=L.locale, home=L.up + L.prefix,
            jsonld=project_jsonld(L, slug), metablk=metablk(L, slug), flow=render_flow(L, p, slug),
            work=L.t('Проекты'), cta=L.t('Открыть интерактивную версию →'),
            footer=(FOOT_EN if L.code == 'en' else FOOT_RU),
            f_home=L.t('На главную'), f_all=L.t('Все проекты')))
        n += 1
    print('project pages [%s]: %d' % (L.code, n))

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
         '## Проекты', '']
for slug in ORDER:
    p = RU.pmap.get(slug, {})
    lines.append('- [%s](%s/work/%s/): %s' % (p.get('title'), BASE, slug, RU.meta_desc(slug)))
lines += ['', '## Projects (English)', '']
for slug in ORDER:
    p = EN.pmap.get(slug, {})
    lines.append('- [%s](%s/en/work/%s/): %s' % (p.get('title'), BASE, slug, EN.meta_desc(slug)))
lines += ['', '## Контакт', '', '- Сайт: %s/' % BASE, '- Основатель: Андрей Судариков']
open(os.path.join(SITE, 'llms.txt'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')

# ---------- JSON-LD + noscript для главной ----------
def home_block(L):
    items = [{"@type": "ListItem", "position": i + 1, "url": L.url('work/%s/' % slug),
              "name": L.pmap.get(slug, {}).get('title')} for i, slug in enumerate(ORDER)]
    ld = [
        {"@context": "https://schema.org", "@type": "Organization", "name": "playdisplay",
         "url": BASE + '/', "description": (ORG_DESC_EN if L.code == 'en' else ORG_DESC),
         "logo": BASE + '/assets/logos/logo.svg', "sameAs": SOCIALS,
         "founder": {"@type": "Person", "name": L.t('Андрей Судариков')}},
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
    noscript = ('<noscript><section><h2>%s</h2><ul>%s</ul></section></noscript>'
                % (('playdisplay projects' if L.code == 'en' else 'Проекты playdisplay'), ns_items))
    return '<!--SEO-->\n' + ld_block + '\n' + noscript + '\n<!--/SEO-->'

open('/tmp/seo_block.html', 'w', encoding='utf-8').write(home_block(RU))

# ---------- /en/index.html — копия главной под английский ----------
src = open(os.path.join(SITE, 'index.html'), encoding='utf-8').read()
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
en = en.replace('<link rel="canonical" href="https://playdisplay.com/">',
                '<link rel="canonical" href="%s/en/">\n%s' % (BASE, alternates('')), 1)
en = en.replace('<meta property="og:locale" content="ru_RU">', '<meta property="og:locale" content="en_US">', 1)
en = re.sub(r'<meta property="og:title" content="[^"]*">',
            '<meta property="og:title" content="playdisplay — spaces people remember">', en, count=1)
en = re.sub(r'<meta property="og:description" content="[^"]*">',
            '<meta property="og:description" content="%s">' % esc(EN_DESC), en, count=1)
en = en.replace('<meta property="og:url" content="https://playdisplay.com/">',
                '<meta property="og:url" content="%s/en/">' % BASE, 1)
en = re.sub(r'<meta name="twitter:title" content="[^"]*">',
            '<meta name="twitter:title" content="playdisplay — spaces people remember">', en, count=1)
en = re.sub(r'<meta name="twitter:description" content="[^"]*">',
            '<meta name="twitter:description" content="%s">' % esc(EN_DESC), en, count=1)
# язык и словарь — до основного скрипта, поэтому в самом конце head
en = en.replace('</head>', "<script>window.PD_LANG='en';</script>\n"
                           '<script src="data/i18n/en.js"></script>\n</head>', 1)
# SEO-блок русской главной меняем на английский
en = re.sub(r'<!--SEO-->.*?<!--/SEO-->', lambda m: home_block(EN), en, count=1, flags=re.S)
en = en.replace('name="Landing — Spatial Capture (RU)"', 'name="Landing — Spatial Capture (EN)"', 1)
en = en.replace('PlayDisplay long-form landing (RU)', 'PlayDisplay long-form landing (EN)', 1)
os.makedirs(os.path.join(SITE, 'en'), exist_ok=True)
open(os.path.join(SITE, 'en/index.html'), 'w', encoding='utf-8').write(en)
print('en/index.html: %.0f КБ, словарь %d строк' % (len(en) / 1024, len(EN.dic)))
print('sitemap/robots/llms + home JSON-LD ready; noscript items:', len(ORDER))
