<?php
/**
 * Проверка настроек: открыть в браузере — /api/selftest.php
 * Гоняет весь путь без интерфейса: конфиг → модель → бриф → письмо.
 * На боевом сервере страница закрыта через api/.htaccess.
 */

require __DIR__ . '/lib/util.php';
require __DIR__ . '/lib/llm.php';
require __DIR__ . '/lib/prompts.php';
require __DIR__ . '/lib/brief.php';
require __DIR__ . '/lib/mailer.php';

header('Content-Type: text/html; charset=utf-8');
$cfg = pd_config();
$doSend = isset($_GET['send']);
$rows = array();
function row(&$rows, $name, $ok, $note = '') { $rows[] = array($name, $ok, $note); }

// 1. окружение
row($rows, 'PHP ' . PHP_VERSION, version_compare(PHP_VERSION, '5.6', '>='), version_compare(PHP_VERSION, '7.0', '>=') ? '' : 'старая версия, лучше 7.4+');
row($rows, 'json', function_exists('json_encode'), '');
row($rows, 'mbstring', function_exists('mb_substr'), function_exists('mb_substr') ? '' : 'работает и без неё, но с русским аккуратнее с ней');
row($rows, 'curl или потоки', function_exists('curl_init') || ini_get('allow_url_fopen'), function_exists('curl_init') ? 'curl' : 'потоки');

// 2. конфиг
$cfgPaths = array(getenv('PD_AI_CONFIG'), dirname(dirname(PD_DIR)) . '/pd-ai-config.php', PD_DIR . '/config.php');
$cfgFound = '';
foreach ($cfgPaths as $p) if ($p && is_file($p)) { $cfgFound = $p; break; }
row($rows, 'файл конфигурации', $cfgFound !== '', $cfgFound !== '' ? $cfgFound : 'не найден — работают значения по умолчанию (llm=mock, mailer=file)');
row($rows, 'драйвер модели: ' . $cfg['llm'], true, $cfg['llm'] === 'mock' ? 'демо-режим, сеть не используется' : '');
row($rows, 'драйвер почты: ' . $cfg['mailer'], true, 'адресат: ' . $cfg['mail_to']);

// 3. права на запись
foreach (array('sessions', 'outbox') as $d) {
  $path = pd_dir($d);
  $ok = is_dir($path) && is_writable($path);
  row($rows, 'запись в api/' . $d, $ok, $ok ? '' : 'нет прав: chmod 775 ' . $path);
}

// 4. контекст студии из данных сайта
$ctx = pd_studio_context();
row($rows, 'кейсы студии в промпте', strpos($ctx, '—') !== false, substr_count($ctx, "\n— ") . ' проектов подтянуто из data/projects.json');

// 5. живой вызов модели
$t0 = microtime(true);
$res = pd_llm(pd_prompt_turn(), array(array('role' => 'user', 'content' =>
  'Хотим сделать интерактивный музей энергетики в Красноярске, чтобы школьники понимали, откуда берётся электричество.')), 500);
$ms = round((microtime(true) - $t0) * 1000);
$turn = $res['error'] ? null : pd_json_from_text($res['text']);
row($rows, 'ответ модели на реплику', $turn !== null && !empty($turn['reply']),
  $res['error'] ? $res['error'] : ($ms . ' мс · вопрос: «' . (isset($turn['reply']) ? $turn['reply'] : '—') . '» · смыслов: ' . (isset($turn['words']) ? count($turn['words']) : 0)));

// 6. сборка брифа
$res2 = pd_llm(pd_prompt_brief(), array(array('role' => 'user', 'content' =>
  "Стенограмма разговора:\n\nАссистент: Расскажите про вашу идею.\n"
  . "Человек: Хотим интерактивный музей энергетики в Красноярске для школьников, помещение 600 метров в старом здании ГЭС.\n"
  . "Ассистент: Что должно случиться с человеком внутри?\n"
  . "Человек: Чтобы ребёнок понял, что энергия — это его выбор, а не абстракция. Открыться надо к сентябрю.")), 1600);
