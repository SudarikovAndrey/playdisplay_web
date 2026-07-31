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

    def end_headers(self):
        # локальный просмотр всегда должен показывать то, что на диске
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Accept-Ranges', 'bytes')
        super().end_headers()

    def send_head(self):
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


if __name__ == '__main__':
    print('site/ → http://localhost:%d/   (Ctrl+C — стоп)' % PORT)
    Server(('0.0.0.0', PORT), Handler).serve_forever()
