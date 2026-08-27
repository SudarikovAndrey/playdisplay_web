<?php
/**
 * Таблица рекордов мини-игры (полёт из hero-scene).
 *
 *   GET                                  → {ok, top: [{n, s}...], count}
 *   POST {action:'save', name, score}    → {ok, pos, count, top}
 *
 * Как и scene.php — намеренно без зависимостей от api/lib и config: игра обязана
 * работать, даже когда ассистент не настроен. Стиль старомодный по той же причине
 * (версию PHP на шаред-хостинге меняют без предупреждения).
 *
 * ИМЕНА ФИЛЬТРУЮТСЯ НА СЕРВЕРЕ: мат, оскорбления, слова о войне с Украиной, сексе,
 * расизме маскируются звёздочками (первая буква остаётся). Список — эвристика по
 * корням с нормализацией маскировки (латиница↔кириллица, цифры вместо букв): всё
 * не поймает, но дежурную грязь в публичном списке гасит. Дополнять — в pd_bad_stems.
 */

@ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

define('PD_GAME_FILE', __DIR__ . '/game-scores.json');
define('PD_GAME_KEEP', 300);     // сколько строк живёт в файле
define('PD_GAME_TOP', 100);      // сколько отдаём клиенту

function pd_game_out($d, $code = 200) { http_response_code($code); echo json_encode($d, JSON_UNESCAPED_UNICODE); exit; }
function pd_game_fail($m, $code = 400) { pd_game_out(array('ok' => false, 'error' => $m), $code); }

