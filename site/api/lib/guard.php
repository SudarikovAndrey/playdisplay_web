<?php
/**
 * Страж: пропускает к ассистенту людей и не пропускает скрипты.
 *
 * Устройство в двух словах. Сервер выдаёт задачу (nonce + сложность), подписанную своим
 * секретом. Браузер обязан найти такое число, чтобы sha256(nonce + число) начинался
 * с нужного количества нулевых бит, и вернуть его вместе с подписью. Проверка стоит
 * сервером один хеш, а решение — десятки тысяч, поэтому массовый обход становится дорогим.
 *
 * Почему именно так, а не «капча в браузере». Бот не открывает страницу: он бьёт прямо
 * в api/ai.php. Любая проверка, которая живёт только на клиенте, обходится удалением
 * одной строчки JS. Здесь же без правильного решения и подписи действие start не проходит.
 *
 * Чего этот механизм НЕ делает: он не остановит того, кто решил целенаправленно потратить
 * на нас время — тот напишет решатель. Он делает бессмысленным дешёвый массовый перебор,
 * а это и есть реальная угроза для кошелька и почтового ящика.
 */

// ---------- секрет для подписи ----------
/**
 * Секрет живёт в файле рядом с сессиями и создаётся сам при первом обращении.
 * В конфиг не выносим специально: тогда его пришлось бы придумывать руками,
 * а забытая пустая строка молча превратила бы подпись в решето.
 */
function pd_guard_secret() {
  static $s = null;
  if ($s !== null) return $s;
  $cfg = pd_config();
  if (!empty($cfg['guard_secret'])) { $s = $cfg['guard_secret']; return $s; }
  $f = pd_dir('sessions') . '/.guard-secret';
  if (is_file($f)) {
    $s = trim((string)file_get_contents($f));
    if ($s !== '') return $s;
  }
  $s = bin2hex(function_exists('random_bytes') ? random_bytes(32) : pack('N8', mt_rand(), mt_rand(), mt_rand(), mt_rand(), mt_rand(), mt_rand(), mt_rand(), mt_rand()));
  @file_put_contents($f, $s, LOCK_EX);
  @chmod($f, 0600);
  return $s;
}

function pd_guard_sign($parts) {
  return hash_hmac('sha256', implode('|', $parts), pd_guard_secret());
}
/** Сравнение подписей за постоянное время: обычный === утекает информацию по таймингу. */
function pd_guard_eq($a, $b) {
  if (function_exists('hash_equals')) return hash_equals((string)$a, (string)$b);
  $a = (string)$a; $b = (string)$b;
  if (strlen($a) !== strlen($b)) return false;
  $d = 0;
  for ($i = 0; $i < strlen($a); $i++) $d |= ord($a[$i]) ^ ord($b[$i]);
  return $d === 0;
}

// ---------- сложность ----------
/**
 * Сколько нулевых бит требовать. Каждый бит удваивает работу, поэтому потолок низкий.
 * Числа не из головы: замер НА ЖИВОМ САЙТЕ дал 160 тысяч хешей в секунду — вчетверо
 * меньше, чем та же реализация в чистом Node, потому что на странице крутится 3D-сцена
 * и забирает процессор. При такой скорости 16 бит это ~0,4 с на компьютере и ~1,5 с
 * на телефоне, 18 бит — ~1,6 и ~6 с. Выше 18 нельзя: живой человек за вечер вполне
 * может открыть панель десять раз, и он не должен за это расплачиваться минутой ожидания.
 */
function pd_guard_bits() {
  $cfg = pd_config();
  $base = isset($cfg['guard_bits']) ? (int)$cfg['guard_bits'] : 16;
  $recent = pd_guard_recent_count();
  $bits = $base + max(0, $recent - 2);
  $max = isset($cfg['guard_bits_max']) ? (int)$cfg['guard_bits_max'] : 18;
  return max(8, min($max, $bits));
}
/** Сколько задач выдали этому адресу за последний час. */
function pd_guard_recent_count() {
  $f = pd_dir('sessions') . '/guard-' . substr(sha1(pd_ip() . '|guard'), 0, 16) . '.json';
  $now = time();
  $hits = is_file($f) ? json_decode((string)file_get_contents($f), true) : array();
  if (!is_array($hits)) $hits = array();
  $hits = array_values(array_filter($hits, function ($t) use ($now) { return $now - (int)$t < 3600; }));
  return count($hits);
}
function pd_guard_note_issue() {
  $f = pd_dir('sessions') . '/guard-' . substr(sha1(pd_ip() . '|guard'), 0, 16) . '.json';
  $now = time();
  $hits = is_file($f) ? json_decode((string)file_get_contents($f), true) : array();
  if (!is_array($hits)) $hits = array();
  $hits = array_values(array_filter($hits, function ($t) use ($now) { return $now - (int)$t < 3600; }));
  $hits[] = $now;
  if (count($hits) > 200) $hits = array_slice($hits, -200);
  @file_put_contents($f, json_encode($hits), LOCK_EX);
}

