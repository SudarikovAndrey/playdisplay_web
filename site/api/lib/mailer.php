<?php
/**
 * Отправка письма. Три драйвера, наружу — pd_send_mail(): array(ok, info).
 *
 * file — письмо целиком кладётся в site/api/outbox/ (для локальной работы: ничего не настраивать,
 *        файл открывается в браузере и видно ровно то, что придёт на почту).
 * smtp — прямое соединение с сервером своего домена. Своя реализация на fsockopen:
 *        тянуть PHPMailer в статичный сайт из-за одного письма нет смысла.
 * mail — mail() хостинга.
 */

/**
 * $html        — вёрстка для письма (логотип ссылкой на вложение, cid)
 * $htmlPreview — та же вёрстка для файла на диске (логотип встроен в разметку).
 *                Разные, потому что cid работает только внутри письма.
 */
function pd_send_mail($subject, $html, $text, $replyTo = '', $htmlPreview = '', $files = array()) {
  $cfg = pd_config();
  $to = $cfg['mail_to'];
  $from = $cfg['mail_from'];
  $fromName = $cfg['mail_fromname'];

  $rand = function () { return bin2hex(function_exists('random_bytes') ? random_bytes(8) : pack('N2', mt_rand(), mt_rand())); };
  $alt = 'pd-alt-' . $rand();
  $rel = 'pd-rel-' . $rand();

  // Логотип едет вложением внутри письма, а не ссылкой на сайт: почтовики по умолчанию
  // блокируют внешние картинки, и шапка приезжала бы пустой.
  $logoFile = function_exists('pd_logo_path') ? pd_logo_path() : '';
  $logo = $logoFile !== '' ? (string)file_get_contents($logoFile) : '';

  $headers = array();
  $headers[] = 'From: ' . pd_mime_name($fromName) . ' <' . $from . '>';
  $headers[] = 'To: <' . $to . '>';
  $headers[] = 'Subject: ' . pd_mime_header($subject);
  $headers[] = 'Date: ' . date('r');
  $headers[] = 'Message-ID: <' . $alt . '@playdisplay.com>';
  $headers[] = 'MIME-Version: 1.0';
  if ($replyTo !== '' && filter_var($replyTo, FILTER_VALIDATE_EMAIL)) $headers[] = 'Reply-To: <' . $replyTo . '>';

  // Две версии одного письма: текстовая для тех, кто отключил html, и вёрстка.
  $altPart = "--$alt\r\n"
        . "Content-Type: text/plain; charset=UTF-8\r\n"
        . "Content-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode($text)) . "\r\n"
        . "--$alt\r\n"
        . "Content-Type: text/html; charset=UTF-8\r\n"
        . "Content-Transfer-Encoding: base64\r\n\r\n"
        . chunk_split(base64_encode($html)) . "\r\n"
        . "--$alt--\r\n";

  // Есть картинка — related (текст+html+логотип), нет — просто alternative.
  if ($logo === '') {
    $innerType = 'multipart/alternative; boundary="' . $alt . '"';
    $inner = $altPart;
  } else {
    $cid = defined('PD_LOGO_CID') ? PD_LOGO_CID : 'pdlogo';
    $innerType = 'multipart/related; type="multipart/alternative"; boundary="' . $rel . '"';
    $inner = "--$rel\r\n"
          . "Content-Type: multipart/alternative; boundary=\"$alt\"\r\n\r\n"
          . $altPart
          . "--$rel\r\n"
          . "Content-Type: image/png; name=\"playdisplay.png\"\r\n"
          . "Content-Transfer-Encoding: base64\r\n"
          . "Content-ID: <$cid>\r\n"
          // inline, а не attachment: иначе почтовые клиенты показывают скрепку вложения
          . "Content-Disposition: inline; filename=\"playdisplay.png\"\r\n\r\n"
          . chunk_split(base64_encode($logo)) . "\r\n"
          . "--$rel--\r\n";
  }

  // Приложенный человеком файл — настоящее вложение, поэтому над письмом появляется
  // третий слой, mixed: [ письмо целиком ] + [ файлы ]. Логотип при этом остаётся
  // внутри related и скрепкой не показывается — иначе в письме было бы два вложения,
  // и настоящее ТЗ пришлось бы искать среди служебных картинок.
  $attach = array();
  foreach ((array)$files as $f) {
    if (empty($f['path']) || !is_file($f['path'])) continue;
    $raw = @file_get_contents($f['path']);
    if ($raw === false) continue;
    $attach[] = array(
      'name' => isset($f['name']) ? (string)$f['name'] : 'file',
      'mime' => isset($f['mime']) ? (string)$f['mime'] : 'application/octet-stream',
      'data' => $raw,
    );
  }

  if (!$attach) {
    $headers[] = 'Content-Type: ' . $innerType;
    $body = $inner;
  } else {
    $mix = 'pd-mix-' . $rand();
    $headers[] = 'Content-Type: multipart/mixed; boundary="' . $mix . '"';
    $body = "--$mix\r\n" . 'Content-Type: ' . $innerType . "\r\n\r\n" . $inner;
    foreach ($attach as $a) {
      $body .= "--$mix\r\n"
        . 'Content-Type: ' . $a['mime'] . '; name="' . pd_mime_filename($a['name']) . "\"\r\n"
        . "Content-Transfer-Encoding: base64\r\n"
        . 'Content-Disposition: attachment; filename="' . pd_mime_filename($a['name']) . '"; '
        . "filename*=UTF-8''" . rawurlencode($a['name']) . "\r\n\r\n"
        . chunk_split(base64_encode($a['data'])) . "\r\n";
    }
    $body .= "--$mix--\r\n";
  }

  switch ($cfg['mailer']) {
    case 'smtp': return pd_mail_smtp($cfg['smtp'], $from, $to, $headers, $body);
    case 'mail': return pd_mail_native($to, $subject, $headers, $body);
    default:     return pd_mail_file($subject, $headers, $body, $htmlPreview !== '' ? $htmlPreview : $html);
  }
}

