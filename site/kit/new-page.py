#!/usr/bin/env python3
"""Скелет новой презентационной страницы на конструкторе.

    python3 site/kit/new-page.py museum-light "Музей света"
    python3 site/kit/new-page.py partner-deck "Питч для партнёра" --private "пароль"

Что делает: создаёт папку `site/<имя>/`, кладёт страницу с уже подключённым китом,
первым экраном, главой и подвалом. Дальше страницу набивают блоками из каталога.

Почему генератор, а не «скопируйте книгу»: копия книги тянет за собой её содержание,
её пути к картинкам и её частные правки. Через месяц никто не помнит, что из этого нужно
странице, а что осталось от мяча. Скелет же содержит только каркас.

Ключ --private собирает закрытую по паролю страницу тем же способом, что книга концепции:
вёрстка лежит в `private/`, куда веб-сервер не пускает, и отдаётся `index.php` после
проверки пароля. В файлах остаётся только соль и отпечаток PBKDF2 — пароля нет.
Проверка на сервере, а не в браузере: при клиентской проверке всю вёрстку видно через
«просмотр кода» без всякого пароля.
"""
import argparse, hashlib, os, secrets, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))          # …/site
KIT = os.path.join(ROOT, 'kit')

PAGE = '''<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#06070a">
  <meta name="robots" content="noindex, nofollow">
  <title>{title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <!-- Onest обязателен: именно он объявлен основным в typography.css. Раньше здесь
       стоял Manrope, которого в стилях нет вовсе, — страница молча уезжала на Helvetica -->
  <link href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600;700&family=Roboto+Mono:wght@400;500&family=Unbounded:wght@400;600;700;800&display=swap" rel="stylesheet">
  <!-- Порядок обязателен: layout задаёт токены и сетку, на которые опирается остальное -->
  <link rel="stylesheet" href="{up}kit/css/layout.css">
  <link rel="stylesheet" href="{up}kit/css/typography.css">
  <link rel="stylesheet" href="{up}kit/css/components.css">
  <link rel="stylesheet" href="{up}kit/css/animations.css">
</head>
<body>
  <!-- Заставка: страница открывается, когда пришли шрифты и кадры первых двух экранов -->
  <div class="boot" id="boot">
    <div class="boot-inner">
      <img class="boot-logo" src="{up}kit/assets/demo/logo.webp" alt="">
      <div class="boot-bar"><i id="bootBar"></i></div>
      <p class="boot-note">{title}</p>
    </div>
  </div>

  <div class="cursor-glow" aria-hidden="true"></div>
  <div class="cursor-core" aria-hidden="true"></div>
  <div class="brand-particles" id="brandParticles" aria-hidden="true"></div>
  <div class="reading-progress" id="readingProgress" aria-hidden="true"></div>

  <header class="masthead">
    <a class="playdisplay-logo playdisplay-logo--top" href="#top" data-brand-logo aria-label="В начало"><img src="{up}kit/assets/demo/logo.webp" alt="Playdisplay"></a>
    <div class="book-mark"><span>{title}</span><span>Версия 0.1</span></div>
  </header>

  <nav class="chapter-nav" aria-label="Навигация по разделам">
    <a href="#s01" data-section="s01"><span>01</span><small>Первый раздел</small></a>
    <p class="nav-legal">© Playdisplay</p>
  </nav>

  <main id="top">
    <section class="hero">
      <div class="hero-intro">
        <div class="hero-copy reveal">
          <p class="overline hero-overline" data-parallax="0.03">Надстрочник · версия 0.1</p>
          <h1><span class="l1" data-parallax="0.075">ПЕРВАЯ</span><span class="l2" data-parallax="0.05">СТРОКА</span></h1>
          <p class="hero-statement hero-statement--float" data-parallax="0.04">Короткий слоган в одну строку.</p>
        </div>
        <p class="hero-status" data-parallax="0.02">Статус документа: черновик. Заменить или убрать.</p>
        <a class="scroll-cue" href="#s01"><span>Начать</span><i></i></a>
      </div>
    </section>

    <section class="opening-statement">
      <p class="reveal" data-parallax="0.012">Главная мысль.</p>
      <p class="reveal" data-parallax="0.026">Вторая строка.</p>
    </section>

    <section id="s01" class="chapter" data-chapter="01">
      <div class="chapter-shell">
        <header class="chapter-header reveal">
          <span class="chapter-number">01</span>
          <span class="chapter-rule"></span>
          <span class="chapter-meta">Версия 0.1</span>
        </header>
        <article class="chapter-copy">
          <h2>ПЕРВЫЙ РАЗДЕЛ</h2>
          <h3>Подзаголовок</h3>
          <p>Текст раздела. Блоки берите из каталога: <code>kit/catalog.html</code>.</p>
          <ul class="clean-list">
            <li>1. Первый шаг.</li>
            <li>2. Второй шаг.</li>
            <li>3. Третий шаг.</li>
          </ul>
        </article>
      </div>
    </section>
  </main>

  <footer class="final-credits" id="contacts">
    <div class="final-credits__main">
      <div class="final-credits__director">
        <img src="{up}kit/assets/demo/portrait.webp" alt="">
        <p><span>Роль</span><strong>Имя Фамилия</strong></p>
      </div>
    </div>
    <span class="final-credits__index">{title} / 0.1</span>
  </footer>

  <button class="to-top" id="toTop" type="button" aria-label="Вернуться в начало"><i></i><span>В начало</span></button>

  <script defer src="{up}kit/js/boot.js"></script>
  <script defer src="{up}kit/js/reveal-cursor.js"></script>
  <script defer src="{up}kit/js/nav.js"></script>
  <script defer src="{up}kit/js/parallax.js"></script>
  <script defer src="{up}kit/js/lists.js"></script>
  <script defer src="{up}kit/js/hotspots.js"></script>
  <script defer src="{up}kit/js/ui.js"></script>
</body>
</html>
'''