// ---------- выдача задачи ----------
function pd_guard_issue() {
  $bits = pd_guard_bits();
  $exp = time() + 600;   // десять минут: человек может почитать страницу и вернуться
  $nonce = bin2hex(function_exists('random_bytes') ? random_bytes(12) : pack('N3', mt_rand(), mt_rand(), mt_rand()));
  pd_guard_note_issue();
  return array(
    'nonce' => $nonce,
    'bits' => $bits,
    'exp' => $exp,
    'sig' => pd_guard_sign(array($nonce, $bits, $exp, pd_guard_ip_tag())),
  );
}
/** Задача привязана к адресу: решённую на одной машине нельзя раздать тысяче ботов. */
function pd_guard_ip_tag() { return substr(sha1(pd_ip() . '|tag'), 0, 16); }

// ---------- проверка решения ----------
/**
 * Возвращает array(ok, ошибка, нужна_ли_живая_проверка).
 * Порядок проверок: подпись → срок → повтор → сама работа. Дешёвое раньше дорогого.
 */
function pd_guard_check($in) {
  $nonce = isset($in['nonce']) ? (string)$in['nonce'] : '';
  $bits = isset($in['bits']) ? (int)$in['bits'] : 0;
  $exp = isset($in['exp']) ? (int)$in['exp'] : 0;
  $sig = isset($in['sig']) ? (string)$in['sig'] : '';
  $sol = isset($in['solution']) ? (string)$in['solution'] : '';

  if ($nonce === '' || !preg_match('/^[0-9a-f]{8,32}$/', $nonce)) return array(false, 'проверка не пройдена: нет задачи', false);
  if ($bits < 8 || $bits > 32) return array(false, 'проверка не пройдена: испорченная задача', false);
  if (!pd_guard_eq($sig, pd_guard_sign(array($nonce, $bits, $exp, pd_guard_ip_tag()))))
    return array(false, 'проверка не пройдена: подпись не сходится', false);
  if ($exp < time()) return array(false, 'проверка устарела, начните заново', false);
  if (!pd_guard_use_once($nonce, $exp)) return array(false, 'эта проверка уже использована', false);
  if (!preg_match('/^[0-9]{1,20}$/', $sol)) return array(false, 'проверка не пройдена: нет решения', false);
  if (!pd_guard_pow_ok($nonce, $sol, $bits)) return array(false, 'проверка не пройдена: решение неверное', false);

  // Работа сделана. Теперь смотрим на поведение — но только чтобы решить,
  // показывать ли живую проверку, а не чтобы отказать. Отказывать по эвристике нельзя:
  // человек с клавиатуры или со скринридера выглядит «подозрительно» ровно так же, как бот.
  $needHuman = pd_guard_score($in) >= 3;
  return array(true, '', $needHuman);
}

/** Тот же nonce второй раз не принимаем: иначе одно решение открывает сколько угодно сессий. */
function pd_guard_use_once($nonce, $exp) {
  $f = pd_dir('sessions') . '/guard-used.json';
  $now = time();
  $used = is_file($f) ? json_decode((string)file_get_contents($f), true) : array();
  if (!is_array($used)) $used = array();
  // чистим просроченные, чтобы файл не рос вечно
  foreach ($used as $k => $t) if ((int)$t < $now) unset($used[$k]);
  if (isset($used[$nonce])) return false;
  $used[$nonce] = $exp;
  if (count($used) > 5000) $used = array_slice($used, -2000, null, true);
  @file_put_contents($f, json_encode($used), LOCK_EX);
  return true;
}