/** RFC 2047 — иначе русская тема письма приезжает крякозябрами. */
function pd_mime_header($v) { return '=?UTF-8?B?' . base64_encode((string)$v) . '?='; }
function pd_mime_name($v)   { return preg_match('/^[\x20-\x7E]+$/', (string)$v) ? '"' . str_replace('"', '', $v) . '"' : pd_mime_header($v); }
/**
 * Имя вложения для старого поля filename="…". Латиница проходит как есть, всё
 * остальное — в RFC 2047; рядом всегда стоит filename*=UTF-8'' по RFC 2231, и
 * современные почтовики берут именно его, так что кириллица в имени не теряется.
 */
function pd_mime_filename($v) {
  $v = str_replace(array('"', "\r", "\n"), '', (string)$v);
  return preg_match('/^[\x20-\x7E]+$/', $v) ? $v : pd_mime_header($v);
}

// ---------------------------------------------------------------- file
function pd_mail_file($subject, $headers, $body, $html) {
  $dir = pd_dir('outbox');
  $stamp = date('Ymd-His') . '-' . substr(md5($subject . microtime()), 0, 6);
  $eml = implode("\r\n", $headers) . "\r\n\r\n" . $body;
  $okEml = @file_put_contents($dir . '/' . $stamp . '.eml', $eml) !== false;
  $okHtml = @file_put_contents($dir . '/' . $stamp . '.html', $html) !== false;
  if (!$okEml || !$okHtml) return array(false, 'не удалось записать в api/outbox — проверьте права на папку');
  return array(true, 'письмо сохранено: api/outbox/' . $stamp . '.html');
}

