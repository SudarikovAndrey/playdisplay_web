#!/usr/bin/env bash
# ==============================================================================
#  SPICE RUN — деплой игры на play.playdisplay.com одной командой.
#
#  Запуск:   ./deploy-play.sh "текст коммита"
#            ./deploy-play.sh --dry-run     # ничего не менять, только показать
#            ./deploy-play.sh --yes "..."   # не спрашивать про удаления на сервере
#
#  Брат deploy.sh, но для игровой ветки: работает в game-v1, заливает play/
#  в папку поддомена. Логика та же: снять локи → проверить ветку → закоммитить
#  по именам → rsync → журнал. GitHub — только резерв в конце.
#
#  ПОДГОТОВКА ПОДДОМЕНА (один раз, в панели timeweb):
#    1. Домены → добавить поддомен play.playdisplay.com;
#    2. корневую папку поддомена указать: wordpress_2/play_html
#       (или поменяй REMOTE_PATH ниже под то, что создала панель);
#    3. включить SSL-сертификат на поддомен.
# ==============================================================================

set -uo pipefail

# ------------------------------------------------------------------ настройки --
SSH_USER="pdisplay"
SSH_HOST="vh432.timeweb.ru"
REMOTE_PATH="wordpress_2/play_html"       # корень поддомена на сервере
WORK_BRANCH="game-v1"
SITE_URL="https://play.playdisplay.com"

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
[ -f "$REPO/deploy.conf" ] && . "$REPO/deploy.conf"
# deploy.conf общий с сайтом: его REMOTE_PATH указывает на public_html —
# для игры он не годится, возвращаем свой (переопредели PLAY_REMOTE_PATH в conf).
REMOTE_PATH="${PLAY_REMOTE_PATH:-wordpress_2/play_html}"

TARGET="$SSH_USER@$SSH_HOST"
LOG="$REPO/DEPLOY-LOG.md"

# --------------------------------------------------------------------- разбор --
DRY=0; YES=0; MSG=""
for arg in "$@"; do
  case "$arg" in
    --dry-run|-n) DRY=1 ;;
    --yes|-y)     YES=1 ;;
    -h|--help)    sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)            MSG="$arg" ;;
  esac
done

bold=$(tput bold 2>/dev/null || true)
red=$(tput setaf 1 2>/dev/null || true); grn=$(tput setaf 2 2>/dev/null || true)
ylw=$(tput setaf 3 2>/dev/null || true); off=$(tput sgr0 2>/dev/null || true)
step() { printf "\n%s▸ %s%s\n" "$bold" "$1" "$off"; }
ok()   { printf "  %s✓%s %s\n" "$grn" "$off" "$1"; }
warn() { printf "  %s!%s %s\n" "$ylw" "$off" "$1"; }
die()  { printf "\n  %s✗ %s%s\n\n" "$red" "$1" "$off" >&2; exit 1; }

cd "$REPO" || die "не нахожу папку проекта"

printf "%s\n%s  SPICE RUN → %s%s\n%s\n" \
  "════════════════════════════════════════════" "$bold" "$SITE_URL" "$off" \
  "════════════════════════════════════════════"
[ "$DRY" = 1 ] && warn "холостой прогон: ничего не изменится ни в git, ни на сервере"

# ══ 1. Залипшие локи ═══════════════════════════════════════════════════════════
step "Проверяю замки git"
FREED=0
for L in .git/index.lock .git/HEAD.lock .git/objects/maintenance.lock \
         .git/refs/heads/"$WORK_BRANCH".lock; do
  if [ -e "$L" ]; then
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
[ "$BRANCH" = "$WORK_BRANCH" ] || die "рабочая копия на «$BRANCH», а игра живёт в «$WORK_BRANCH».
     Ветку я не переключаю — сделай это сам, если сейчас безопасно:
       git status && git switch $WORK_BRANCH"
ok "$BRANCH"

# ══ 3. Незакоммиченные правки ═════════════════════════════════════════════════
step "Смотрю, что не закоммичено"
DIRTY=()
while IFS= read -r line; do
  [ -n "$line" ] && DIRTY+=("$line")
done < <(git status --porcelain)