/** sha256(nonce:solution) должен начинаться с $bits нулевых бит. */
function pd_guard_pow_ok($nonce, $solution, $bits) {
  $h = hash('sha256', $nonce . ':' . $solution, true);
  $need = $bits;
  $i = 0;
  while ($need >= 8) {
    if (ord($h[$i]) !== 0) return false;
    $need -= 8; $i++;
  }
  if ($need > 0) {
    $mask = 0xFF << (8 - $need) & 0xFF;
    if ((ord($h[$i]) & $mask) !== 0) return false;
  }
  return true;
}

// ---------- поведенческие признаки ----------
/**
 * Мягкая оценка: чем выше, тем больше похоже на скрипт. Три и выше — попросим живое
 * подтверждение. Каждый признак сам по себе ничего не доказывает, поэтому и вес у них
 * небольшой, а отказа по ним не бывает вовсе.
 */
function pd_guard_score($in) {
  $s = isset($in['signals']) && is_array($in['signals']) ? $in['signals'] : array();
  $g = function ($k, $d = 0) use ($s) { return isset($s[$k]) ? $s[$k] : $d; };
  $score = 0;

  // Браузер сам сознался, что им управляет программа. Самый честный признак.
  if (!empty($s['wd'])) $score += 3;
  // Ни одного события ввода за всё время на странице: ни мыши, ни касания, ни клавиши.
  if ((int)$g('moves') === 0 && (int)$g('keys') === 0 && (int)$g('taps') === 0) $score += 1;
  // Панель открыли быстрее, чем человек успел бы прочитать заголовок.
  if ((int)$g('age') < 1200) $score += 1;
  // Окна нулевого размера бывают у headless-браузеров.
  if ((int)$g('w') < 200 || (int)$g('h') < 200) $score += 2;
  // Внутренние часы браузера не сходятся с серверными больше чем на сутки.
  if (abs((int)$g('tz', 0)) > 900) $score += 1;

  return $score;
}

// ---------- живая проверка (вторая ступень) ----------
/**
 * Задача «поймать фазу»: точка бежит по кругу, надо нажать, когда она в отмеченном
 * секторе. Сервер задаёт сектор и подписывает его, клиент присылает угол попадания.
 * Годится и мышью, и с клавиатуры — иначе проверка отсекала бы людей,
 * которые не пользуются мышью.
 */
function pd_guard_human_issue() {
  $target = mt_rand(0, 359);
  $exp = time() + 300;
  return array(
    'target' => $target,
    'span' => 26,          // допуск в градусах: попасть должно быть легко
    'exp' => $exp,
    'sig' => pd_guard_sign(array('human', $target, $exp, pd_guard_ip_tag())),
  );
}
function pd_guard_human_check($in) {
  $target = isset($in['target']) ? (int)$in['target'] : -1;
  $exp = isset($in['exp']) ? (int)$in['exp'] : 0;
  $sig = isset($in['sig']) ? (string)$in['sig'] : '';
  $hit = isset($in['hit']) ? (float)$in['hit'] : -1;
  if ($target < 0 || $target > 359) return array(false, 'испорченная проверка');
  if (!pd_guard_eq($sig, pd_guard_sign(array('human', $target, $exp, pd_guard_ip_tag())))) return array(false, 'подпись не сходится');
  if ($exp < time()) return array(false, 'проверка устарела');
  if ($hit < 0 || $hit > 360) return array(false, 'мимо, попробуйте ещё раз');
  // Расстояние по кругу: 350° и 10° отличаются на 20°, а не на 340°.
  $diff = fmod(abs($hit - $target), 360.0);
  $d = $diff > 180 ? 360 - $diff : $diff;
  if ($d > 26) return array(false, 'мимо, попробуйте ещё раз');
  return array(true, '');
}

/**
 * Пропуск, выданный после успешной проверки. Клиент прикладывает его к start.
 * Живёт коротко и привязан к адресу.
 */
function pd_guard_pass_new() {
  $exp = time() + 900;
  return array('exp' => $exp, 'sig' => pd_guard_sign(array('pass', $exp, pd_guard_ip_tag())));
}
function pd_guard_pass_ok($in) {
  $exp = isset($in['pass_exp']) ? (int)$in['pass_exp'] : 0;
  $sig = isset($in['pass_sig']) ? (string)$in['pass_sig'] : '';
  if ($exp < time()) return false;
  return pd_guard_eq($sig, pd_guard_sign(array('pass', $exp, pd_guard_ip_tag())));
}
