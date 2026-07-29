#!/usr/bin/env bash
# ==============================================================================
#  PlayDisplay — деплой сайта на боевой хостинг timeweb одной командой.
#
#  Запуск:   ./deploy.sh "текст коммита"
#            ./deploy.sh --dry-run          # ничего не менять, только показать
#            ./deploy.sh --yes "..."        # не спрашивать про удаления на сервере
#            ./deploy.sh --no-backup "..."  # без резервного пуша на GitHub
#
#  Что делает, по шагам:
#    1. снимает залипшие .git/*.lock (главная причина «коммит не проходит»);
#    2. проверяет, что рабочая копия на ветке hybrid-v8, и НЕ переключает ветку;
#    3. показывает незакоммиченные правки и коммитит их по именам файлов
#       (никогда `git add -A` — так в коммит попадает работа соседнего чата);
#    4. заливает site/ на timeweb через rsync — только изменившееся, минуя GitHub;
#    5. дописывает отчёт в DEPLOY-LOG.md;
#    6. по желанию пушит hybrid-v8 на GitHub как резерв (не блокирует деплой).
#
#  Правила общей папки — см. ПРАВИЛА-РАБОТЫ.md. Скрипт написан так, чтобы
#  их не нарушать: ветку не трогает, gh-pages не пересобирает, широких
#  удалений на диске не делает.
# ==============================================================================

set -uo pipefail

# ------------------------------------------------------------------ настройки --
SSH_USER="pdisplay"
SSH_HOST="vh432.timeweb.ru"
REMOTE_PATH="wordpress_2/public_html"     # относительно домашней папки на сервере
WORK_BRANCH="hybrid-v8"
SITE_URL="https://playdisplay.com"

# Локальный конфиг для переопределения любого из значений выше.
# Файл в .gitignore, в репозиторий не уезжает.
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$REPO/deploy.conf" ] && . "$REPO/deploy.conf"

TARGET="$SSH_USER@$SSH_HOST"
LOG="$REPO/DEPLOY-LOG.md"
STATE="$REPO/.git/pd-last-deploy"         # хеш последнего задеплоенного коммита

# --------------------------------------------------------------------- разбор --
DRY=0
BACKUP=1
YES=0
MSG=""
for arg in "$@"; do
  case "$arg" in
    --dry-run|-n) DRY=1 ;;
    --no-backup)  BACKUP=0 ;;
    --yes|-y)     YES=1 ;;
    -h|--help)    sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)            MSG="$arg" ;;
  esac
done

# ----------------------------------------------------------------- оформление --
bold=$(tput bold 2>/dev/null || true); dim=$(tput dim 2>/dev/null || true)
red=$(tput setaf 1 2>/dev/null || true); grn=$(tput setaf 2 2>/dev/null || true)
ylw=$(tput setaf 3 2>/dev/null || true); off=$(tput sgr0 2>/dev/null || true)

step() { printf "\n%s▸ %s%s\n" "$bold" "$1" "$off"; }
ok()   { printf "  %s✓%s %s\n" "$grn" "$off" "$1"; }
warn() { printf "  %s!%s %s\n" "$ylw" "$off" "$1"; }
die()  { printf "\n  %s✗ %s%s\n\n" "$red" "$1" "$off" >&2; exit 1; }

cd "$REPO" || die "не нахожу папку проекта"

printf "%s\n%s  PlayDisplay → %s%s\n%s\n" \
  "════════════════════════════════════════════" "$bold" "$SITE_URL" "$off" \
  "════════════════════════════════════════════"
[ "$DRY" = 1 ] && warn "холостой прогон: ничего не изменится ни в git, ни на сервере"

# ══ 1. Залипшие локи ═══════════════════════════════════════════════════════════
step "Проверяю замки git"
FREED=0
for L in .git/index.lock .git/HEAD.lock .git/objects/maintenance.lock \
         .git/refs/heads/"$WORK_BRANCH".lock; do
  if [ -e "$L" ]; then
    # Лок моложе двух минут может принадлежать живому процессу — не трогаем.
    if [ -n "$(find "$L" -mmin +2 2>/dev/null)" ]; then
      [ "$DRY" = 0 ] && rm -f "$L" && FREED=1
      warn "снят залипший $L"
    else
      die "$L создан только что — возможно, работает другой чат. Подожди минуту и повтори."
    fi
  fi
