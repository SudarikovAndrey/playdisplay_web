#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ранние сигналы: кто СОБИРАЕТСЯ заказывать экспозицию.

    python3 _tools/early.py --plans     # позиции планов-графиков
    python3 _tools/early.py --design    # закупки концепций, АХП и ТЭП
    python3 _tools/early.py             # оба
    python3 _tools/early.py --mail a@b  # прислать письмом

ЗАЧЕМ ОТДЕЛЬНО ОТ tenders.py. Тот ловит опубликованное извещение — момент,
когда техзадание уже написано, а часто и написано под конкретного подрядчика.
Влезать туда бессмысленно. Полезны две стадии ДО него:

1. ПОЗИЦИЯ ПЛАНА-ГРАФИКА. По 44-ФЗ заказчик обязан заранее опубликовать план
   закупок на год вперёд. Позиция даёт предмет, НМЦК и планируемый ГОД
   размещения извещения. Между позицией и извещением — от месяца до года,
   и всё это время техзадания ещё нет.

2. ЗАКУПКА ПРОЕКТНОЙ СТАДИИ. Крупной экспозиции всегда предшествует концепция,
   научная концепция, тематико-экспозиционный план или архитектурно-художественный
   проект. Стоят они сотни тысяч, а не десятки миллионов, конкуренция там меньше,
   и главное — тот, кто делает АХП, фактически и пишет потом ТЗ на реализацию.
   Пример из живой выдачи: Армавирская биофабрика объявила создание экспозиции
   «в соответствии с УТВЕРЖДЁННЫМ архитектурно-художественным проектом» —
   то есть проект кто-то сделал раньше, и этот кто-то был в сильной позиции.