// ---------- фильтр имён ----------
// Нормализация: нижний регистр + маскировочные замены схлопываются к кириллице/базе.
// Так «xyй», «сУ4ка», «n1gger» находятся теми же корнями, что и прямое написание.
function pd_norm_name($s) {
  $s = function_exists('mb_strtolower') ? mb_strtolower($s, 'UTF-8') : strtolower($s);
  $map = array(
    'a' => 'а', 'b' => 'б', 'c' => 'с', 's' => 'с', 'e' => 'е', 'k' => 'к', 'm' => 'м', 'h' => 'н',
    'o' => 'о', 'p' => 'р', 't' => 'т', 'x' => 'х', 'y' => 'у', 'u' => 'у',
    '0' => 'о', '1' => 'и', '3' => 'з', '4' => 'ч', '6' => 'б', '9' => 'д',
    '@' => 'а', '$' => 'с',
  );
  $out = array();
  $chars = preg_split('//u', $s, -1, PREG_SPLIT_NO_EMPTY);
  foreach ($chars as $ch) $out[] = isset($map[$ch]) ? $map[$ch] : $ch;
  return $out;   // массив символов: индексы совпадают с исходной строкой
}
// Корни в НОРМАЛИЗОВАННОМ виде (см. pd_norm_name: латиница уже свёрнута в кириллицу,
// поэтому английские корни записаны так, как они выглядят ПОСЛЕ свёртки).
function pd_bad_stems() {
  return array(
    // мат и оскорбления
    'хуй', 'хуе', 'хуё', 'хуя', 'хуйл', 'пизд',   // 'хул' был жадным: ловил «Хулигана» 'ебан', 'ебат', 'ебал', 'ебло', 'ебуч',
    'заеб', 'уеб', 'выеб', 'бля', 'сука', 'суки', 'сучк', 'мудак', 'мудил', 'гандон',
    'гондон', 'пидор', 'пидар', 'пидр', 'педик', 'дроч', 'шлюх', 'еблан', 'манд',
    'залуп', 'елда', 'мраз', 'ублюд', 'дебил', 'даун',
    // война с Украиной: этнослуры и клички обеих сторон
    'хохол', 'хохл', 'кацап', 'москал', 'русня', 'укроп', 'укр0', 'рашист', 'путлер',
    'бандеров', 'ватник', 'колорад', 'нацист', 'фашист', 'свастик',
    // секс
    'секс', 'порн', 'порев', 'минет', 'вагин', 'анал', 'сперм', 'кончи', 'сосат', 'соси',
    // расизм и ксенофобия (русские написания; английские — отдельным латинским проходом)
    'жид', 'нигер', 'нигг', 'негр', 'чурк', 'чучмек', 'хач', 'черножоп', 'узкоглаз',
    'гитлер',
  );
}
// Английские корни ловятся ВТОРЫМ проходом в латинском алфавите: свёртка в кириллицу
// для них не годится (первый вариант пропустил «n1gger» — буквы n, i, g в кириллицу
// не сворачиваются). Здесь нормализация своя: нижний регистр + литспик-цифры.
function pd_norm_latin($s) {
  $s = function_exists('mb_strtolower') ? mb_strtolower($s, 'UTF-8') : strtolower($s);
  $map = array('0' => 'o', '1' => 'i', '3' => 'e', '4' => 'a', '5' => 's', '7' => 't', '@' => 'a', '$' => 's');
  $out = array();
  foreach (preg_split('//u', $s, -1, PREG_SPLIT_NO_EMPTY) as $ch) $out[] = isset($map[$ch]) ? $map[$ch] : $ch;
  return $out;
}
function pd_bad_stems_latin() {
  return array(
    'fuck', 'fck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'whore', 'slut',
    'faggot', 'nigger', 'nigga', 'negro', 'nazi', 'rape', 'rapist', 'hitler', 'porn',
    'penis', 'blowjob',   // 'anal' убран: ловил «Analyst» (Сканторп); кириллический «анал» остался
    // транслит русского мата латиницей
    'zaeb', 'blyad', 'blyat', 'suka', 'suchk', 'pizd', 'pidor', 'pidar', 'mudak',
    'ebat', 'eblan', 'huyl', 'hohol', 'hohl', 'kacap', 'moskal',
  );
}
// Схлопывание разделителей: «F_u_c_k» и «х о х о л» прячут корень пробелами и
// подчёркиваниями. Убираем разделители, храня карту «сжатый индекс → исходный»,
// и прогоняем те же корни ещё раз — маска ложится на исходные буквы по карте.
function pd_squeeze($norm) {
  $chars = array(); $idx = array();
  foreach ($norm as $i => $ch) {
    if ($ch === ' ' || $ch === '_' || $ch === '-' || $ch === '.' || $ch === '*' || $ch === "'") continue;
    $chars[] = $ch; $idx[] = $i;
  }
  return array($chars, $idx);
}
// Маскировка: найденный корень превращается в первую букву + звёздочки.
function pd_mask_scan(&$mask, $norm, $stems, $idxmap = null) {
  $n = count($norm);
  foreach ($stems as $stem) {
    $sc = preg_split('//u', $stem, -1, PREG_SPLIT_NO_EMPTY);
    $sl = count($sc);
    for ($i = 0; $i + $sl <= $n; $i++) {
      $hit = true;
      for ($j = 0; $j < $sl; $j++) if ($norm[$i + $j] !== $sc[$j]) { $hit = false; break; }
      if (!$hit) continue;
      for ($j = 1; $j < $sl; $j++) {                                 // первая буква остаётся
        $k = $idxmap === null ? $i + $j : $idxmap[$i + $j];
        $mask[$k] = true;
      }
    }
  }
}
function pd_mask_name($name) {
  $orig = preg_split('//u', $name, -1, PREG_SPLIT_NO_EMPTY);
  $n = count($orig);
  $mask = array_fill(0, $n, false);
  $cyr = pd_norm_name($name);
  $lat = pd_norm_latin($name);
  pd_mask_scan($mask, $cyr, pd_bad_stems());                          // кириллица + маскировка
  pd_mask_scan($mask, $lat, pd_bad_stems_latin());                    // латиница + литспик
  list($cs, $ci) = pd_squeeze($cyr);
  pd_mask_scan($mask, $cs, pd_bad_stems(), $ci);                      // …и без разделителей
  list($ls, $li) = pd_squeeze($lat);
  pd_mask_scan($mask, $ls, pd_bad_stems_latin(), $li);
  for ($i = 0; $i < $n; $i++) if ($mask[$i]) $orig[$i] = '*';
  return implode('', $orig);
}

function pd_game_all() {
  if (!is_file(PD_GAME_FILE)) return array();
  $o = json_decode(@file_get_contents(PD_GAME_FILE), true);
  return (is_array($o) && isset($o['list']) && is_array($o['list'])) ? $o['list'] : array();
}
function pd_game_top($list) {
  $top = array_slice($list, 0, PD_GAME_TOP);
  $out = array();
  foreach ($top as $e) $out[] = array('n' => $e['n'], 's' => (int)$e['s']);
  return $out;
}

