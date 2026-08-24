<?php
/**
 * Настройки 3D-сцены главной, ОБЩИЕ ДЛЯ ВСЕХ ПОСЕТИТЕЛЕЙ.
 *
 *   GET  /api/scene.php?p=mobile      → {ok, rev, profile, data|null, saved}
 *   POST {action:'save',  profile, pass, data}  → {ok, rev}
 *   POST {action:'clear', profile, pass}        → {ok, rev}      вернуть заводские
 *
 * Раньше подбор ползунков жил в localStorage того браузера, где его крутили: настроил
 * на телефоне — на сайте у людей всё по-прежнему. Теперь панель умеет положить набор
 * сюда, и его получает каждый.
 *
 * Написано НАМЕРЕННО старомодно (без strict_types, без стрелочных функций, своя
 * реализация PBKDF2 не нужна — hash_pbkdf2 есть с PHP 5.5): версию PHP на шаред-хостинге
 * меняют без предупреждения, и здесь не должно быть ничего свежее пятой ветки.
 * Зависимостей от api/lib нет сознательно: сцена обязана открываться и тогда, когда
 * конфиг ассистента не заполнен.
 */

@ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');       // ответ меняется по кнопке в панели — кэшу тут делать нечего

define('PD_SCENE_FILE', __DIR__ . '/scene-settings.json');

// Что вообще можно записать. Список нужен не для красоты: этот файл отдаётся КАЖДОМУ
// посетителю и вливается в настройки сцены, поэтому чужие ключи и числа за пределами
// ползунков сюда попасть не должны. Границы — те же, что у слайдеров в панели.
function pd_scene_spec() {
  return array(
    'height'    => array(-10, 40),
    'viewy'     => array(-30, 30),
    'fov'       => array(25, 100),
    'dist'      => array(15, 100),
    'sizemin'   => array(0.5, 12),
    'sizemax'   => array(2, 48),
    'sizevar'   => array(1, 10),
    'projscale' => array(0.3, 3),
    'morph'     => array(0, 16),
    'count'     => array(0.05, 1),
    'spread'    => array(0, 3),
    'edge'      => array(-1, 1),
    'objscale'  => array(0.3, 6),
    'envscale'  => array(0.3, 10),
    'vortspeed' => array(0, 3),
    'vortamp'   => array(0, 3),
    'vortpct'   => array(0, 1),
    'rubber'    => array(0, 1.2),
    'stickx'    => array(0.2, 3),      // скорость руля по горизонтали, экранов в секунду
    'sticky'    => array(0.2, 3),      // …и по вертикали
    'stickexpo' => array(0, 1),        // доля квадратичной составляющей в кривой руля
  );
}
function pd_scene_bools() { return array('envon', 'sound', 'autoq', 'projfit'); }
function pd_scene_models() {
  return array('original', 'sphere', 'torus', 'knot', 'ico', 'cone', 'box', 'plane');
}

function pd_scene_out($data, $code = 200) {
  http_response_code($code);
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}
function pd_scene_fail($msg, $code = 400) { pd_scene_out(array('ok' => false, 'error' => $msg), $code); }

function pd_scene_profile($v) { return ($v === 'mobile') ? 'mobile' : 'desktop'; }

function pd_scene_all() {
  if (!is_file(PD_SCENE_FILE)) return array();
  $raw = @file_get_contents(PD_SCENE_FILE);
  if (!$raw) return array();
  $o = json_decode($raw, true);
  return is_array($o) ? $o : array();
}

// Оставляем от присланного только знакомое и в границах. Всё остальное молча выбрасываем:
// половина набора лучше, чем сцена, вставшая на чужом числе.
function pd_scene_clean($in) {
  $out = array();
  if (!is_array($in)) return $out;
  $spec = pd_scene_spec();
  foreach ($spec as $k => $r) {
    if (!isset($in[$k]) || !is_numeric($in[$k])) continue;
    $v = (float)$in[$k];
    if (!is_finite($v)) continue;
    if ($v < $r[0]) $v = $r[0];
    if ($v > $r[1]) $v = $r[1];
    $out[$k] = round($v, 4);
  }
  foreach (pd_scene_bools() as $k) {
    if (isset($in[$k])) $out[$k] = $in[$k] ? true : false;
  }
  if (isset($in['model']) && in_array($in['model'], pd_scene_models(), true)) $out['model'] = $in['model'];
  return $out;
}

function pd_scene_pass_ok($pass) {
  if (!is_string($pass) || $pass === '') return false;
  $f = __DIR__ . '/scene-pass.php';
  if (!is_file($f)) return false;
  $p = include $f;
  if (!is_array($p) || empty($p['salt']) || empty($p['hash'])) return false;
  $iter = isset($p['iter']) ? (int)$p['iter'] : 200000;
  $calc = hash_pbkdf2('sha256', $pass, $p['salt'], $iter);
  // сравнение за постоянное время: обычное === выдаёт длину общего начала по времени ответа
  if (function_exists('hash_equals')) return hash_equals($p['hash'], $calc);
  return $calc === $p['hash'];
}

$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';

// ---------- Чтение: доступно всем, это и есть вид сайта ----------
if ($method !== 'POST') {
  $all = pd_scene_all();
  $prof = pd_scene_profile(isset($_GET['p']) ? $_GET['p'] : '');
  $has = isset($all[$prof]) && is_array($all[$prof]) && !empty($all[$prof]['data']);
  pd_scene_out(array(
    'ok'      => true,
    'profile' => $prof,
    'rev'     => isset($all['rev']) ? (int)$all['rev'] : 0,
    'saved'   => $has && isset($all[$prof]['saved']) ? $all[$prof]['saved'] : '',
    'data'    => $has ? $all[$prof]['data'] : null,
  ));
}

// ---------- Запись: только по паролю ----------
$raw = file_get_contents('php://input');
if (strlen($raw) > 20000) pd_scene_fail('слишком большой запрос', 413);
$in = json_decode($raw, true);
if (!is_array($in)) pd_scene_fail('ожидается JSON');

$action = isset($in['action']) ? $in['action'] : '';
if ($action !== 'save' && $action !== 'clear') pd_scene_fail('неизвестное действие');

if (!pd_scene_pass_ok(isset($in['pass']) ? $in['pass'] : '')) {
  usleep(400000);                       // перебор по сети становится бессмысленно долгим
  pd_scene_fail('неверный пароль', 403);
}

$prof = pd_scene_profile(isset($in['profile']) ? $in['profile'] : '');
$all = pd_scene_all();

if ($action === 'clear') {
  unset($all[$prof]);
} else {
  $data = pd_scene_clean(isset($in['data']) ? $in['data'] : null);
  if (!$data) pd_scene_fail('нечего сохранять');
  $all[$prof] = array('data' => $data, 'saved' => date('Y-m-d H:i'));
}
$all['rev'] = (isset($all['rev']) ? (int)$all['rev'] : 0) + 1;

// пишем через временный файл: обрыв на середине не должен оставить сайту битый JSON
$tmp = PD_SCENE_FILE . '.tmp';
$ok = @file_put_contents($tmp, json_encode($all, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
if ($ok === false || !@rename($tmp, PD_SCENE_FILE)) {
  @unlink($tmp);
  pd_scene_fail('не удалось записать файл настроек на сервере', 500);
}
@chmod(PD_SCENE_FILE, 0664);

pd_scene_out(array('ok' => true, 'rev' => (int)$all['rev'], 'profile' => $prof));
