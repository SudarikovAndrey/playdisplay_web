<?php
/* ЗАКРЫТАЯ КОНЦЕПЦИЯ «МУЗЕЙ МЯЧА». Доступ только по прямой ссылке и по паролю.
 *
 * Почему проверка на сервере, а не на JS: при клиентской проверке вся вёрстка лежит
 * в исходнике страницы и открывается через «просмотр кода» без всякого пароля.
 * Здесь сама книга лежит в private/, куда веб-сервер не пускает вовсе (private/.htaccess),
 * и отдаётся только этим файлом — после успешной проверки.
 *
 * Пароля в файлах нет: хранится соль и отпечаток PBKDF2-SHA256 (200 000 итераций).
 * Сменить пароль = пересчитать отпечаток и заменить две строки ниже.
 */
declare(strict_types=1);

const SALT   = '94cffc72986e51831c437bd006e46cf8';
const HASH   = '5e1a7f8aff3a42961161892a35d231f141a33cca41c7ab0de57582b96ef160b6';
const ITER   = 200000;
const COOKIE = 'pd_ball';

// поисковикам и AI-краулерам эту страницу видеть не нужно ни в каком виде
header('X-Robots-Tag: noindex, nofollow, noarchive, nosnippet');
header('Referrer-Policy: no-referrer');
header('Cache-Control: private, no-store');

function fingerprint(string $pwd): string {
    return hash_pbkdf2('sha256', $pwd, SALT, ITER, 64);
}
// метка входа в cookie: производная от отпечатка. Подделать, не зная пароля, нельзя
function ticket(): string { return hash('sha256', HASH . '|' . SALT); }

$ok  = isset($_COOKIE[COOKIE]) && hash_equals(ticket(), (string) $_COOKIE[COOKIE]);
$err = '';

if (!$ok && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    usleep(400000);                       // пауза на каждой попытке: перебор становится бессмысленным
    $pwd = (string) ($_POST['p'] ?? '');
    if ($pwd !== '' && hash_equals(HASH, fingerprint($pwd))) {
        setcookie(COOKIE, ticket(), [
            'expires'  => time() + 60 * 60 * 24 * 30,   // месяц: заказчик вернётся не раз
            'path'     => '/ball/',
            'httponly' => true,
            'samesite' => 'Lax',
            'secure'   => ($_SERVER['HTTPS'] ?? '') !== '',
        ]);
        header('Location: ' . strtok((string) $_SERVER['REQUEST_URI'], '?'));
        exit;
    }
    $err = 'Пароль не подошёл';
}

if ($ok) {
    $book = __DIR__ . '/private/page.html';
    if (!is_readable($book)) { http_response_code(500); exit('Книга не найдена'); }
    header('Content-Type: text/html; charset=utf-8');
    readfile($book);
    exit;
}
?><!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="theme-color" content="#06070a">
<title>Музей Мяча · доступ по паролю</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@600;800&family=Roboto+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #06070a; color: #eef7f8; font: 400 15px/1.6 'Roboto Mono', monospace; padding: 24px; }
  /* дальний свет за карточкой — та же атмосфера, что у сайта */
  body::before { content: ''; position: fixed; inset: -20%; pointer-events: none;
    background: radial-gradient(60% 50% at 50% 40%, rgba(43,224,198,.10), transparent 70%); }
  .gate { position: relative; width: 100%; max-width: 392px; padding: 38px 34px 34px;
    background: rgba(13,20,26,.72); border: 1px solid rgba(159,180,200,.16);
    backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
  .k { font: 500 10.5px 'Roboto Mono', monospace; letter-spacing: .26em; text-transform: uppercase;
    color: #2be0c6; display: flex; align-items: center; gap: 9px; margin-bottom: 16px; }
  .k::before { content: ''; width: 26px; height: 1px; background: #2be0c6; }
  h1 { font: 800 26px/1.15 'Unbounded', system-ui, sans-serif; letter-spacing: -.02em; margin-bottom: 10px; }
  p.sub { color: #9fb4c8; font-size: 13.5px; margin-bottom: 26px; }
  label { display: block; font-size: 11px; letter-spacing: .16em; text-transform: uppercase;
    color: #9fb4c8; margin-bottom: 8px; }
  input { width: 100%; padding: 13px 14px; background: rgba(4,12,16,.8); color: #eef7f8;
    border: 1px solid rgba(159,180,200,.28); font: 400 15px 'Roboto Mono', monospace; }
  input:focus { outline: none; border-color: #2be0c6; }
  button { width: 100%; margin-top: 14px; padding: 14px; cursor: pointer;
    font: 600 12px 'Roboto Mono', monospace; letter-spacing: .2em; text-transform: uppercase;
    color: #06131a; background: #2be0c6; border: none; transition: box-shadow .25s; }
  button:hover { box-shadow: 0 8px 26px rgba(43,224,198,.32); }
  .err { margin-top: 14px; font-size: 12.5px; color: #ff8a6a; }
  .foot { margin-top: 26px; font-size: 11.5px; color: #64798c; }
  .foot a { color: #9fb4c8; text-decoration: none; border-bottom: 1px solid rgba(159,180,200,.3); }
</style>
</head>
<body>
  <main class="gate">
    <div class="k">playdisplay</div>
    <h1>Музей Мяча</h1>
    <p class="sub">Концепция проекта. Страница закрыта — введите пароль из письма.</p>
    <form method="post" autocomplete="off">
      <label for="p">Пароль</label>
      <input id="p" name="p" type="password" autofocus required>
      <button type="submit">Открыть</button>
    </form>
    <?php if ($err !== ''): ?><div class="err"><?= htmlspecialchars($err, ENT_QUOTES, 'UTF-8') ?></div><?php endif; ?>
    <p class="foot">Нет пароля? Напишите нам: <a href="mailto:info@playdisplay.com">info@playdisplay.com</a></p>
  </main>
</body>
</html>