$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';

if ($method !== 'POST') {
  $list = pd_game_all();
  pd_game_out(array('ok' => true, 'count' => count($list), 'top' => pd_game_top($list)));
}

// ---------- запись ----------
$raw = file_get_contents('php://input');
if (strlen($raw) > 4000) pd_game_fail('слишком большой запрос', 413);
$in = json_decode($raw, true);
if (!is_array($in) || !isset($in['action']) || $in['action'] !== 'save') pd_game_fail('ожидается save');

// имя: обрезать, выкинуть управляющие и угловые скобки, 1..24 знака
$name = isset($in['name']) ? trim((string)$in['name']) : '';
$name = preg_replace('/[\x00-\x1f<>&"\'\\\\]/u', '', $name);
if (function_exists('mb_substr')) $name = mb_substr($name, 0, 24, 'UTF-8'); else $name = substr($name, 0, 24);
if ($name === '') pd_game_fail('пустое имя');
$name = pd_mask_name($name);

$score = isset($in['score']) ? (int)$in['score'] : -1;
if ($score < 0 || $score > 5000000) pd_game_fail('очки вне диапазона');

// токен игрока: случайный ключ браузера. Имя закрепляется за токеном — чужое занятое
// имя взять нельзя, своё можно улучшать (в таблице одна строка на игрока, лучший счёт)
$tok = isset($in['tok']) && is_string($in['tok']) && preg_match('/^[0-9a-f]{8,64}$/', $in['tok']) ? $in['tok'] : '';

// лёгкий стоп частым записям: не чаще раза в 5 секунд с адреса
$ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '?';
$rl = sys_get_temp_dir() . '/pd-game-' . md5($ip);
$last = @filemtime($rl);
if ($last && time() - $last < 5) pd_game_fail('слишком часто, подождите пару секунд', 429);
@touch($rl);

$list = pd_game_all();
// одна строка на имя: ищем существующую (без учёта регистра)
$key = function_exists('mb_strtolower') ? mb_strtolower($name, 'UTF-8') : strtolower($name);
$found = -1;
foreach ($list as $i => $e) {
  $ek = function_exists('mb_strtolower') ? mb_strtolower($e['n'], 'UTF-8') : strtolower($e['n']);
  if ($ek === $key) { $found = $i; break; }
}
if ($found >= 0) {
  $own = empty($list[$found]['tok']) || ($tok !== '' && $list[$found]['tok'] === $tok);
  if (!$own) pd_game_fail('имя занято — выберите другое', 409);
  // своё имя: лучший счёт остаётся, токен закрепляется
  if ($score > (int)$list[$found]['s']) { $list[$found]['s'] = $score; $list[$found]['t'] = date('Y-m-d H:i'); }
  if ($tok !== '') $list[$found]['tok'] = $tok;
} else {
  $list[] = array('n' => $name, 's' => $score, 't' => date('Y-m-d H:i'), 'tok' => $tok);
}
usort($list, function ($a, $b) { return $b['s'] - $a['s']; });
$list = array_slice($list, 0, PD_GAME_KEEP);

// позиция строки игрока после сортировки
$pos = 0;
foreach ($list as $i => $e) {
  $ek = function_exists('mb_strtolower') ? mb_strtolower($e['n'], 'UTF-8') : strtolower($e['n']);
  if ($ek === $key) { $pos = $i + 1; break; }
}
if (!$pos) $pos = count($list);   // вытеснили за пределы KEEP — честно последнее место

$tmp = PD_GAME_FILE . '.tmp';
$ok = @file_put_contents($tmp, json_encode(array('list' => $list), JSON_UNESCAPED_UNICODE), LOCK_EX);
if ($ok === false || !@rename($tmp, PD_GAME_FILE)) { @unlink($tmp); pd_game_fail('не удалось записать', 500); }
@chmod(PD_GAME_FILE, 0664);

pd_game_out(array('ok' => true, 'pos' => $pos, 'count' => count($list), 'top' => pd_game_top($list)));