// ---------------------------------------------------------------- mail()
function pd_mail_native($to, $subject, $headers, $body) {
  if (!function_exists('mail')) return array(false, 'функция mail() отключена на хостинге');
  // Subject и To идут отдельными аргументами — из общего списка их надо убрать.
  $rest = array();
  foreach ($headers as $h) {
    if (stripos($h, 'subject:') === 0 || stripos($h, 'to:') === 0) continue;
    $rest[] = $h;
  }
  $ok = @mail($to, pd_mime_header($subject), $body, implode("\r\n", $rest));
  return $ok ? array(true, 'отправлено через mail()') : array(false, 'mail() вернула ошибку');
}

// ---------------------------------------------------------------- SMTP
function pd_mail_smtp($s, $from, $to, $headers, $body) {
  if (empty($s['host']) || empty($s['user'])) return array(false, 'smtp не настроен: нет host или user');
  $secure = isset($s['secure']) ? $s['secure'] : 'ssl';
  $port = (int)$s['port'];
  $host = ($secure === 'ssl') ? 'ssl://' . $s['host'] : $s['host'];

  $errNo = 0; $errStr = '';
  $fp = @stream_socket_client($host . ':' . $port, $errNo, $errStr, 20, STREAM_CLIENT_CONNECT);
  if (!$fp) return array(false, 'smtp: не соединиться с ' . $s['host'] . ':' . $port . ' (' . $errStr . ')');
  stream_set_timeout($fp, 20);

  $log = array();
  $read = function () use ($fp, &$log) {
    $out = '';
    while (($line = fgets($fp, 1024)) !== false) {
      $out .= $line;
      // Последняя строка ответа: код, затем пробел (а не дефис).
      if (strlen($line) >= 4 && $line[3] === ' ') break;
    }
    $log[] = '< ' . trim($out);
    return $out;
  };
  $say = function ($cmd, $hide = false) use ($fp, &$log) {
    fwrite($fp, $cmd . "\r\n");
    $log[] = '> ' . ($hide ? '***' : $cmd);
  };
  $code = function ($resp) { return (int)substr(trim($resp), 0, 3); };

  $fail = function ($msg) use ($fp, &$log) {
    @fclose($fp);
    pd_log('smtp', $msg . ' | ' . implode(' ; ', $log));
    return array(false, 'smtp: ' . $msg);
  };

  if ($code($read()) !== 220) return $fail('сервер не поздоровался');
  $say('EHLO playdisplay.com');
  $ehlo = $read();
  if ($code($ehlo) !== 250) return $fail('EHLO отклонён');

  if ($secure === 'tls') {
    $say('STARTTLS');
    if ($code($read()) !== 220) return $fail('STARTTLS отклонён');
    if (!@stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) return $fail('не удалось поднять TLS');
    $say('EHLO playdisplay.com');
    if ($code($read()) !== 250) return $fail('EHLO после TLS отклонён');
  }

  $say('AUTH LOGIN');
  if ($code($read()) !== 334) return $fail('AUTH LOGIN не поддержан');
  $say(base64_encode($s['user']), true);
  if ($code($read()) !== 334) return $fail('логин не принят');
  $say(base64_encode($s['pass']), true);
  if ($code($read()) !== 235) return $fail('пароль не принят');

  $say('MAIL FROM:<' . $from . '>');
  if ($code($read()) !== 250) return $fail('MAIL FROM отклонён (адрес должен принадлежать ящику)');
  $say('RCPT TO:<' . $to . '>');
  $rc = $code($read());
  if ($rc !== 250 && $rc !== 251) return $fail('RCPT TO отклонён');
  $say('DATA');
  if ($code($read()) !== 354) return $fail('DATA отклонён');

  // Точка в начале строки экранируется, иначе она оборвёт передачу письма.
  $data = implode("\r\n", $headers) . "\r\n\r\n" . $body;
  $data = preg_replace('/^\./m', '..', $data);
  fwrite($fp, $data . "\r\n.\r\n");
  if ($code($read()) !== 250) return $fail('сервер не принял письмо');

  $say('QUIT');
  @fclose($fp);
  return array(true, 'отправлено через ' . $s['host']);
}
