#!/usr/bin/env python3
"""Локальный просмотр сайта с поддержкой перемотки видео.

    python3 serve.py            # http://localhost:8000  (и с телефона по адресу Мака)

Зачем отдельный сервер. Штатный `python3 -m http.server` не умеет частичные запросы
(HTTP Range): на любую просьбу браузера «дай кусок с такой-то секунды» он отдаёт файл
целиком со статусом 200. Пока ролик маленький, это незаметно, но перемотка тяжёлого
файла — а у нас теперь 1080p по 40-70 МБ — либо ждёт полной загрузки, либо не работает
вовсе. Здесь добавлен ответ 206 Partial Content, и видео листается как на боевом сервере.

PHP этот сервер не исполняет: панель AI-ассистента на нём уйдёт в демо-режим, это нормально.
"""
import http.server, os, re, socketserver, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'site')
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class Handler(http.server.SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'      # видео просит куски пачками: соединение держим открытым

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    # Разметку и данные всегда отдаём свежими, тяжёлое сырьё разрешаем кэшировать.
    # Раньше no-store стоял на всём подряд. На Маке это незаметно, а с телефона каждый
    # заход заново тянул облако точек, обложки и ролики — лоадер полз минутами, и
    # верхняя галерея «оживала» только к концу загрузки. Правим мы html/js/json, они и
    # остаются без кэша; картинки и видео за сессию не меняются.
    CACHEABLE = ('.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg', '.ico',
                 '.mp4', '.webm', '.mov', '.woff', '.woff2', '.ttf', '.otf')

    def end_headers(self):
        path = self.path.split('?', 1)[0].split('#', 1)[0].lower()
        if path.endswith(self.CACHEABLE):
            self.send_header('Cache-Control', 'public, max-age=3600')
        else:
            self.send_header('Cache-Control', 'no-store')
        self.send_header('Accept-Ranges', 'bytes')
        super().end_headers()

    # Закрытые PHP-страницы: локально показываем их содержимое без пароля.
    # Книга концепции лежит в ball/private/page.html и на боевом отдаётся через
    # ball/index.php — по адресу /ball/. Открывать её напрямую из private/ нельзя:
    # относительные пути к css и картинкам уезжают на уровень глубже, и страница
    # приходит без стилей. Здесь /ball/ отдаёт саму книгу, поэтому вёрстка выглядит
    # ровно так, как на сервере. Пароль на боевом это не отменяет.
    PHP_PREVIEW = {'/ball/': 'ball/private/page.html',
                   '/ball/index.php': 'ball/private/page.html',
                   '/avtovaz/': 'avtovaz/private/page.html',
                   '/avtovaz/index.php': 'avtovaz/private/page.html'}

    def send_head(self):
        clean = self.path.split('?', 1)[0]
        # прямой заход в private/ — это всегда страница без стилей: пути к css и картинкам
        # считаются от текущей папки и уезжают на уровень глубже. Отправляем на /<раздел>/.
        # Список берём из самой таблицы, чтобы новая закрытая страница подхватывалась
        # одной строкой в PHP_PREVIEW, а не двумя правками в разных местах.
        for pref in self.PHP_PREVIEW:
            if pref.endswith('/') and clean.startswith(pref + 'private/'):
                self.send_response(302)
                self.send_header('Location', pref)
                self.send_header('Content-Length', '0')
                self.end_headers()
                return None
        alt = self.PHP_PREVIEW.get(clean)
        if alt and os.path.isfile(os.path.join(ROOT, alt)):
            self.path = '/' + alt + (('?' + self.path.split('?', 1)[1]) if '?' in self.path else '')
        rng = self.headers.get('Range')
        if not rng:
            return super().send_head()
        m = re.match(r'bytes=(\d*)-(\d*)$', rng.strip())
        path = self.translate_path(self.path)
        if not m or not os.path.isfile(path):
            return super().send_head()
        size = os.path.getsize(path)
        start = int(m.group(1)) if m.group(1) else None
        end = int(m.group(2)) if m.group(2) else None
        if start is None:                      # bytes=-N — последние N байт
            start, end = max(0, size - (end or 0)), size - 1
        else:
            end = size - 1 if end is None else min(end, size - 1)
        if start > end:
            self.send_response(416)
            self.send_header('Content-Range', 'bytes */%d' % size)
            self.end_headers()
            return None
        f = open(path, 'rb')
        f.seek(start)
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', 'bytes %d-%d/%d' % (start, end, size))
        self.send_header('Content-Length', str(end - start + 1))
        self.end_headers()
        # copyfile отдаёт файл до конца — обрезаем ровно запрошенным куском
        return _Slice(f, end - start + 1)


class _Slice:
    def __init__(self, f, left):
        self.f, self.left = f, left

    def read(self, n=-1):
        if self.left <= 0:
            return b''
        if n < 0 or n > self.left:
            n = self.left
        b = self.f.read(n)
        self.left -= len(b)
        return b

    def close(self):
        self.f.close()


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True          # перемотка открывает несколько соединений сразу

    def handle_error(self, request, client_address):
        """Обрыв соединения клиентом — это норма, а не сбой сервера.

        Браузер открывает запрос за куском видео и закрывает его, как только решил, что
        кусок не нужен: перемотал, ушёл со страницы, снял <video> с паузы. Ядро отвечает
        BrokenPipe/ConnectionReset, а базовый socketserver печатает на каждый такой случай
        полный traceback. На странице с десятком роликов терминал заливает так, что
        настоящую ошибку в нём уже не найти. Молчим про эти два случая, остальные печатаем.
        """
        exc = sys.exc_info()[1]
        if isinstance(exc, (BrokenPipeError, ConnectionResetError)):
            return
        super().handle_error(request, client_address)


def lan_ip():
    """Адрес Мака в локальной сети — чтобы не искать его руками ради просмотра с телефона.
    Соединения не происходит: UDP-сокет только выбирает исходящий интерфейс."""
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


if __name__ == '__main__':
    print('site/ → http://localhost:%d/   (Ctrl+C — стоп)' % PORT)
    ip = lan_ip()
    if ip:
        print('с телефона (тот же Wi-Fi) → http://%s:%d/' % (ip, PORT))
        print('   подачи проектов: ?mob=strip (основная) · ?mob=grid · ?mob=lenta · ?mob=more · ?mob=off')
    Server(('0.0.0.0', PORT), Handler).serve_forever()
