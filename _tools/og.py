#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Карточки превью для мессенджеров: 1200×630 на каждый раздел.

    _tools/venv/bin/python _tools/og.py

Зачем. Основной канал распространения у студии — ссылка, отправленная руками
в мессенджер. Значит превью этой ссылки и есть самый используемый рекламный
носитель. До этого превью были общими: четыре разных раздела показывали одну
и ту же фотографию, а формат был квадратный 960×960 — Telegram, WhatsApp и VK
ждут 1200×630 и квадрат обрезают.

Как. Берём кадр из атласа концепций — рендер, сделанный под конкретный
сценарий, а не случайное фото, — притемняем градиентом, кладём надстрочник,
заголовок и подпись.

Шрифты те же, что на сайте: Unbounded 800 в заголовке, Onest в подписи,
Roboto Mono в надстрочнике. Своё лицо в ленте чужих ссылок узнаётся раньше,
чем прочитан текст. Pillow не читает woff2, поэтому рядом лежат ttf-версии
тех же гарнитур — их делает _tools/mkfonts.py из подмножеств сайта.
"""
import os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, 'site')
OUT = os.path.join(SITE, 'assets', 'og')
FONTS = os.path.join(SITE, 'assets', 'fonts')
W, H = 1200, 630
TEAL = (43, 224, 198)
AMBER = (255, 106, 61)
WHITE = (241, 251, 252)
DIM = (159, 180, 200)
BAND = (60, 280, int(W * 0.78), 560)   # полоса, куда ляжет текст

# Pillow не открывает woff2, а на сайте лежат только они. mkfonts.py собирает
# из тех же подмножеств статические ttf — это и есть шрифты сайта, просто
# в формате, который читает растеризатор.
TTF = os.path.join(ROOT, '_tools', 'fonts')

def font(name, size):
    for d in (TTF, FONTS):
        p = os.path.join(d, name)
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    raise SystemExit('нет шрифта: ' + name)

def tw(dr, text, f, track=0.0):
    """ширина строки с межбуквенным интервалом"""
    if not track:
        return dr.textlength(text, font=f)
    return sum(dr.textlength(c, font=f) for c in text) + track * max(0, len(text) - 1)

def tt(dr, xy, text, f, fill, track=0.0):
    """Unbounded на сайте идёт с tracking -0.02em, надстрочник — с +0.18em.
    Pillow интервалом не управляет, поэтому рисуем посимвольно."""
    if not track:
        dr.text(xy, text, font=f, fill=fill); return
    x, y = xy
    for c in text:
        dr.text((x, y), c, font=f, fill=fill)
        x += dr.textlength(c, font=f) + track

def fit(draw, text, f, maxw, track=0.0):
    """перенос по словам под ширину"""
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if tw(draw, t, f, track) <= maxw or not cur:
            cur = t
        else:
            lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

def card(photo, kicker, title, sub, dest):
    im = Image.new('RGB', (W, H), (4, 12, 16))
    if photo and os.path.exists(photo):
        src = Image.open(photo).convert('RGB')
        # заполняем кадр без искажения: масштаб по большей нехватке, затем обрезка
        k = max(W / src.width, H / src.height)
        src = src.resize((int(src.width * k) + 1, int(src.height * k) + 1), Image.LANCZOS)
        src = src.crop(((src.width - W) // 2, 0, (src.width - W) // 2 + W, H))
        # Лёгкое размытие. Одной яркости мало: дробный кадр — светодиодный
        # коридор, россыпь киосков — спорит с буквами не хуже светлого фона.
        # Кадр здесь фон, а не предмет: атмосферу он держит и размытым.
        src = src.filter(ImageFilter.GaussianBlur(3.2))
        im.paste(src, (0, 0))
        # Затемнение. Раньше низ уходил в глухой чёрный с 42% высоты, и карточка
        # читалась как два склеенных куска: фотография сверху, пустота снизу.
        # Теперь ровная подложка по всему кадру плюс мягкое усиление к низу
        # и влево — фотография остаётся видна под текстом, а текст читается.
        # Сила подложки зависит от кадра. Фиксированные 112 хорошо ложились на
        # светлый медиавитраж, но «Парящий объект» и так почти чёрный — та же
        # подложка добивала его в глухую заливку, и от рендера ничего не
        # оставалось. Меряем яркость будущей текстовой полосы в оригинале
        # и притемняем пропорционально.
        raw = src.crop(BAND).convert('L')
        raw_mean = sum(raw.getdata()) / (raw.width * raw.height)
        sh = Image.new('L', (W, H), 0)
        d = ImageDraw.Draw(sh)
        base = int(max(28, min(130, 112 * raw_mean / 90)))
        for y in range(H):
            down = 108 * max(0.0, (y - H * 0.30) / (H * 0.70)) ** 1.35
            d.line([(0, y), (W, y)], fill=int(min(255, base + down)))
        left = Image.new('L', (W, H), 0)
        dl = ImageDraw.Draw(left)
        for x in range(W):
            dl.line([(x, 0), (x, H)], fill=int(70 * max(0.0, 1.0 - x / (W * 0.75)) ** 1.2))
        sh = Image.eval(Image.merge('L', (sh,)), lambda v: v)
        sh = Image.blend(sh, Image.eval(sh, lambda v: v), 0)
        sh = ImageChops.add(sh, left)
        im = Image.composite(Image.new('RGB', (W, H), (3, 10, 14)), im,
                             sh.filter(ImageFilter.GaussianBlur(3)))

        # САМОПРОВЕРКА ЯРКОСТИ. Пропорциональная подложка попадает не всегда:
        # пёстрый кадр может дать среднюю яркость в норме и всё равно спорить
        # с буквами. Мерим среднюю яркость полосы, куда ляжет текст, и дожимаем
        # затемнение, пока она не станет достаточно тёмной. Подбирать под каждый
        # кадр руками — значит однажды забыть про новый.
        band = im.crop(BAND).convert('L')
        for _ in range(6):
            mean = sum(band.getdata()) / (band.width * band.height)
            if mean <= 55:
                break
            im = Image.blend(im, Image.new('RGB', (W, H), (3, 10, 14)), 0.16)
            band = im.crop(BAND).convert('L')

    dr = ImageDraw.Draw(im)
    x, y = 72, 292
    if kicker:
        fk = font('RobotoMono-Regular.ttf', 21)
        dr.line([(x, y + 11), (x + 40, y + 11)], fill=TEAL, width=2)
        tt(dr, (x + 56, y), kicker.upper(), fk, TEAL, track=21 * 0.18)
        y += 46
    # Unbounded шире привычного гротеска: на 62 пикселях заголовок ломался
    # на четыре строки. 50 держит два-три ряда.
    ft = font('Unbounded-800.ttf', 50)
    tr = -50 * 0.02
    for ln in fit(dr, title, ft, W - x - 96, tr)[:3]:
        tt(dr, (x, y), ln, ft, WHITE, tr); y += 64
    if sub:
        fs = font('Onest-400.ttf', 27)
        y += 10
        for ln in fit(dr, sub, fs, W - x - 96)[:2]:
            dr.text((x, y), ln, font=fs, fill=DIM); y += 38
    # марка студии в углу — ссылка в ленте должна быть узнаваемой
    fl = font('Unbounded-700.ttf', 22)
    tt(dr, (x, H - 60), 'PLAYDISPLAY', fl, WHITE, track=22 * 0.06)
    dr.text((x + tw(dr, 'PLAYDISPLAY', fl, 22 * 0.06) + 12, H - 62), '\u00ae',
            font=font('Onest-500.ttf', 15), fill=AMBER)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    im.save(dest, 'JPEG', quality=88, optimize=True, progressive=True)
    return dest


# Кадр подбирается по смыслу раздела, а не «какой первый попался»: человек
# в мессенджере видит картинку раньше, чем читает заголовок.
C = 'assets/concepts/'

CARDS = [
 # «Погружение» — люди силуэтами перед панорамой: экспозиция, а не техника.
 ('og-home.jpg',        C+'panorama-dive/1.jpg',      'Мультимедийные экспозиции',
  'Пространства, которые люди запоминают', 'Музеи, выставки, интерактивные экспозиции. С 2011 года'),
 # Коридор из светодиодных строк — сама фактура каталога технологий.
 ('og-library.jpg',     C+'living-lines/1.jpg',       'Библиотека оборудования',
  'Мультимедиа технологии', '65 типов: что каждое умеет и обо что спотыкаются на второй год'),
 # Медиавитраж собран из модулей разной формы — ровно то, о чём раздел вывода.
 ('og-lib-output.jpg',  C+'media-vitrage/1.jpg',      'Оборудование вывода',
  'Чем экспозиция говорит с человеком', 'Проекция, светодиод, объём, звук, движение — 24 позиции'),
 # Руки на энкодере, кнопках и тач-панели: ввод в чистом виде.
 ('og-lib-input.jpg',   C+'mars/1.jpg',               'Оборудование ввода',
  'Чем человек отвечает экспозиции', 'Касание, жест, голос, присутствие — 20 позиций'),
 # Центр управления — то, чего посетитель не видит, но чем всё сведено.
 ('og-lib-proc.jpg',    C+'control-center/1.jpg',     'Обработка и управление',
  'То, чего не видно, и на чём всё держится', 'Машины, движки, сеть, эксплуатация — 21 позиция'),
 # Порог: впечатление начинается до экспозиции. Ещё и в фирменном янтаре.
 ('og-services.jpg',    C+'threshold/1.jpg',          'Услуги',
  'Что мы делаем', 'От концепции музея до запуска экспозиции'),
 # Собранный стенд с киосками и витринами — как выглядит оснащение целиком.
 ('og-equipping.jpg',   C+'cubic-expo/1.jpg',         'Оснащение музея',
  'Техническое задание, которое можно защитить', 'Напишем или проверим ваше. Бесплатно'),
 # Голографическая витрина и тач-консоль в музейном зале.
 ('og-equipment.jpg',   C+'floating-object/1.jpg',    'Оборудование для музея',
  'Железо выбирают последним', 'Сначала сценарий, потом взаимодействие, и только потом техника'),
 # «Экраны становятся архитектурой» — концепция про сам жанр концепций.
 ('og-concepts.jpg',    C+'form-library/1.jpg',       'Авторские концепции',
  'Библиотека решений', '28 готовых форматов: замысел, сценарий, что нужно'),
 # Один объект останавливает поток — принцип, а не проект. Это и есть атлас.
 ('og-atlas.jpg',       C+'weightlessness/1.jpg',     'Атлас',
  'Как создаются впечатления', '50 принципов, по которым работает студия'),
 # Панорамная светодиодная стена и люди перед ней — мультимедиа как система.
 ('og-mm-equipment.jpg', C+'living-panorama/1.jpg',  'Мультимедийное оборудование',
  'Десять коробок или одна система', 'Из чего собирается комплекс, чем профи отличается от бытового, коды ОКПД2'),
 # Музейный зал с витринами и пультами, без чужих логотипов на кадре.
 ('og-corp-museum.jpg', C+'living-ship/1.jpg',  'Корпоративный музей',
  'Не комната, куда водят гостей', 'Партнёры, новички и школьники — одна экспозиция на три аудитории'),
 # Прыжок в цифровой мир: страница про интерактивный сайт и брендированные игры.
 ('og-web.jpg',  C+'city-flight/1.jpg',     'Интерактивный сайт',
  'Вы уже на примере', 'Сцена в реальном времени вместо страницы с блоками. И брендированные игры'),
 ('og-space.jpg', C+'sales-showroom/1.jpg', 'Мультимедийное пространство',
  'Место, которое продаёт образ жизни', 'Шоурум, бренд-зона, презентационный зал'),
]

# Английская версия сайта отдавала те же карточки с русским текстом: ссылку
# на /en/ шлют иностранному заказчику, и первое, что он видит, — кириллица.
CARDS_EN = [
 ('og-home.jpg',        C+'panorama-dive/1.jpg',      'Multimedia exhibitions',
  'Spaces people remember', 'Museums, expos, interactive exhibitions. Since 2011'),
 ('og-library.jpg',     C+'living-lines/1.jpg',       'Equipment library',
  'Multimedia technology', '65 types: what each one does and where it fails in year two'),
 ('og-lib-output.jpg',  C+'media-vitrage/1.jpg',      'Output equipment',
  'How the exhibition speaks', 'Projection, LED, volume, sound, motion — 24 entries'),
 ('og-lib-input.jpg',   C+'mars/1.jpg',               'Input equipment',
  'How the visitor answers', 'Touch, gesture, voice, presence — 20 entries'),
 ('og-lib-proc.jpg',    C+'control-center/1.jpg',     'Processing and control',
  'The part nobody sees', 'Machines, engines, network, operation — 21 entries'),
 ('og-services.jpg',    C+'threshold/1.jpg',          'Services',
  'What we do', 'From museum concept to opening day'),
 ('og-equipping.jpg',   C+'cubic-expo/1.jpg',         'Museum equipping',
  'A spec that survives review', 'We write yours or audit it. Free'),
 ('og-equipment.jpg',   C+'floating-object/1.jpg',    'Museum equipment',
  'Hardware comes last', 'Story first, interaction second, devices third'),
 ('og-concepts.jpg',    C+'form-library/1.jpg',       'Original concepts',
  'A library of solutions', '28 ready formats: intent, script, what it takes'),
 ('og-atlas.jpg',       C+'weightlessness/1.jpg',     'Atlas',
  'How experiences are made', '50 principles the studio works by'),
 ('og-mm-equipment.jpg', C+'living-panorama/1.jpg',  'Multimedia equipment',
  'Ten boxes or one system', 'What the system is made of and how professional gear differs from consumer kit'),
 ('og-corp-museum.jpg', C+'living-ship/1.jpg',  'Corporate museum',
  'Not a room guests are walked through', 'Partners, new hires and school groups in one exhibition'),
 ('og-web.jpg',  C+'city-flight/1.jpg',     'Interactive website',
  'You are looking at the example', 'A real-time scene instead of a page of blocks — and branded games'),
 ('og-space.jpg', C+'sales-showroom/1.jpg', 'Multimedia space',
  'A place that sells a way of living', 'Showroom, brand zone, presentation hall'),
]


if __name__ == '__main__':
    made, skipped = 0, []
    for sub_dir, cards in (('', CARDS), ('en', CARDS_EN)):
        for name, photo, kicker, title, sub in cards:
            p = os.path.join(SITE, photo)
            if not os.path.exists(p):
                skipped.append(photo); p = None
            card(p, kicker, title, sub, os.path.join(OUT, sub_dir, name))
            made += 1
    print('карточек собрано: %d -> site/assets/og/' % made)
    if skipped:
        print('кадр не найден, карточка без фона:')
        for s in skipped: print('   ', s)
