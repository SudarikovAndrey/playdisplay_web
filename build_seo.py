#!/usr/bin/env python3
# Генерирует SEO-обвязку для сайта PlayDisplay:
#  - статические индексируемые страницы /work/<slug>/index.html (полный текст проекта)
#  - sitemap.xml, robots.txt, llms.txt
#  - JSON-LD + мета-теги для главной (вставляются в site/index.html между маркерами)
# Запуск: python3 build_seo.py
import json, os, re, html

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(ROOT, 'site')
BASE = 'https://playdisplay.com'
ORG_DESC = ('PlayDisplay проектирует пространства и впечатления, которые люди запоминают: '
            'современные музеи, интерактивные экспозиции, visitor centre, шоурумы и '
            'иммерсивные выставки. Превращаем идею, историю или бренд в опыт, который хочется пережить.')
SOCIALS = [
    'https://www.facebook.com/playdisplay/',
    'https://vimeo.com/playdisplay5',
    'https://www.instagram.com/play.display/',
    'https://www.youtube.com/channel/UCVSeH8Y8m-_OLTm5coboICQ',
]

projects = json.load(open(os.path.join(SITE, 'data/projects.json'), encoding='utf-8'))['projects']
cases = {c['slug']: c for c in json.load(open('/tmp/cases.json', encoding='utf-8'))}
PMAP = {p['slug']: p for p in projects}
ORDER = [c['slug'] for c in json.load(open('/tmp/cases.json', encoding='utf-8'))]

def esc(t): return html.escape(t or '', quote=True)

def meta_desc(slug):
    c = cases.get(slug, {}); p = PMAP.get(slug, {})
    parts = [c.get('punch'), p.get('goal') or c.get('desc')]
    d = ' '.join(x for x in parts if x)
    d = re.sub(r'\s+', ' ', d).strip()
    return (d[:157] + '…') if len(d) > 158 else d

def cover_url(slug):
    c = cases.get(slug, {})
    img = c.get('img') or ''
    if img.startswith('http'): return img
    return BASE + '/assets/work/' + img if img else (PMAP[slug].get('cover') or '')

# ---------- статические страницы проектов ----------
def render_flow(p, slug):
    out = []
    if p.get('goal'): out.append('<section><h2>Цель проекта</h2><p>%s</p></section>' % esc(p['goal']))
    if p.get('solution'): out.append('<section><h2>Решение</h2><p>%s</p></section>' % esc(p['solution']))
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
                out.append('<img src="../../%s" alt="%s — %s" loading="lazy">' % (local, esc(p['title']), esc(p.get('subtitle') or '')))
        elif t in ('yt', 'vimeo'):
            url = ('https://www.youtube.com/watch?v=' + b['id']) if t == 'yt' else ('https://vimeo.com/' + b['id'])
            out.append('<p><a href="%s" rel="noopener">Смотреть видео проекта →</a></p>' % url)
    return '\n'.join(out)

def project_jsonld(slug):
    c = cases.get(slug, {}); p = PMAP.get(slug, {})
    data = {
        "@context": "https://schema.org", "@type": "CreativeWork",
        "name": p.get('title'), "headline": p.get('title'),
        "description": meta_desc(slug),
        "url": "%s/work/%s/" % (BASE, slug),
        "image": cover_url(slug),
        "inLanguage": "ru",
        "creator": {"@type": "Organization", "name": "PlayDisplay", "url": BASE + '/'},
        "keywords": ", ".join((p.get('tags') or []) + [p.get('client') or '', 'мультимедиа инсталляция']),
    }
    if p.get('year'): data["dateCreated"] = str(p['year'])
    if p.get('client'): data["about"] = p['client']
    return json.dumps(data, ensure_ascii=False, indent=0)

PAGE = '''<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} — PlayDisplay</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{base}/work/{slug}/">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta property="og:type" content="article">
<meta property="og:title" content="{title} — PlayDisplay">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{base}/work/{slug}/">
<meta property="og:image" content="{cover}">
<meta property="og:site_name" content="PlayDisplay">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{title} — PlayDisplay">
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
  <nav class="crumbs"><a href="../../">PlayDisplay</a> / <a href="../../#work">Проекты</a> / {title}</nav>
  <article>
    <h1>{title}</h1>
    <p style="color:#9fb4c8;font-size:20px">{subtitle}</p>
    <div class="meta">{metablk}</div>
    {flow}
    <a class="cta" href="../../#/work/{slug}">Открыть интерактивную версию →</a>
  </article>
  <footer>
    <p>PlayDisplay — пространства, которые люди запоминают: музеи, интерактивные экспозиции, visitor centre и иммерсивные выставки.</p>
    <p><a href="../../">На главную</a> · <a href="../../#work">Все проекты</a></p>
  </footer>
</main>
</body>
</html>
'''