$card = $res2['error'] ? null : pd_json_from_text($res2['text']);
row($rows, 'сборка брифа', $card !== null && !empty($card['title']),
  $res2['error'] ? $res2['error'] : 'заголовок: «' . (isset($card['title']) ? $card['title'] : '—') . '»');

// 7. письмо
$mailNote = 'не отправляли';
$mailOk = null;
if ($card) {
  $sess = array('sid' => 'selftest', 'input' => 'text', 'llm' => $cfg['llm'], 'turns' => array(
    array('q' => 'Расскажите про вашу идею.', 'a' => 'Проверка настроек ассистента.'),
  ));
  $contact = array('name' => 'Проверка', 'contact' => 'test@example.com', 'company' => 'PlayDisplay');
  $html = pd_brief_html($card, $contact, $sess);
  $preview = pd_dir('outbox') . '/preview.html';
  @file_put_contents($preview, $html);
  if ($doSend) {
    list($mailOk, $mailNote) = pd_send_mail('[проверка] Бриф с сайта: ' . $card['title'], $html, pd_brief_text($card, $contact, $sess));
  } else {
    $mailNote = 'вёрстка письма собрана. Отправить по-настоящему: <a href="?send=1">?send=1</a>';
    $mailOk = true;
  }
}
row($rows, 'письмо', $mailOk === null ? false : $mailOk, $mailNote);

$fails = 0;
foreach ($rows as $r) if (!$r[1]) $fails++;
?><!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Проверка AI-ассистента</title>
<style>
  body { background:#0b1418; color:#e9f4f6; font:400 15px/1.6 -apple-system,Segoe UI,Roboto,sans-serif; margin:0; padding:40px 24px; }
  .w { max-width:860px; margin:0 auto; }
  h1 { font:700 26px/1.2 Georgia,serif; margin:0 0 6px; }
  .sub { color:#8b979d; font-size:13px; margin-bottom:28px; }
  table { width:100%; border-collapse:collapse; }
  td { padding:12px 10px; border-bottom:1px solid #1d2b31; vertical-align:top; }
  td.s { width:34px; font-size:17px; }
  td.n { width:230px; font-weight:600; }
  td.d { color:#9fb4c8; font-size:13.5px; word-break:break-word; }
  .ok { color:#2be0c6; } .no { color:#ff8a5c; }
  .tot { margin-top:26px; padding:16px 18px; border-left:3px solid #2be0c6; background:#101e25; font-size:14px; }
  .tot.bad { border-color:#ff8a5c; }
  a { color:#2be0c6; }
  pre { background:#101e25; padding:14px; overflow:auto; font-size:12px; color:#9fb4c8; }
</style></head><body><div class="w">
<h1>Проверка AI-ассистента</h1>
<div class="sub">Драйвер модели: <b><?= pd_esc($cfg['llm']) ?></b> · почта: <b><?= pd_esc($cfg['mailer']) ?></b> → <?= pd_esc($cfg['mail_to']) ?></div>
<table>
<?php foreach ($rows as $r): ?>
  <tr><td class="s <?= $r[1] ? 'ok' : 'no' ?>"><?= $r[1] ? '✓' : '✕' ?></td>
      <td class="n"><?= pd_esc($r[0]) ?></td>
      <td class="d"><?= $r[2] ?></td></tr>
<?php endforeach; ?>
</table>
<div class="tot <?= $fails ? 'bad' : '' ?>">
  <?php if ($fails): ?>
    Не сошлось пунктов: <b><?= $fails ?></b>. Пока они красные, ассистент работает в аварийном режиме
    (вопросы из запаса, письмо в файл) — но всё равно работает.
  <?php else: ?>
    Всё сходится. Вёрстка последнего письма: <a href="outbox/preview.html">api/outbox/preview.html</a>
    (через веб она закрыта — откройте файл с диска).
  <?php endif; ?>
</div>
<?php if ($card): ?>
  <h2 style="font:700 18px Georgia,serif;margin:30px 0 10px;">Что модель собрала из тестовой стенограммы</h2>
  <pre><?= pd_esc(json_encode($card, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)) ?></pre>
<?php endif; ?>
</div></body></html>
