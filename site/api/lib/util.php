<?php
/**
 * Общая обвязка: конфиг, ответы в JSON, хранилище сессий, лимиты.
 * Зависимостей нет — только штатный PHP (нужен php-json, он включён по умолчанию).
 */

define('PD_DIR', dirname(__DIR__));          // .../site/api

// ---------- конфигурация ----------
function pd_config() {
  static $cfg = null;
  if ($cfg !== null) return $cfg;

  $defaults = array(
    'mail_to' => 'andrey@rolltorule.com',
    'mail_from' => 'ai@playdisplay.com',
    'mail_fromname' => 'PlayDisplay AI',
    'llm' => 'mock',
    'anthropic' => array('key' => '', 'model' => 'claude-haiku-4-5-20251001'),
    'openai_compat' => array('key' => '', 'base' => 'https://api.openai.com/v1', 'model' => 'gpt-5.6-luna', 'reasoning' => 'none', 'temperature' => ''),
    'gigachat' => array('key' => '', 'scope' => 'GIGACHAT_API_PERS', 'model' => 'GigaChat-2', 'ca' => '', 'base' => 'https://api.giga.chat/v1'),
    'llm_by_lang' => array(),
    'mailer' => 'file',
    'smtp' => array('host' => '', 'port' => 465, 'secure' => 'ssl', 'user' => '', 'pass' => ''),
    // Домены, которым разрешено обращаться к этому бэкенду с другого адреса.
    // Нужно только копии ai.php на отдельном хосте; своему сайту CORS не требуется.
    'cors_origins' => array(),
    'guard_bits' => 16,
    'guard_bits_max' => 19,
    'guard_off' => false,
    'limit_sessions_per_ip_hour' => 8,
    'limit_turns_per_session' => 24,
    'limit_chars_per_turn' => 4000,
    'keep_transcripts' => true,
  );

  // Порядок поиска: переменная окружения → вне веб-корня → рядом с ai.php.
  $paths = array();
  $env = getenv('PD_AI_CONFIG');
  if ($env) $paths[] = $env;
  $paths[] = dirname(dirname(PD_DIR)) . '/pd-ai-config.php';   // ~/wordpress_2/pd-ai-config.php
  $paths[] = PD_DIR . '/config.php';

  $found = array();
  foreach ($paths as $p) {
    if ($p && is_file($p)) {
      $loaded = include $p;
      if (is_array($loaded)) { $found = $loaded; break; }
    }
  }

  // Слияние на два уровня: вложенные блоки (anthropic, smtp…) дополняются, а не затираются.
  $cfg = $defaults;
  foreach ($found as $k => $v) {
    if (is_array($v) && isset($defaults[$k]) && is_array($defaults[$k])) $cfg[$k] = array_merge($defaults[$k], $v);
    else $cfg[$k] = $v;
  }
  return $cfg;
}

// ---------- ответы ----------
function pd_json($data, $code = 200) {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  header('Cache-Control: no-store');
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}
function pd_fail($msg, $code = 400, $extra = array()) {
  pd_json(array_merge(array('ok' => false, 'error' => $msg), $extra), $code);
}
function pd_body() {
  $raw = file_get_contents('php://input');
  if ($raw === false || $raw === '') return array();
  $d = json_decode($raw, true);
  return is_array($d) ? $d : array();
}

// ---------- строки ----------
function pd_str($v, $max = 4000) {
  if (!is_string($v)) $v = '';
  $v = str_replace(array("\r\n", "\r"), "\n", $v);
  $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $v);
  $v = trim($v);
  if (function_exists('mb_substr')) return mb_substr($v, 0, $max, 'UTF-8');
  return substr($v, 0, $max);
}
function pd_esc($v) { return htmlspecialchars((string)$v, ENT_QUOTES, 'UTF-8'); }
// mbstring на хостингах обычно есть, но падать из-за неё нельзя.
function pd_lower($v) { return function_exists('mb_strtolower') ? mb_strtolower((string)$v, 'UTF-8') : strtolower((string)$v); }
function pd_len($v)   { return function_exists('mb_strlen') ? mb_strlen((string)$v, 'UTF-8') : strlen((string)$v); }

// ---------- каталоги ----------
function pd_dir($name) {
  $d = PD_DIR . '/' . $name;
  if (!is_dir($d)) @mkdir($d, 0775, true);
  // На всякий случай закрываем каталог и от Apache — если .htaccess в api/ потеряется.
  $ht = $d . '/.htaccess';
  if (!is_file($ht)) @file_put_contents($ht, "Require all denied\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\n");
  return $d;
}

// ---------- сессии (файлы, без БД) ----------
function pd_sid_new() {
  $b = function_exists('random_bytes') ? random_bytes(9) : pack('N2', mt_rand(), mt_rand());
  return date('Ymd-His') . '-' . bin2hex($b);
}
function pd_sid_ok($sid) { return is_string($sid) && preg_match('/^\d{8}-\d{6}-[0-9a-f]{12,24}$/', $sid); }
function pd_sess_path($sid) { return pd_dir('sessions') . '/' . $sid . '.json'; }