def metablk(slug):
    p = PMAP.get(slug, {})
    rows = []
    if p.get('client'): rows.append('<div>Заказчик<b>%s</b></div>' % esc(p['client']))
    if p.get('term'): rows.append('<div>Срок реализации<b>%s</b></div>' % esc(p['term']))
    if p.get('year'): rows.append('<div>Год<b>%s</b></div>' % esc(str(p['year'])))
    return ''.join(rows)

n = 0
for slug in ORDER:
    p = PMAP.get(slug)
    if not p: continue
    d = os.path.join(SITE, 'work', slug)
    os.makedirs(d, exist_ok=True)
    open(os.path.join(d, 'index.html'), 'w', encoding='utf-8').write(PAGE.format(
        title=esc(p['title']), subtitle=esc(p.get('subtitle') or ''),
        desc=esc(meta_desc(slug)), base=BASE, slug=slug, cover=esc(cover_url(slug)),
        jsonld=project_jsonld(slug), metablk=metablk(slug), flow=render_flow(p, slug)))
    n += 1
print('project pages:', n)

# ---------- sitemap.xml ----------
urls = ['<url><loc>%s/</loc><changefreq>monthly</changefreq><priority>1.0</priority></url>' % BASE]
for slug in ORDER:
    urls.append('<url><loc>%s/work/%s/</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>' % (BASE, slug))
open(os.path.join(SITE, 'sitemap.xml'), 'w', encoding='utf-8').write(
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
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

# ---------- llms.txt (стандарт для AI-выдачи) ----------
lines = ['# PlayDisplay', '', '> ' + ORG_DESC, '',
         'Студия PlayDisplay проектирует и реализует мультимедийные инсталляции, '
         'голографические кубы, решения дополненной и виртуальной реальности, '
         'проекционные и выставочные пространства. Основатель — Андрей Судариков. '
         'О студии рассказывал Discovery Channel. Среди клиентов — BMW, Ростех, '
         'Росатом, ОДК, аэропорты и национальные музеи России.', '',
         '## Проекты', '']
for slug in ORDER:
    p = PMAP.get(slug, {})
    lines.append('- [%s](%s/work/%s/): %s' % (p.get('title'), BASE, slug, meta_desc(slug)))
lines += ['', '## Контакт', '', '- Сайт: %s/' % BASE, '- Основатель: Андрей Судариков']
open(os.path.join(SITE, 'llms.txt'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')

# ---------- JSON-LD + noscript для главной (между маркерами) ----------
items = []
for i, slug in enumerate(ORDER):
    p = PMAP.get(slug, {})
    items.append({"@type": "ListItem", "position": i + 1,
                  "url": "%s/work/%s/" % (BASE, slug), "name": p.get('title')})
home_ld = [
    {"@context": "https://schema.org", "@type": "Organization", "name": "PlayDisplay",
     "url": BASE + '/', "description": ORG_DESC,
     "logo": BASE + '/assets/logos/logo.svg', "sameAs": SOCIALS,
     "founder": {"@type": "Person", "name": "Андрей Судариков"}},
    {"@context": "https://schema.org", "@type": "WebSite", "name": "PlayDisplay",
     "url": BASE + '/', "inLanguage": "ru"},
    {"@context": "https://schema.org", "@type": "ItemList", "name": "Проекты PlayDisplay",
     "itemListElement": items},
]
ld_block = '\n'.join('<script type="application/ld+json">%s</script>' % json.dumps(x, ensure_ascii=False) for x in home_ld)
ns_items = ''.join('<li><a href="work/%s/">%s</a> — %s</li>' % (slug, esc(PMAP[slug].get('title')), esc(meta_desc(slug))) for slug in ORDER if slug in PMAP)
noscript = ('<noscript><section><h2>Проекты PlayDisplay</h2><ul>' + ns_items +
            '</ul></section></noscript>')
block = '<!--SEO-->\n' + ld_block + '\n' + noscript + '\n<!--/SEO-->'
open('/tmp/seo_block.html', 'w', encoding='utf-8').write(block)
print('sitemap/robots/llms + home JSON-LD ready; noscript items:', len(ORDER))