if [ ${#DIRTY[@]} -eq 0 ]; then
  ok "рабочая копия чистая"
else
  printf "  найдено %s изменений:\n" "${#DIRTY[@]}"
  printf "    %s\n" "${DIRTY[@]}"
  if [ "$DRY" = 0 ]; then
    if [ -z "$MSG" ] && [ -t 0 ]; then
      printf "\n  %sТекст коммита%s (пусто = не коммитить, залить как есть): " "$bold" "$off"
      read -r MSG
    fi
    if [ -n "$MSG" ]; then
      # территория игры: play/ и документация; чужое не трогаем
      ADDED=0
      for line in "${DIRTY[@]}"; do
        f="${line:3}"; f="${f%\"}"; f="${f#\"}"
        case "$f" in
          play/*|*.md|deploy-play.sh)
            git add -- "$f" && ADDED=$((ADDED+1)) ;;
        esac
      done
      if [ "$ADDED" -gt 0 ]; then
        git commit -q -m "$MSG" || die "коммит не прошёл"
        ok "закоммичено файлов: $ADDED — $(git rev-parse --short HEAD)"
      else
        warn "нечего коммитить в территории игры (play/, *.md)"
      fi
    else
      warn "коммит пропущен — на сервер уедет текущее состояние диска"
    fi
  fi
fi
HEAD_SHA=$(git rev-parse --short HEAD)

# ══ 4. Заливка на хостинг ═════════════════════════════════════════════════════
step "Заливаю play/ на $SSH_HOST"
[ -d "$REPO/play" ] || die "нет папки play/ — заливать нечего"

EXCLUDES=(
  --filter='-s .DS_Store'
  --exclude='/.well-known/'
)

CTL="/tmp/pd-play-ssh-$$"
SSH_OPTS=(-o ControlMaster=auto -o ControlPath="$CTL" -o ControlPersist=120)
cleanup() { ssh "${SSH_OPTS[@]}" -O exit "$TARGET" 2>/dev/null; rm -f "$CTL"; }
trap cleanup EXIT

ssh "${SSH_OPTS[@]}" -o ConnectTimeout=20 "$TARGET" true \
  || die "не подключиться к $TARGET — проверь SSH-доступ"
ok "соединение есть"
# папка поддомена может ещё не существовать — создадим
ssh "${SSH_OPTS[@]}" "$TARGET" "mkdir -p '$REMOTE_PATH'" || die "не создать $REMOTE_PATH"

RSYNC=(rsync -rltzc --omit-dir-times --chmod=D755,F644 --delete --itemize-changes
       "${EXCLUDES[@]}" -e "ssh ${SSH_OPTS[*]}" "$REPO/play/" "$TARGET:$REMOTE_PATH/")

PLAN=$("${RSYNC[@]}" --dry-run 2>&1) || die "rsync не смог посмотреть сервер:
$PLAN"
ITEM='^[<>ch.][fdLDS]'
CHANGED=$(printf '%s\n' "$PLAN" | grep -cE "$ITEM" || true)
DELETED=$(printf '%s\n' "$PLAN" | grep -c '^\*deleting' || true)
printf "  к отправке: %s%s%s, к удалению на сервере: %s%s%s\n" \
  "$bold" "$CHANGED" "$off" "$bold" "$DELETED" "$off"

if [ "$DELETED" -gt 0 ]; then
  warn "будут удалены с сервера (их нет в play/):"
  printf '%s\n' "$PLAN" | grep '^\*deleting' | sed 's/^\*deleting  */    /' | head -30
fi

if [ "$CHANGED" = 0 ] && [ "$DELETED" = 0 ]; then
  ok "сервер уже совпадает с play/ — заливать нечего"
elif [ "$DRY" = 1 ]; then
  warn "холостой прогон — ничего не отправлено"
else
  if [ "$DELETED" -gt 0 ] && [ "$YES" = 0 ]; then
    if [ -t 0 ]; then
      printf "\n  %sУдалить перечисленное и залить?%s [y/N] " "$bold" "$off"
      read -r a; [[ "$a" =~ ^[Yy]$ ]] || die "отменено, на сервере ничего не тронуто"
    else
      die "на сервере есть что удалять, а подтвердить некому. Добавь --yes"
    fi
  fi
  OUT=$("${RSYNC[@]}" 2>&1) || die "rsync упал:
$OUT"
  ok "залито, игра обновлена: $SITE_URL"
fi

# ══ 5. Журнал ═════════════════════════════════════════════════════════════════
if [ "$DRY" = 0 ]; then
  step "Пишу в DEPLOY-LOG.md"
  {
    printf '\n## %s — PLAY %s (%s)\n' "$(date '+%Y-%m-%d %H:%M')" "$HEAD_SHA" "${MSG:-без коммита}"
    printf 'Отправлено: %s, удалено: %s → %s\n' "$CHANGED" "$DELETED" "$SITE_URL"
  } >> "$LOG"
  ok "журнал дополнен"
fi

# ══ 6. Резерв на GitHub ═══════════════════════════════════════════════════════
if [ "$DRY" = 0 ]; then
  step "Резервный пуш game-v1 на GitHub (не блокирует деплой)"
  if git push origin "$WORK_BRANCH" 2>&1 | tail -1; then
    ok "ветка запушена"
  else
    warn "пуш не прошёл — на игру это не влияет, повтори позже"
  fi
fi

printf "\n%sГотово.%s Проверь: %s\n\n" "$grn" "$off" "$SITE_URL"
