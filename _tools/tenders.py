#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Мониторинг закупок по нашему профилю: ЕИС (zakupki.gov.ru), 44-ФЗ и 223-ФЗ.

    python3 _tools/tenders.py              # только новое с прошлого запуска
    python3 _tools/tenders.py --all        # всё, что нашлось, без учёта памяти
    python3 _tools/tenders.py --min 500000 # поднять порог цены
    python3 _tools/tenders.py --mail a@b.ru  # прислать письмом

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
import base64
import gzip
import html as html_mod
import io
import json
import os
import re
import ssl
import subprocess
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
    # Отсев по первому боевому прогону 27.08.2026: эти закупки попадали
    # в дайджест только потому, что слово «музей» стояло в НАЗВАНИИ ЗАКАЗЧИКА.
    # Сам предмет к нам отношения не имеет.
    'транспортировк', 'перемещению музе', 'реставрацион', 'фасад',
    'кабельн', 'кл-6', 'траншея', 'фотооборудован',
    'защите культурных', 'техническому обслуживанию',
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


def interesting(item, min_price, today, skip_date=False):
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
    if not skip_date:
        d = dkey(item['deadline'])
        if d == '99999999' or d < today:
            return False
    return score(item) > 0


def send_mail(to, fresh, found, min_price, errors):
    """Письмо через sendmail хостинга.

    Почему не через почтовый слой сайта: там свой конфиг, и он как раз был
    настроен на «складывать в папку». Дайджест не должен зависеть от чужой
    настройки — sendmail на хостинге есть и работает сам по себе.

    Тема кодируется по RFC 2047, иначе кириллица приезжает крякозябрами.
    """
    lines = ['ЗАКУПКИ ПО НАШЕМУ ПРОФИЛЮ — %s' % time.strftime('%d.%m.%Y'),
             'новых %d, всего подходящих %d, порог %d руб.' % (len(fresh), len(found), min_price),
             '']
    for it in fresh:
        lines.append('%s  %s  до %s' % (it['price'] or '?', it['law'] or '?', it['deadline'] or '?'))
        lines.append(it['subject'][:200])
        lines.append(it['customer'][:140])
        lines.append(it['url'])
        lines.append('')
    if errors:
        lines.append('НЕ ОПРОШЕНО: ' + '; '.join(errors))
    body = '\n'.join(lines)

    subj = 'Закупки: %d новых на %s' % (len(fresh), time.strftime('%d.%m'))
    headers = [
        'From: PlayDisplay <ai@playdisplay.com>',
        'To: <%s>' % to,
        'Subject: =?UTF-8?B?%s?=' % base64.b64encode(subj.encode('utf-8')).decode('ascii'),
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        base64.b64encode(body.encode('utf-8')).decode('ascii'),
    ]
    try:
        pr = subprocess.Popen(['/usr/sbin/sendmail', '-t', '-i'], stdin=subprocess.PIPE)
        pr.communicate('\r\n'.join(headers).encode('utf-8'))
        if pr.returncode not in (0, None):
            sys.stderr.write('sendmail вернул код %s\n' % pr.returncode)
    except Exception as e:
        sys.stderr.write('письмо не ушло: %s\n' % e)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--all', action='store_true', help='не учитывать память о прошлых запусках')
    ap.add_argument('--min', type=int, default=MIN_PRICE, help='минимальная начальная цена')
    ap.add_argument('--json', action='store_true', help='выдать JSON вместо текста')
    ap.add_argument('--buyers', action='store_true',
                    help='кто заказывает экспозиции регулярно — список для прямого выхода')
    ap.add_argument('--mail', metavar='АДРЕС', default='',
                    help='отправить дайджест письмом (через sendmail хостинга)')
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
            if not interesting(it, args.min, today, args.buyers):
                continue
            it.setdefault('queries', [])
            if it['num'] in found:
                found[it['num']]['queries'].append(q)
            else:
                it['queries'] = [q]
                found[it['num']] = it
        time.sleep(1.5)          # площадка государственная, вести себя прилично

    if args.buyers:
        # Режим разведки заказчиков. Действующих закупок в нише мало, но те, кто
        # заказывал экспозицию однажды, заказывают снова: у музея есть программа,
        # бюджетный цикл и очередь залов. Такому заказчику можно написать напрямую,
        # не дожидаясь торгов. Поэтому здесь дата окончания НЕ фильтруется.
        agg = {}
        for it in found.values():
            key = it['customer']
            if not key:
                continue
            a_ = agg.setdefault(key, {'n': 0, 'sum': 0, 'last': '', 'max': ''})
            a_['n'] += 1
            a_['sum'] += price_num(it['price'])
            if dkey(it['placed']) > dkey(a_['last'] or '01.01.1970'):
                a_['last'] = it['placed']
                a_['max'] = it['subject'][:110]
        rows = sorted(agg.items(), key=lambda kv: -kv[1]['sum'])
        print('ЗАКАЗЧИКИ, КОТОРЫЕ ЗАКАЗЫВАЮТ ЭКСПОЗИЦИИ — %s' % time.strftime('%d.%m.%Y'))
        print('организаций: %d, закупок учтено: %d\n' % (len(rows), len(found)))
        for name, a_ in rows:
            print('%2d закупок · %14s \u20bd всего · последняя %s' % (a_['n'], '{:,}'.format(a_['sum']).replace(',', ' '), a_['last'] or '?'))
            print('   %s' % name[:110])
            print('   последний предмет: %s' % a_['max'])
            print('')
        return

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

    if args.mail and fresh:
        send_mail(args.mail, fresh, found, args.min, errors)

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