function pd_sess_load($sid) {
  if (!pd_sid_ok($sid)) return null;
  $p = pd_sess_path($sid);
  if (!is_file($p)) return null;
  $d = json_decode((string)file_get_contents($p), true);
  return is_array($d) ? $d : null;
}
function pd_sess_save($s) {
  $p = pd_sess_path($s['sid']);
  @file_put_contents($p, json_encode($s, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
}

// ---------- лимиты ----------
function pd_ip() {
  $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '0.0.0.0';
  return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '0.0.0.0';
}
/** Скользящее окно в час на один адрес. Счётчик — простой файл на хеш адреса. */
function pd_rate_ok() {
  $cfg = pd_config();
  $lim = (int)$cfg['limit_sessions_per_ip_hour'];
  if ($lim <= 0) return true;
  $f = pd_dir('sessions') . '/rate-' . substr(sha1(pd_ip() . '|pd'), 0, 16) . '.json';
  $now = time();
  $hits = is_file($f) ? json_decode((string)file_get_contents($f), true) : array();
  if (!is_array($hits)) $hits = array();
  $hits = array_values(array_filter($hits, function ($t) use ($now) { return $now - (int)$t < 3600; }));
  if (count($hits) >= $lim) return false;
  $hits[] = $now;
  @file_put_contents($f, json_encode($hits), LOCK_EX);
  return true;
}

// ---------- HTTP-клиент ----------
/**
 * POST JSON. Возвращает array(код, тело, ошибка-транспорта).
 * Работает через curl, а если его нет — через потоки.
 */
function pd_http_post_json($url, $payload, $headers = array(), $timeout = 45, $ca = '') {
  $body = is_string($payload) ? $payload : json_encode($payload, JSON_UNESCAPED_UNICODE);
  // Content-Type ставим сам, но если вызывающий уже задал свой (form-urlencoded у OAuth) — не дублируем.
  $hasCT = false;
  foreach ($headers as $h) if (stripos($h, 'content-type:') === 0) { $hasCT = true; break; }
  $hdr = $hasCT ? $headers : array_merge(array('Content-Type: application/json'), $headers);

  if (function_exists('curl_init')) {
    $ch = curl_init($url);
    $opts = array(
      CURLOPT_POST => true,
      CURLOPT_POSTFIELDS => $body,
      CURLOPT_HTTPHEADER => $hdr,
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_TIMEOUT => $timeout,
      CURLOPT_CONNECTTIMEOUT => 12,
      CURLOPT_SSL_VERIFYPEER => true,
    );
    // Свой корневой сертификат. Нужен GigaChat: его хост подписан НУЦ Минцифры,
    // которого нет в стандартном хранилище — без этого соединение не поднимается вовсе.
    // Проверку сертификата НЕ отключаем: подсовываем правильный корень, а не доверяем всему.
    if ($ca !== '' && is_file($ca)) $opts[CURLOPT_CAINFO] = $ca;
    curl_setopt_array($ch, $opts);
    $res = curl_exec($ch);
    $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = $res === false ? curl_error($ch) : '';
    curl_close($ch);
    return array($code, (string)$res, $err);
  }

  $ctxOpts = array('http' => array(
    'method' => 'POST',
    'header' => implode("\r\n", $hdr),
    'content' => $body,
    'timeout' => $timeout,
    'ignore_errors' => true,
  ));
  if ($ca !== '' && is_file($ca)) $ctxOpts['ssl'] = array('cafile' => $ca, 'verify_peer' => true);
  $ctx = stream_context_create($ctxOpts);
  $res = @file_get_contents($url, false, $ctx);
  $code = 0;
  if (isset($http_response_header[0]) && preg_match('#\s(\d{3})\s#', $http_response_header[0], $m)) $code = (int)$m[1];
  return array($code, (string)$res, $res === false ? 'stream request failed' : '');
}

// ---------- разбор JSON из ответа модели ----------
/**
 * Модель иногда оборачивает JSON в ```json … ``` или добавляет текст вокруг.
 * Вытаскиваем первый сбалансированный объект.
 */
function pd_json_from_text($text) {
  $text = trim((string)$text);
  if ($text === '') return null;
  $d = json_decode($text, true);
  if (is_array($d)) return $d;

  if (preg_match('/```(?:json)?\s*(.+?)```/s', $text, $m)) {
    $d = json_decode(trim($m[1]), true);
    if (is_array($d)) return $d;
  }
  $start = strpos($text, '{');
  if ($start === false) return null;
  $depth = 0; $inStr = false; $esc = false; $len = strlen($text);
  for ($i = $start; $i < $len; $i++) {
    $c = $text[$i];
    if ($inStr) {
      if ($esc) { $esc = false; }
      elseif ($c === '\\') { $esc = true; }
      elseif ($c === '"') { $inStr = false; }
      continue;
    }
    if ($c === '"') { $inStr = true; continue; }
    if ($c === '{') $depth++;
    elseif ($c === '}') {
      $depth--;
      if ($depth === 0) {
        $d = json_decode(substr($text, $start, $i - $start + 1), true);
        return is_array($d) ? $d : null;
      }
    }
  }
  return null;
}

// ---------- лог ошибок ----------
function pd_log($tag, $msg) {
  $line = date('c') . ' [' . $tag . '] ' . (is_string($msg) ? $msg : json_encode($msg, JSON_UNESCAPED_UNICODE)) . "\n";
  @file_put_contents(pd_dir('sessions') . '/error.log', $line, FILE_APPEND | LOCK_EX);
}
