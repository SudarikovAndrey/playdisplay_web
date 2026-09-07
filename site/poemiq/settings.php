<?php
/**
 * Настройки рендера страницы POEMIQ, ОБЩИЕ ДЛЯ ВСЕХ ПОСЕТИТЕЛЕЙ.
 *
 *   GET  settings.php                              → {ok, data: {dark, light, scheme} | null}
 *   POST {action:'save',  pass, data:{dark,light,scheme}} → {ok}
 *   POST {action:'clear', pass}                    → {ok}       вернуть заводские
 *
 * Пароль — тот же, что у кнопки «Сохранить для всех» панели 3D-сцены главной:
 * соль и отпечаток PBKDF2 в ../api/scene-pass.php, сменить — python3 _tools/scene-pass.py.
 * Файл settings.json рождается на сервере, в git его нет, в deploy.sh он исключён —
 * иначе первая же поставка снесла бы подобранный вид.
 *
 * Написано намеренно старомодно (без strict_types и стрелочных функций):
 * версию PHP на шаред-хостинге меняют без предупреждения.
 */

@ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

define('PQ_FILE', __DIR__ . '/settings.json');

// Границы — те же, что у ползунков панели: этот файл вливается в настройки у каждого
// посетителя, чужим ключам и числам за пределами слайдеров здесь делать нечего.
function pq_spec() {
  return array(
    'expo'   => array(0.3, 2),
    'rough'  => array(0.02, 0.5),
    'env'    => array(0, 2.5),
    'envRot' => array(0, 360),
    'key'    => array(0, 3),
    'bloom'  => array(0, 0.6),
    'shadow' => array(0, 1),
  );
}
function pq_enums() {
  return array(
    'tm'     => array('neutral', 'aces', 'agx'),
    'metals' => array('physical', 'ijewel'),
    'envSrc' => array('jewelshop', 'studio'),
  );
}
function pq_bools() { return array('autoRotate', 'envLock'); }

function pq_out($data, $code = 200) { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE); exit; }
function pq_fail($msg, $code = 400) { pq_out(array('ok' => false, 'error' => $msg), $code); }

function pq_pass_ok($pass) {
  if (!is_string($pass) || $pass === '') return false;
  $f = dirname(__DIR__) . '/api/scene-pass.php';
  if (!is_file($f)) return false;
  $p = include $f;
  if (!is_array($p) || empty($p['salt']) || empty($p['hash'])) return false;
  $iter = isset($p['iter']) ? (int)$p['iter'] : 200000;
  $calc = hash_pbkdf2('sha256', $pass, $p['salt'], $iter);
  if (function_exists('hash_equals')) return hash_equals($p['hash'], $calc);
  return $calc === $p['hash'];
}

// один набор → чистый набор (только известные ключи, числа в границах)
function pq_clean_set($in) {
  if (!is_array($in)) return null;
  $out = array();
  foreach (pq_spec() as $k => $lim) {
    if (isset($in[$k]) && is_numeric($in[$k])) $out[$k] = max($lim[0], min($lim[1], (float)$in[$k]));
  }
  foreach (pq_enums() as $k => $vals) {
    if (isset($in[$k]) && in_array($in[$k], $vals, true)) $out[$k] = $in[$k];
  }
  foreach (pq_bools() as $k) {
    if (isset($in[$k])) $out[$k] = (bool)$in[$k];
  }
  return $out ? $out : null;
}

$method = isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : 'GET';

if ($method === 'GET') {
  $data = null;
  if (is_file(PQ_FILE)) { $raw = @file_get_contents(PQ_FILE); $o = $raw ? json_decode($raw, true) : null; if (is_array($o)) $data = $o; }
  pq_out(array('ok' => true, 'data' => $data));
}

if ($method !== 'POST') pq_fail('method', 405);
$body = json_decode(@file_get_contents('php://input'), true);
if (!is_array($body)) pq_fail('bad json');
if (!pq_pass_ok(isset($body['pass']) ? $body['pass'] : '')) pq_fail('wrong password', 403);

$action = isset($body['action']) ? $body['action'] : 'save';
if ($action === 'clear') {
  if (is_file(PQ_FILE)) @unlink(PQ_FILE);
  pq_out(array('ok' => true));
}
$data = isset($body['data']) && is_array($body['data']) ? $body['data'] : array();
$save = array('savedAt' => date('c'));
foreach (array('dark', 'light') as $t) { $set = pq_clean_set(isset($data[$t]) ? $data[$t] : null); if ($set) $save[$t] = $set; }
if (isset($data['scheme']) && ($data['scheme'] === 'dark' || $data['scheme'] === 'light')) $save['scheme'] = $data['scheme'];
if (!isset($save['dark']) && !isset($save['light'])) pq_fail('nothing to save');
if (@file_put_contents(PQ_FILE, json_encode($save, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX) === false) pq_fail('write failed', 500);
pq_out(array('ok' => true));
