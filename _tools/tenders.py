#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Мониторинг закупок по нашему профилю: ЕИС (zakupki.gov.ru), 44-ФЗ и 223-ФЗ.

    python3 _tools/tenders.py              # только новое с прошлого запуска
    python3 _tools/tenders.py --all        # всё, что нашлось, без учёта памяти
    python3 _tools/tenders.py --min 500000 # поднять порог цены

ЗАПУСКАТЬ НА СЕРВЕРЕ. zakupki.gov.ru не отвечает на зарубежные адреса —
проверено 27.08.2026: с Мака в Бразилии код 000 и таймаут, с vh432.timeweb.ru
код 200 за 0,7 секунды. Поэтому инструмент живёт в репозитории, а работает там:

    scp _tools/tenders.py pdisplay@vh432.timeweb.ru:~/tenders.py
    ssh pdisplay@vh432.timeweb.ru 'python3 ~/tenders.py'

ЗАЧЕМ ВООБЩЕ. Замер частотности 26.08.2026 показал, что тендерный язык
в поиске мёртв: «закупка мультимедийного оборудования» — 8 показов в месяц,
«оснащение выставочного зала» — 1. Закупщики не гуглят подрядчика, они
публикуют закупку и ждут заявок. Значит SEO этот канал не берёт никогда,
а берёт его только регулярный просмотр площадки. Отсюда этот скрипт.