GATE_NOTE = '''# {title} — закрытая страница

Вёрстка лежит в `private/page.html`, куда веб-сервер не пускает (`private/.htaccess`),
и отдаётся `index.php` после проверки пароля. В файлах только соль и отпечаток PBKDF2 —
пароля нет нигде.

Локально смотреть по адресу `/{slug}/`, а не файлом из `private/`: пути к `kit/`
относительные и от `private/` уезжают на уровень глубже. `serve.py` знает про это —
допишите путь в его таблицу PHP_PREVIEW, если нужен локальный просмотр.

Диагностика на сервере: `/{slug}/?diag`.
'''


def pbkdf2(pwd: str, salt: str, it: int = 200000) -> str:
    return hashlib.pbkdf2_hmac('sha256', pwd.encode(), salt.encode(), it, 32).hex()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('slug', help='имя папки: латиницей, через дефис')
    ap.add_argument('title', help='заголовок страницы')
    ap.add_argument('--private', metavar='ПАРОЛЬ', help='закрыть страницу паролем')
    a = ap.parse_args()

    dst = os.path.join(ROOT, a.slug)
    if os.path.exists(dst):
        sys.exit(f'папка {dst} уже есть — выберите другое имя')
    os.makedirs(dst)

    if a.private:
        os.makedirs(os.path.join(dst, 'private'))
        # страница уходит на уровень глубже, поэтому путь до кита длиннее
        page = PAGE.format(title=a.title, up='../../')
        open(os.path.join(dst, 'private', 'page.html'), 'w', encoding='utf-8').write(page)

        salt = secrets.token_hex(16)
        digest = pbkdf2(a.private, salt)
        src = open(os.path.join(ROOT, 'ball', 'index.php'), encoding='utf-8').read()
        # подменяем соль, отпечаток и имя печенья — остальное берём как есть,
        # включая намеренно старомодный синтаксис: версию PHP на хостинге меняют молча
        import re
        src = re.sub(r"\$SALT = '[^']*'", f"$SALT = '{salt}'", src, count=1)
        src = re.sub(r"\$HASH = '[^']*'", f"$HASH = '{digest}'", src, count=1)
        src = re.sub(r"\$COOKIE = '[^']*'", f"$COOKIE = 'pd_{a.slug.replace('-', '_')}'", src, count=1)
        src = src.replace('/ball/', f'/{a.slug}/')
        src = src.replace('Музей Мяча', a.title)
        open(os.path.join(dst, 'index.php'), 'w', encoding='utf-8').write(src)

        for name, sub in (('.htaccess', ''), ('.htaccess', 'private')):
            shutil.copy(os.path.join(ROOT, 'ball', sub, name) if sub else os.path.join(ROOT, 'ball', name),
                        os.path.join(dst, sub, name) if sub else os.path.join(dst, name))
        open(os.path.join(dst, 'README.md'), 'w', encoding='utf-8').write(
            GATE_NOTE.format(title=a.title, slug=a.slug))
        print(f'готово: site/{a.slug}/ — закрытая страница')
        print(f'  адрес: /{a.slug}/   пароль: {a.private}')
        print('  пароль в файлах не хранится: только соль и отпечаток PBKDF2 (200 000 итераций)')
    else:
        open(os.path.join(dst, 'index.html'), 'w', encoding='utf-8').write(
            PAGE.format(title=a.title, up='../'))
        print(f'готово: site/{a.slug}/index.html')

    print('  блоки и подводные камни: site/kit/blocks.json и site/kit/catalog.html')


if __name__ == '__main__':
    main()