done
[ "$FREED" = 0 ] && ok "замков нет"

# ══ 2. Ветка ══════════════════════════════════════════════════════════════════
step "Проверяю ветку"
BRANCH=$(git rev-parse --abbrev-ref HEAD) || die "это не git-репозиторий"
[ "$BRANCH" = "$WORK_BRANCH" ] || die "рабочая копия на «$BRANCH», а работа идёт в «$WORK_BRANCH».
     Ветку я не переключаю (правило 1) — сделай это сам и проверь, что ничего не потерялось:
       git status && git switch $WORK_BRANCH"
ok "$BRANCH"

# ══ 3. Незакоммиченные правки ═════════════════════════════════════════════════
step "Смотрю, что не закоммичено"
# bash 3.2 на macOS не знает mapfile — читаем в массив вручную.
DIRTY=()
while IFS= read -r line; do
  [ -n "$line" ] && DIRTY+=("$line")
done < <(git status --porcelain)

if [ ${#DIRTY[@]} -eq 0 ]; then
  ok "рабочая копия чистая"
else
  printf "  найдено %s изменений:\n" "${#DIRTY[@]}"
  printf "    %s\n" "${DIRTY[@]}"

  # Файлы вне site/ и вне документации — чужая территория либо мусор.
  SUSPECT=()
  for line in "${DIRTY[@]}"; do
    f="${line:3}"; f="${f%\"}"; f="${f#\"}"
    case "$f" in
      site/*|*.md|deploy.sh|deploy.conf|build_seo.py|.gitignore) ;;
      *) SUSPECT+=("$f") ;;
    esac
  done
  if [ ${#SUSPECT[@]} -gt 0 ]; then
    printf "\n"
    warn "вне site/ и документации — коммитить не буду, разберись сначала:"
    printf "    %s\n" "${SUSPECT[@]}"
  fi

  if [ "$DRY" = 0 ]; then
    if [ -z "$MSG" ]; then
      if [ -t 0 ]; then
        printf "\n  %sТекст коммита%s (пусто = не коммитить, залить как есть): " "$bold" "$off"
        read -r MSG
      else
        warn "текст коммита не задан и спросить некого — коммит пропускаю"
      fi
    fi
    if [ -n "$MSG" ]; then
      # Добавляем по именам: только site/ и документацию, поштучно.
      ADDED=0
      for line in "${DIRTY[@]}"; do
        f="${line:3}"; f="${f%\"}"; f="${f#\"}"
        case "$f" in
          site/*|*.md|deploy.sh|build_seo.py|.gitignore)
            git add -- "$f" && ADDED=$((ADDED+1)) ;;
        esac
      done
      if [ "$ADDED" -gt 0 ]; then
        git commit -q -m "$MSG" || die "коммит не прошёл"
        ok "закоммичено файлов: $ADDED — $(git rev-parse --short HEAD)"
      else
        warn "нечего коммитить в своей территории"
      fi
    else
      warn "коммит пропущен — на сервер уедет текущее состояние диска"
    fi
  fi
fi

HEAD_SHA=$(git rev-parse --short HEAD)
LAST=$(cat "$STATE" 2>/dev/null || true)

# ══ 4. Заливка на хостинг ═════════════════════════════════════════════════════
step "Заливаю site/ на $SSH_HOST"
[ -d "$REPO/site" ] || die "нет папки site/ — заливать нечего"

# Что на сервере обязано выжить и никогда не удаляется:
#   old/        — статичный слепок старого вордпресса, 244 МБ, живёт только на сервере
#   .git/       — прежний git-клон; не нужен, но убирать его вручную и осознанно
#   .well-known — подтверждение SSL-сертификата
#   api/config.php, api/sessions/, api/outbox/ — ключи и рабочие данные ассистента
EXCLUDES=(
  # «-s» = правило только для отправляющей стороны: мусор macOS с Мака не уезжает,
  # но на сервере рука не связана. Обычный --exclude тут был ошибкой: он защищает
  # .DS_Store и на сервере тоже, а папка с ним внутри считается непустой и не
  # удаляется. Проверено: так на сервере навсегда остались бы огрызки _ARCHIVE.
  --filter='-s .DS_Store'
  --exclude='/old/'
  --exclude='/.git/'
  --exclude='/.well-known/'
  --exclude='/api/config.php'
  --exclude='/api/sessions/'
  --exclude='/api/outbox/'
)

# Одно SSH-соединение на весь скрипт — пароль спросят один раз.
CTL="/tmp/pd-ssh-$$"
SSH_OPTS=(-o ControlMaster=auto -o ControlPath="$CTL" -o ControlPersist=120)
cleanup() { ssh "${SSH_OPTS[@]}" -O exit "$TARGET" 2>/dev/null; rm -f "$CTL"; }
trap cleanup EXIT

ssh "${SSH_OPTS[@]}" -o ConnectTimeout=20 "$TARGET" true \
  || die "не подключиться к $TARGET — проверь SSH-доступ"
ok "соединение есть"

# -t  — сохранять время файлов, иначе rsync перезаливает всё при каждом запуске.
# -c  — сравнивать по контрольной сумме, а не по «размер + время с точностью до
#       секунды». Быстрая сверка молча пропускает правку, если файл не изменился
#       в размере и его правили в ту же секунду, что предыдущий деплой. Проверено:
#       так теряется правка. Лишние секунды на сверку дешевле потерянной правки.
RSYNC=(rsync -rltzc --omit-dir-times --chmod=D755,F644 --delete --itemize-changes
       "${EXCLUDES[@]}" -e "ssh ${SSH_OPTS[*]}" "$REPO/site/" "$TARGET:$REMOTE_PATH/")

# Сначала всегда холостой прогон: показать, что изменится и что удалится.
PLAN=$("${RSYNC[@]}" --dry-run 2>&1) || die "rsync не смог посмотреть сервер:
$PLAN"

# Разбор вывода --itemize-changes. Код изменения — ровно 11 символов, где первый
# символ это операция, а второй — тип объекта (f файл, d папка, L ссылка).
# Раньше здесь стоял грубый '^[<>ch]', и в список «отправлено» попадали
# предупреждения вида «cannot delete non-empty directory» — они тоже с «c».
ITEM='^[<>ch.][fdLDS]'
CHANGED=$(printf '%s\n' "$PLAN" | grep -cE "$ITEM" || true)
DELETED=$(printf '%s\n' "$PLAN" | grep -c '^\*deleting' || true)

# Всё, что не код изменения и не удаление — это жалобы rsync. Их надо видеть.
GRIPES=$(printf '%s\n' "$PLAN" | grep -vE "$ITEM" | grep -v '^\*deleting' \
         | grep -vE '^(sending|sent|total|$)' || true)
if [ -n "$GRIPES" ]; then
  printf "\n"
  warn "rsync жалуется:"
  printf '%s\n' "$GRIPES" | head -10 | sed 's/^/    /'
fi
printf "  к отправке: %s%s%s, к удалению на сервере: %s%s%s\n" \
  "$bold" "$CHANGED" "$off" "$bold" "$DELETED" "$off"

if [ "$DELETED" -gt 0 ]; then
  printf "\n"
  warn "будут удалены с сервера (их нет в site/):"
  printf '%s\n' "$PLAN" | grep '^\*deleting' | sed 's/^\*deleting  */    /' | head -30
  [ "$DELETED" -gt 30 ] && printf "    …и ещё %s\n" "$((DELETED-30))"
fi

if [ "$CHANGED" = 0 ] && [ "$DELETED" = 0 ]; then
  ok "сервер уже совпадает с site/ — заливать нечего"
  SENT_LIST=""
elif [ "$DRY" = 1 ]; then
  warn "холостой прогон — ничего не отправлено"
  SENT_LIST=$(printf '%s\n' "$PLAN" | grep -E "$ITEM" | cut -c13-)
else
  if [ "$DELETED" -gt 0 ] && [ "$YES" = 0 ]; then
    if [ -t 0 ]; then
      printf "\n  %sУдалить перечисленное и залить?%s [y/N] " "$bold" "$off"
      read -r a; [[ "$a" =~ ^[Yy]$ ]] || die "отменено, на сервере ничего не тронуто"
    else
      die "на сервере есть что удалять, а подтвердить некому.
     Посмотри список глазами: ./deploy.sh --dry-run
     Согласен — добавь --yes"
    fi
  fi
  OUT=$("${RSYNC[@]}" 2>&1) || die "rsync упал:
$OUT"
  SENT_LIST=$(printf '%s\n' "$OUT" | grep -E "$ITEM" | cut -c13-)
  LEFT=$(printf '%s\n' "$OUT" | grep -c 'cannot delete' || true)
  [ "$LEFT" -gt 0 ] && warn "папок не удалось убрать: $LEFT — внутри осталось что-то,
    чего rsync не трогает. Посмотри список выше."
  ok "залито, сайт обновлён: $SITE_URL"
fi

# ══ 5. Журнал ═════════════════════════════════════════════════════════════════
step "Пишу в DEPLOY-LOG.md"
if [ "$DRY" = 1 ]; then
  warn "холостой прогон — журнал не тронут"
else
  if [ -n "$LAST" ]; then
    COMMITS=$(git log --oneline "$LAST..HEAD" 2>/dev/null)
  else
    COMMITS=$(git log --oneline -5)
  fi
  [ -z "$COMMITS" ] && COMMITS="(новых коммитов нет — залито текущее состояние)"

  # Список файлов в журнале подрезаем: одна поставка бывает и на 364 файла,
  # а при чистке сервера — на тысячу. Полный перечень такой длины журнал топит.
  SENT_SHOWN=""
  if [ -n "$SENT_LIST" ]; then
    N_SENT=$(printf '%s\n' "$SENT_LIST" | wc -l | tr -d ' ')
    SENT_SHOWN=$(printf '%s\n' "$SENT_LIST" | head -40)
    [ "$N_SENT" -gt 40 ] && SENT_SHOWN="$SENT_SHOWN
…и ещё $((N_SENT-40))"
  fi

  ENTRY="## $(date '+%Y-%m-%d %H:%M') — $WORK_BRANCH @ $HEAD_SHA

**Коммиты в этой поставке**
\`\`\`
$COMMITS
\`\`\`

**На сервер отправлено файлов:** $CHANGED, удалено: $DELETED
$( [ -n "$SENT_SHOWN" ] && printf '```\n%s\n```' "$SENT_SHOWN" )
"
  # Новая запись встаёт сразу под маркером, то есть выше всех предыдущих.
  MARK="<!-- НОВЫЕ ЗАПИСИ ДОБАВЛЯЮТСЯ ПОД ЭТОЙ СТРОКОЙ. НЕ УДАЛЯТЬ. -->"
  if [ -f "$LOG" ] && grep -qF "$MARK" "$LOG"; then
    N=$(grep -nF "$MARK" "$LOG" | head -1 | cut -d: -f1)
    { head -n "$N" "$LOG"; printf '\n%s\n' "$ENTRY"; tail -n +"$((N+1))" "$LOG"; } \
      > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
  else
    # Журнала нет или маркер потеряли — создаём заново.
    printf '# Журнал деплоя\n\nЗаписи пишет `deploy.sh`, новые сверху.\n\n%s\n\n%s\n' \
      "$MARK" "$ENTRY" > "$LOG"
  fi
  echo "$HEAD_SHA" > "$STATE"
  git add -- DEPLOY-LOG.md && git commit -q -m "Журнал деплоя: $HEAD_SHA" 2>/dev/null \
    && ok "запись добавлена и закоммичена" || ok "запись добавлена"
fi

# ══ 6. Резерв на GitHub ═══════════════════════════════════════════════════════
if [ "$BACKUP" = 1 ] && [ "$DRY" = 0 ]; then
  step "Резервный пуш на GitHub"
  if git push -q origin "$WORK_BRANCH" 2>/dev/null; then
    ok "$WORK_BRANCH запушена в резерв"
  else
    warn "пуш не прошёл (нет кредов или сети) — на сайт это не влияет, история осталась локально"
  fi
fi

printf "\n%s%s Готово.%s %s\n\n" "$bold" "$grn" "$off" "$SITE_URL"