Морфология на стороне ЕИС включена, падежи искать отдельно не нужно.
"""

import argparse
import base64
import io
import json
import os
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request

# Разбор карточки извещения не пишем заново: в tenders.py он ходит каждый день
# три недели и знает все особенности разметки ЕИС — подсветку найденных слов
# внутри предмета, цену отдельным блоком, даты по подписям. Свой разбор по
# плоскому тексту эти места ломал: предмет обрывался на первом подсвеченном
# слове, а цена и заказчик не находились вовсе.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tenders                                            # noqa: E402

UA = tenders.UA

# Слова для поиска планов-графиков. Их меньше, чем в tenders.py: план-график
# ищется по ВСЕМ позициям документа, и широкий запрос вытаскивает плановые
# документы целых администраций, где наше слово встретилось один раз в закупке
# канцтоваров. Отбор всё равно идёт потом по тексту позиции.
PLAN_QUERIES = [
    'мультимедийная экспозиция',
    'создание экспозиции',
    'интерактивная экспозиция',
    'музейное оборудование',
    'оснащение музея',
]

# Проектная стадия. Здесь наоборот — формулировок много, потому что называют
# одно и то же по-разному, а сумма маленькая и в общий дайджест такие закупки
# не попадают из-за порога цены.
DESIGN_QUERIES = [
    'концепция экспозиции',
    'научная концепция музея',
    'тематико-экспозиционный план',
    'архитектурно-художественный проект',
    'художественное проектирование экспозиции',
    'проектирование музейной экспозиции',
    'концепция музея',
]

# Ядро: без одного из этих слов позиция не наша.
CORE = [
    'музе', 'экспозиц', 'экспонат', 'выставк', 'выставочн',
    'визит-центр', 'визит центр', 'мемориал', 'панорам', 'диорам',
]

STOP = [
    'картридж', 'тонер', 'бумаг', 'канцеляр', 'заправк',
    'кровл', 'фасад', 'окон и двер', 'сантехн', 'отоплен',
    'питани', 'продукт', 'медицин', 'лекарств', 'автотранспорт',
    'уборк', 'охран', 'страхован', 'учебник', 'логопед',
    'дорожн', 'парковк', 'транспортировк', 'реставрацион',
    'кабельн', 'траншея', 'землеустро', 'кадастр', 'недвижимост',
    'территориальных зон', 'вывоз', 'коммунальн', 'электроэнерг',
]

SEEN_PATH = os.path.expanduser('~/.pd-early-seen.json')
ANCHOR = '<div class="registry-entry__header-mid__number">'


def fetch(url, tries=2):
    last = None
    for _ in range(tries):
        try:
            req = urllib.request.Request(url, headers={
                'User-Agent': UA, 'Accept-Language': 'ru-RU,ru;q=0.9'})
            return urllib.request.urlopen(req, timeout=90).read().decode('utf-8', 'replace')
        except Exception as e:
            last = e
            time.sleep(3)
    raise last


def flat(html):
    """Разметку в плоский текст. Теги в '|', чтобы соседние подписи не слипались."""
    t = re.sub(r'<[^>]+>', '|', html)
    t = re.sub(r'&nbsp;?', ' ', t)
    t = t.replace('&laquo;', '«').replace('&raquo;', '»').replace('&quot;', '"')
    t = re.sub(r'&#\d+;', ' ', t)
    t = re.sub(r'\|+', '|', t)
    t = re.sub(r'[ \t\r\n]+', ' ', t)
    return t


def ok(text):
    t = text.lower()
    if any(w in t for w in STOP):
        return False
    return any(w in t for w in CORE)


def plan_search(query):
    """Планы-графики, в позициях которых встретилось слово."""
    url = ('https://zakupki.gov.ru/epz/orderplan/search/results.html'
           '?searchString=%s&morphology=on&pageNumber=1&sortDirection=false'
           '&recordsPerPage=_20&fz44=on' % urllib.parse.quote(query))
    html = fetch(url)
    starts = [m.start() for m in re.finditer(re.escape(ANCHOR), html)]
    out = []
    for a, b in zip(starts, starts[1:] + [len(html)]):
        part = html[a:b]
        num = re.search(r'№\s*(\d{15,25})', flat(part))
        cust = re.search(r'\|Заказчик\|\s*\|\s*\|\s*([^|]{6,200}?)\s*\|', flat(part))
        if not num:
            continue
        out.append({'plan': num.group(1),
                    'customer': (cust.group(1).strip() if cust else '')})
    return out


POS_ROW = '<div class="row bt-4 pb-4 pt-4 text-base-mid b-bottom">'


def plan_positions(plan, min_year):
    """Позиции одного плана-графика.

    Разбор по структуре строки, а не по плоскому тексту. Строка позиции
    устроена так: col-4 — код КТРУ ссылкой, первый col-2 — ПРЕДМЕТ, дальше
    примечание, дальше ЦЕНА, а в спрятанном блоке id="positionN" лежит
    планируемый год размещения извещения. Первая версия брала самую длинную
    строку куска и регулярно вытаскивала вместо предмета название заказчика.

    min_year отсекает главное: планы-графики живут в ЕИС с 2020 года, и без
    этого фильтра три четверти выдачи — закупки, которые давно состоялись.
    Нас интересует только то, чего ЕЩЁ не было.
    """
    url = ('https://zakupki.gov.ru/epz/orderplan/pg2020/positions.html'
           '?plan-number=%s' % plan)
    html = fetch(url)
    starts = [m.start() for m in re.finditer(re.escape(POS_ROW), html)]
    out = []
    for a, b in zip(starts, starts[1:] + [len(html)]):
        row = html[a:b]
        mnum = re.search(r'position-number=(\d{20,30})', row)
        if not mnum:
            continue
        cells = re.findall(r'<div class="col-2[^"]*">\s*([^<]{3,600}?)\s*</div>', row)
        subj, price = '', ''
        for c in cells:
            c = tenders.strip(c)
            if re.match(r'^[\d\s]+,\d\d$', c):
                if not price:
                    price = c
            elif len(c) > len(subj):
                subj = c
        if not subj or not ok(subj):
            continue
        my = re.search(r'Планируемый год размещения[^<]*(?:<[^>]+>\s*)*?</div>\s*'
                       r'<div class="common-text__value">\s*(\d{4})', row, re.S)
        year = int(my.group(1)) if my else 0
        if year and year < min_year:
            continue
        okpd = re.search(r'\b(\d\d\.\d\d(?:\.\d\d?)?)\s*:', row)
        out.append({
            'subject': re.sub(r'\s+', ' ', subj)[:260],
            'price': price,
            'year': str(year) if year else '',
            'okpd': okpd.group(1) if okpd else '',
            'plan': plan,
            'pos': mnum.group(1),
        })
    return out


def notice_search(query):
    """Извещения проектной стадии.

    Порога цены здесь нет намеренно: концепция или ТЭП стоят сотни тысяч,
    и общий порог в 300 000 ₽ отсёк бы ровно то, ради чего мы сюда пришли.

    Дату окончания проверяем сами: параметру af=on на стороне ЕИС верить
    нельзя, с ним в выдачу приезжают закупки 2014 года — это уже ловили
    в tenders.py.
    """
    page = tenders.fetch(query, per_page=20)
    today = time.strftime('%Y%m%d')
    out = []
    for it in tenders.parse(page):
        t = (it['subject'] + ' ' + it['customer']).lower()
        if any(w in t for w in STOP):
            continue
        if not any(w in t for w in CORE):
            continue
        d = tenders.dkey(it['deadline'])
        if d == '99999999' or d < today:
            continue
        it['key'] = it['num']
        out.append(it)
    return out


def send_mail(to, plans, designs):
    """Через sendmail хостинга — как в tenders.py и по той же причине:
    у почтового слоя сайта свой конфиг, и он уже был настроен «в папку»."""
    lines = ['РАННИЕ СИГНАЛЫ — %s' % time.strftime('%d.%m.%Y'),
             'Это стадии ДО извещения: планы и проектная документация.', '']
    lines += report_lines(plans, designs)
    body = '\n'.join(lines)
    subj = ('Ранние сигналы: планов %d, проектных закупок %d — %s'
            % (len(plans), len(designs), time.strftime('%d.%m')))
    headers = [
        'From: playdisplay <ai@playdisplay.com>',
        'To: <%s>' % to,
        'Subject: =?UTF-8?B?%s?=' % base64.b64encode(subj.encode('utf-8')).decode('ascii'),
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        base64.b64encode(body.encode('utf-8')).decode('ascii'),
    ]
    p = subprocess.Popen(['/usr/sbin/sendmail', '-t', '-i'], stdin=subprocess.PIPE)
    p.communicate(('\n'.join(headers) + '\n').encode('ascii'))
    return p.returncode == 0


def report_lines(plans, designs):
    out = []
    if plans:
        out += ['ПЛАНИРУЮТ ЗАКУПКУ — %d' % len(plans),
                'Извещения ещё нет. Техзадание, скорее всего, ещё не написано.', '']
        for p in plans:
            out.append('— %s' % p['subject'])
            bits = [p['price'] or 'цена не указана']
            if p['year']:
                bits.append('размещение в %s' % p['year'])
            if p['okpd']:
                bits.append('ОКПД2 %s' % p['okpd'])
            out.append('  %s' % ' · '.join(bits))
            out.append('  %s' % (p.get('customer') or '')[:140])
            out.append('  https://zakupki.gov.ru/epz/orderplan/pg2020/positions.html'
                       '?plan-number=%s' % p['plan'])
            out.append('')
    if designs:
        out += ['ПРОЕКТНАЯ СТАДИЯ — %d' % len(designs),
                'Концепции, ТЭП и АХП. Кто их делает — тот потом пишет ТЗ.', '']
        for d in designs:
            out.append('— %s' % d['subject'][:200])
            bits = [d['price'] or 'цена не указана', d['law'] or '?']
            if d['deadline']:
                bits.append('до %s' % d['deadline'])
            if d['placed']:
                bits.append('размещено %s' % d['placed'])
            out.append('  %s' % ' · '.join(bits))
            out.append('  %s' % d['customer'][:140])
            out.append('  %s' % d['url'])
            out.append('')
    if not out:
        out = ['Ничего нового.']
    return out


def main():
    ap = argparse.ArgumentParser(description='Ранние сигналы по экспозициям')
    ap.add_argument('--plans', action='store_true', help='только планы-графики')
    ap.add_argument('--design', action='store_true', help='только проектную стадию')
    ap.add_argument('--all', action='store_true', help='без учёта памяти')
    ap.add_argument('--mail', help='прислать письмом на этот адрес')
    ap.add_argument('--json', action='store_true')
    args = ap.parse_args()
    do_plans = args.plans or not args.design
    do_design = args.design or not args.plans

    seen = {}
    if os.path.exists(SEEN_PATH) and not args.all:
        try:
            seen = json.load(io.open(SEEN_PATH, encoding='utf-8'))
        except Exception:
            seen = {}

    errors = []
    plans, designs = [], []
    found_keys = []

    if do_plans:
        # Планы одного заказчика приезжают по нескольким запросам — режем по номеру.
        docs = {}
        for q in PLAN_QUERIES:
            try:
                for d in plan_search(q):
                    docs.setdefault(d['plan'], d)
            except Exception as e:
                errors.append('%s: %s' % (q, e))
        this_year = int(time.strftime('%Y'))
        for num, d in list(docs.items())[:40]:
            try:
                for pos in plan_positions(num, this_year):
                    pos['customer'] = d['customer']
                    key = 'P' + pos['pos']
                    found_keys.append(key)
                    if key not in seen:
                        plans.append(pos)
            except Exception as e:
                errors.append('план %s: %s' % (num, e))

    if do_design:
        seen_subj = set()
        for q in DESIGN_QUERIES:
            try:
                for it in notice_search(q):
                    if it['key'] in seen_subj:
                        continue
                    seen_subj.add(it['key'])
                    key = 'D' + it['key']
                    found_keys.append(key)
                    if key not in seen:
                        designs.append(it)
            except Exception as e:
                errors.append('%s: %s' % (q, e))

    if args.json:
        print(json.dumps({'plans': plans, 'designs': designs}, ensure_ascii=False, indent=1))
    else:
        print('РАННИЕ СИГНАЛЫ — %s' % time.strftime('%d.%m.%Y %H:%M'))
        print('новых позиций планов: %d, новых проектных закупок: %d'
              % (len(plans), len(designs)))
        if errors:
            print('НЕ ОПРОШЕНО: ' + '; '.join(errors[:4]))
        print('')
        for line in report_lines(plans, designs):
            print(line)

    if args.mail and (plans or designs):
        send_mail(args.mail, plans, designs)

    if not args.all:
        for k in found_keys:
            seen[k] = time.strftime('%Y-%m-%d')
        cutoff = time.strftime('%Y-%m-%d', time.localtime(time.time() - 365 * 86400))
        seen = dict((k, v) for k, v in seen.items() if v >= cutoff)
        try:
            io.open(SEEN_PATH, 'w', encoding='utf-8').write(
                json.dumps(seen, ensure_ascii=False))
        except Exception as e:
            sys.stderr.write('память не сохранилась: %s\n' % e)


if __name__ == '__main__':
    main()