Зависимостей нет — стандартная библиотека, Python 3.6 (столько на хостинге).
"""
import argparse
import gzip
import html as html_mod
import io
import json
import os
import re
import ssl
import sys
import time
import urllib.parse
import urllib.request

# Фразы для поиска. Морфология на стороне ЕИС включена, поэтому падежи
# и числа искать отдельно не нужно: «мультимедийное оборудование» находит
# и «мультимедийного оборудования».
QUERIES = [
    'мультимедийное оборудование',
    'мультимедийная экспозиция',
    'интерактивное оборудование',
    'экспозиционное оборудование',
    'оснащение музея',
    'интерактивный экспонат',
    'создание экспозиции',
    'видеостена',
    'проекционное оборудование',
    'мультимедийная инсталляция',
    'интерактивная экспозиция',
    'музейное оборудование',
    'выставочный проект',
    'оснащение выставочного зала',
]

# Слишком дешёвое — это картриджи и мелкий ремонт, нам туда не надо.
MIN_PRICE = 300000

# Слова, по которым закупка отбрасывается сразу: одноимённые, но чужие темы.
STOP = [
    'картридж', 'тонер', 'бумаг', 'канцеляр', 'заправк',
    'кровл', 'фасад здан', 'окон и двер', 'сантехн', 'отоплен',
    'питани', 'продукт', 'медицин', 'лекарств', 'автотранспорт',
    'уборк', 'охран объект', 'страхован', 'учебник',
    'логопед', 'документ-камер', 'дорожн', 'парковк',
]

# ЯДРО. Без одного из этих слов закупка не наша, каким бы подходящим ни
# выглядело остальное. Проверено на живой выдаче 27.08.2026: без этого условия
# половину дайджеста занимали школьные интерактивные панели, логопедические
# комплексы и дорожные табло — там свой рынок и своя цена, мы туда не ходим.
CORE = [
    'музе', 'экспозиц', 'экспонат', 'выставк', 'выставочн',
    'визит-центр', 'визит центр', 'мемориал', 'панорам', 'диорам',
]

# Слова, повышающие вес: чем их больше в предмете, тем вероятнее это наше.
GOOD = [
    'мультимедиа', 'мультимедий', 'интерактив', 'экспозиц', 'музе',
    'выставочн', 'экспонат', 'проекцион', 'видеостен', 'светодиодн',
    'сенсорн', 'голограф', 'визуализац', 'инсталляц', 'аудиогид',
    'виртуальн', 'контент', 'сценар',
]

UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36')

SEEN_PATH = os.path.expanduser('~/.pd-tenders-seen.json')


def fetch(query, per_page=50):
    """Страница результатов расширенного поиска ЕИС.

    af=on — только те, куда ещё можно подать заявку. Без него половина выдачи
    это завершённые закупки прошлого года, и дайджест превращается в архив."""
    params = [
        ('searchString', query),
        ('morphology', 'on'),
        ('pageNumber', '1'),
        ('sortDirection', 'false'),
        ('recordsPerPage', '_%d' % per_page),
        ('fz44', 'on'), ('fz223', 'on'),
        ('af', 'on'), ('ca', 'on'), ('pc', 'on'), ('pa', 'on'),
    ]
    url = ('https://zakupki.gov.ru/epz/order/extendedsearch/results.html?'
           + urllib.parse.urlencode(params))
    req = urllib.request.Request(url, headers={
        'User-Agent': UA,
        'Accept-Language': 'ru-RU,ru;q=0.9',
        'Accept-Encoding': 'gzip',
    })
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE     # у ЕИС бывает свой корень в цепочке
    raw = urllib.request.urlopen(req, timeout=60, context=ctx).read()
    if raw[:2] == b'\x1f\x8b':
        raw = gzip.decompress(raw)
    return raw.decode('utf-8', 'replace')


def strip(s):
    """Текст из куска разметки: снять теги, вернуть сущности, сжать пробелы."""
    s = re.sub(r'<[^>]+>', ' ', s)
    s = html_mod.unescape(s)
    return re.sub(r'\s+', ' ', s).strip()


def field(block, title):
    """Значение блока по его подписи («Объект закупки», «Заказчик»…)."""
    m = re.search(
        r'__(?:body-title|title)"[^>]*>\s*' + re.escape(title) +
        r'\s*</div>\s*<div class="[^"]*__(?:body-value|body-href|value)"[^>]*>(.*?)</div>',
        block, re.S)
    return strip(m.group(1)) if m else ''


def parse(page):
    """Карточки закупок со страницы выдачи."""
    out = []
    # Карточка начинается с номера реестровой записи; режем по этому якорю.
    # re.split с пустым совпадением появился только в 3.7, а на хостинге 3.6 —
    # поэтому границы ищем сами и нарезаем срезами.
    anchor = '<div class="registry-entry__header-mid__number">'
    starts = [m.start() for m in re.finditer(re.escape(anchor), page)]
    parts = [page[a:b] for a, b in zip(starts, starts[1:] + [len(page)])]
    for p in parts:
        m = re.search(r'regNumber=(\d+)', p)
        if not m:
            continue
        num = m.group(1)
        link = re.search(r'href="(https://zakupki\.gov\.ru/epz/order/notice/[^"]+)"', p)
        subject = field(p, 'Объект закупки')
        customer = field(p, 'Заказчик')
        if not customer:
            mc = re.search(r'__body-href"[^>]*>\s*<a[^>]*>(.*?)</a>', p, re.S)
            customer = strip(mc.group(1)) if mc else ''
        price = ''
        mp = re.search(r'price-block__value"[^>]*>(.*?)</div>', p, re.S)
        if mp:
            price = strip(mp.group(1)).replace('₽', '').strip()
        dates = dict(re.findall(
            r'data-block__title">\s*([^<]+?)\s*</div>\s*<div class="data-block__value">\s*([^<]*?)\s*</div>', p))
        law = ''
        ml = re.search(r'(44-ФЗ|223-ФЗ)', p)
        if ml:
            law = ml.group(1)
        stage = ''
        ms = re.search(r'__header-mid__title[^>]*>(.*?)</div>', p, re.S)
        if ms:
            stage = strip(ms.group(1))
        out.append({
            'num': num,
            'law': law,
            'stage': stage,
            'subject': subject,
            'customer': customer,
            'price': price,
            'placed': dates.get('Размещено', ''),
            'deadline': dates.get('Окончание подачи заявок', ''),
            'url': link.group(1) if link else
                   'https://zakupki.gov.ru/epz/order/notice/ea44/view/common-info.html?regNumber=' + num,
        })
    return out


def price_num(s):
    d = re.sub(r'[^\d]', '', (s or '').split(',')[0])
    return int(d) if d else 0


def score(item):
    t = (item['subject'] + ' ' + item['customer']).lower()
    return sum(1 for w in GOOD if w in t)


def dkey(s):
    """Дата ДД.ММ.ГГГГ -> сортируемая строка. Пустая уезжает в конец."""
    m = re.match(r'(\d{2})\.(\d{2})\.(\d{4})', s or '')
    return (m.group(3) + m.group(2) + m.group(1)) if m else '99999999'


def interesting(item, min_price, today):
    t = (item['subject'] + ' ' + item['customer']).lower()
    if any(w in t for w in STOP):
        return False
    if not any(w in t for w in CORE):
        return False
    if price_num(item['price']) < min_price:
        return False
    # Параметру af=on на стороне ЕИС верить нельзя: с ним в выдачу всё равно
    # приезжают закупки позапрошлого года. Отсекаем по дате сами — единственный
    # надёжный способ не показывать владельцу то, куда уже не подать заявку.
    d = dkey(item['deadline'])
    if d == '99999999' or d < today:
        return False
    return score(item) > 0


def write_html(path, fresh, found, min_price, errors):
    """Дайджест страницей. Данные ЕИС публичные, прятать нечего, но и в поиск
    этой странице не надо — отсюда noindex."""
    rows = []
    for it in fresh:
        rows.append(
            '<article><h2><a href="{url}" target="_blank" rel="noopener">{subj}</a></h2>'
            '<p class="meta"><b>{price} \u20bd</b> \u00b7 {law} \u00b7 \u0434\u043e {dl}</p>'
            '<p class="cust">{cust}</p></article>'.format(
                url=it['url'],
                subj=html_mod.escape(it['subject'][:220]),
                price=html_mod.escape(it['price'] or '?'),
                law=html_mod.escape(it['law'] or '?'),
                dl=html_mod.escape(it['deadline'] or '?'),
                cust=html_mod.escape(it['customer'][:160])))
    doc = (
        '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<meta name="robots" content="noindex,nofollow">'
        '<title>\u0417\u0430\u043a\u0443\u043f\u043a\u0438 \u2014 playdisplay</title><style>'
        'body{font:16px/1.55 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;'
        'max-width:760px;margin:0 auto;padding:24px 18px 60px;background:#0b1116;color:#e8eef2}'
        'h1{font-size:20px;margin:0 0 4px}.sub{color:#8fa3b0;margin:0 0 26px;font-size:14px}'
        'article{border-top:1px solid #1e2b34;padding:16px 0}'
        'h2{font-size:16px;margin:0 0 6px;font-weight:600}'
        'a{color:#2be0c6;text-decoration:none}a:hover{text-decoration:underline}'
        '.meta{margin:0 0 4px;color:#e8eef2}.meta b{color:#ff9a6b}'
        '.cust{margin:0;color:#8fa3b0;font-size:14px}'
        '.none{color:#8fa3b0;padding:20px 0}</style></head><body>'
        '<h1>\u0417\u0430\u043a\u0443\u043f\u043a\u0438 \u043f\u043e \u043d\u0430\u0448\u0435\u043c\u0443 \u043f\u0440\u043e\u0444\u0438\u043b\u044e</h1>'
        '<p class="sub">' + time.strftime('%d.%m.%Y %H:%M') +
        ' \u00b7 \u043d\u043e\u0432\u044b\u0445 {n}, \u0432\u0441\u0435\u0433\u043e \u043f\u043e\u0434\u0445\u043e\u0434\u044f\u0449\u0438\u0445 {a}, '
        '\u043f\u043e\u0440\u043e\u0433 {p} \u20bd</p>'.format(n=len(fresh), a=len(found), p=min_price) +
        (''.join(rows) if rows else
         '<p class="none">\u041d\u043e\u0432\u043e\u0433\u043e \u043d\u0435\u0442. '
         '\u0417\u043d\u0430\u0447\u0438\u0442 \u0441\u0435\u0433\u043e\u0434\u043d\u044f \u043d\u0438\u0447\u0435\u0433\u043e '
         '\u043d\u0435 \u043f\u0440\u043e\u043f\u0443\u0449\u0435\u043d\u043e.</p>') +
        ('<p class="none">\u041d\u0435 \u043e\u043f\u0440\u043e\u0448\u0435\u043d\u043e: ' +
         html_mod.escape('; '.join(errors)) + '</p>' if errors else '') +
        '</body></html>')
    try:
        d = os.path.dirname(path)
        if d and not os.path.isdir(d):
            os.makedirs(d)
        io.open(path, 'w', encoding='utf-8').write(doc)
    except Exception as e:
        sys.stderr.write('страница не записалась: %s\n' % e)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--all', action='store_true', help='не учитывать память о прошлых запусках')
    ap.add_argument('--min', type=int, default=MIN_PRICE, help='минимальная начальная цена')
    ap.add_argument('--json', action='store_true', help='выдать JSON вместо текста')
    ap.add_argument('--html', metavar='ФАЙЛ', default='',
                    help='записать дайджест страницей (её можно открыть с телефона)')
    args = ap.parse_args()

    seen = {}
    if os.path.exists(SEEN_PATH) and not args.all:
        try:
            seen = json.load(io.open(SEEN_PATH, encoding='utf-8'))
        except Exception:
            seen = {}

    today = time.strftime('%Y%m%d')
    found, errors = {}, []
    for q in QUERIES:
        try:
            page = fetch(q)
        except Exception as e:
            errors.append('%s: %s' % (q, e))
            continue
        for it in parse(page):
            if not interesting(it, args.min, today):
                continue
            it.setdefault('queries', [])
            if it['num'] in found:
                found[it['num']]['queries'].append(q)
            else:
                it['queries'] = [q]
                found[it['num']] = it
        time.sleep(1.5)          # площадка государственная, вести себя прилично

    fresh = [v for k, v in found.items() if k not in seen]
    fresh.sort(key=lambda x: (dkey(x['deadline']), -score(x)))

    if args.json:
        print(json.dumps(fresh, ensure_ascii=False, indent=1))
    else:
        print('ЗАКУПКИ ПО НАШЕМУ ПРОФИЛЮ — %s' % time.strftime('%d.%m.%Y %H:%M'))
        print('запросов: %d, найдено подходящих: %d, из них новых: %d, порог цены: %d ₽'
              % (len(QUERIES), len(found), len(fresh), args.min))
        if errors:
            print('НЕ ОПРОШЕНО: ' + '; '.join(errors))
        print('')
        for it in fresh:
            print('— %s' % it['subject'][:150])
            print('  %s · %s · до %s · размещено %s'
                  % (it['price'] or 'цена не указана', it['law'] or '?',
                     it['deadline'] or '?', it['placed'] or '?'))
            print('  %s' % it['customer'][:120])
            print('  %s' % it['url'])
            print('')

    if args.html:
        write_html(args.html, fresh, found, args.min, errors)

    if not args.all:
        for k in found:
            seen[k] = time.strftime('%Y-%m-%d')
        # память чистим от старого, иначе файл растёт вечно
        cutoff = time.strftime('%Y-%m-%d', time.localtime(time.time() - 180 * 86400))
        seen = dict((k, v) for k, v in seen.items() if v >= cutoff)
        try:
            io.open(SEEN_PATH, 'w', encoding='utf-8').write(
                json.dumps(seen, ensure_ascii=False))
        except Exception as e:
            sys.stderr.write('память не сохранилась: %s\n' % e)


if __name__ == '__main__':
    main()
