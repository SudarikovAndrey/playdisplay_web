#!/usr/bin/env bash
# Локальный запуск сайта С РАБОТАЮЩИМ ассистентом + проверка, что он правда работает.
#
#   ./ai-local.sh          поднять сервер на 8000 и проверить
#   ./ai-local.sh 8080     то же на другом порту
#
# Зачем отдельный скрипт: сайт статичный, и его легко открыть чем угодно —
# Live Server, python -m http.server, двойной клик по файлу. Всё это отдаёт html,
# но НЕ выполняет php, поэтому ассистент молча уходит в демо-режим и показывает
# заранее заготовленный бриф. Снаружи это выглядит как «работает, но данные не те».
# Скрипт снимает эту неопределённость: он либо поднимает именно php, либо честно
# говорит, почему не может.

set -u
cd "$(dirname "$0")"
PORT="${1:-8000}"
BASE="http://127.0.0.1:$PORT"

say()  { printf '%s\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
bad()  { printf '  \033[31m✕\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }

say ""
say "── Проверка окружения ──"

if ! command -v php >/dev/null 2>&1; then
  bad "php не установлен — без него бэкенд ассистента работать не может."
  say ""
  say "    Поставить:  brew install php"
  say "    Если brew нет:  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
  say ""
  exit 1
fi
ok "php $(php -r 'echo PHP_VERSION;')"

php -r 'exit(function_exists("json_encode") ? 0 : 1);' && ok "расширение json" || { bad "нет расширения json"; exit 1; }
php -r 'exit(function_exists("curl_init") || ini_get("allow_url_fopen") ? 0 : 1);' \
  && ok "исходящие запросы к модели возможны" || warn "ни curl, ни allow_url_fopen — модель будет недоступна"

# Сертификат для GigaChat: его хост подписан НУЦ Минцифры, которого нет в стандартном
# хранилище ни на маке, ни на большинстве серверов. Без него драйвер не получит даже токен.
CERT_DIR="site/api/certs"
CERT="$CERT_DIR/russian_trusted_root_ca_pem.crt"
if grep -q "'llm' => 'gigachat'" site/api/config.php 2>/dev/null; then
  if [ -s "$CERT" ]; then
    ok "сертификат НУЦ Минцифры на месте"
  else
    warn "нет сертификата НУЦ Минцифры — GigaChat без него не отвечает. Скачиваю…"
    mkdir -p "$CERT_DIR"
    if curl -fsSk "https://gu-st.ru/content/lending/russian_trusted_root_ca_pem.crt" -o "$CERT" && [ -s "$CERT" ]; then
      ok "скачан: $CERT"
    else
      rm -f "$CERT"
      bad "не удалось скачать. Возьмите вручную с https://www.gosuslugi.ru/crt и положите в $CERT"
    fi
  fi
fi

# Порт уже занят? Скорее всего именно этим и был занят: статичным сервером.
if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  bad "порт $PORT уже занят другим процессом:"
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN | tail -n +1 | sed 's/^/      /'
  say ""
  say "    Скорее всего это он и отдавал сайт без php. Остановите его (Ctrl+C в том окне)"
  say "    или запустите нас на другом порту:  ./ai-local.sh 8080"
  say ""
  exit 1
fi

say ""
say "── Запуск php-сервера на $BASE ──"
php -S "127.0.0.1:$PORT" -t site >/tmp/pd-ai-server.log 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
sleep 1.2

if ! kill -0 $SRV 2>/dev/null; then
  bad "сервер не поднялся, лог:"
  sed 's/^/      /' /tmp/pd-ai-server.log
  exit 1
fi
ok "сервер запущен (pid $SRV)"

say ""
say "── Проверка бэкенда ассистента ──"

PING=$(curl -s -m 15 -X POST "$BASE/api/ai.php" -H 'Content-Type: application/json' -d '{"action":"ping"}' 2>/dev/null)

case "$PING" in
  *'"ok":true'*'"demo":false'*)
    ok "бэкенд отвечает, модель подключена — разговор будет настоящим"
    ;;
  *'"ok":true'*'"demo":true'*)
    WHY=$(printf '%s' "$PING" | sed -n 's/.*"why":"\([^"]*\)".*/\1/p')
    warn "бэкенд отвечает, но модель НЕ подключена: ${WHY:-причина не указана}"
    say ""
    say "    Бриф будет заглушкой, пока не вписан ключ."
    say "    Вписать:  site/api/config.php  → строка 'key'"
    ;;
  *'<?php'*)
    bad "php не выполняется: сервер отдал исходник ai.php"
    ;;
  '')
    bad "бэкенд не ответил. Лог сервера:"
    sed 's/^/      /' /tmp/pd-ai-server.log
    ;;
  *)
    bad "неожиданный ответ бэкенда:"
    printf '      %s\n' "$(printf '%s' "$PING" | head -c 300)"
    ;;
esac

# Полная проверка настроек: модель, права на запись, вёрстка письма.
say ""
say "── Полная проверка настроек ──"
ST=$(curl -s -m 90 "$BASE/api/selftest.php" 2>/dev/null)
GOOD=$(printf '%s' "$ST" | grep -o '>✓<' | wc -l | tr -d ' ')
FAIL=$(printf '%s' "$ST" | grep -o '>✕<' | wc -l | tr -d ' ')
if [ "${GOOD:-0}" = "0" ] && [ "${FAIL:-0}" = "0" ]; then
  warn "страница проверки не открылась (на боевом сервере она закрыта — это нормально)"
else
  [ "${FAIL:-0}" = "0" ] && ok "сошлось всё: $GOOD пунктов" || bad "не сошлось: $FAIL из $((GOOD + FAIL))"
  say "    Подробно: $BASE/api/selftest.php"
fi

say ""
say "───────────────────────────────────────────────"
say "  Сайт:      $BASE/"
say "  Проверка:  $BASE/api/selftest.php"
say "  Письма:    site/api/outbox/  (открываются в браузере)"
say "  Ошибки:    site/api/sessions/error.log"
say ""
say "  Остановить — Ctrl+C"
say "───────────────────────────────────────────────"
say ""
wait $SRV
