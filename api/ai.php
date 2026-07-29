<?php
/**
 * AI-ассистент PlayDisplay: разговор с посетителем → бриф → письмо Андрею.
 *
 * Единая точка входа. Тело запроса — JSON, поле action:
 *   ping   →  {ok, live}                          проверка, что бэкенд есть (клиент зовёт при открытии)
 *   start  →  {ok, sid, reply, sub}               начало сессии
 *   turn   →  {ok, words[], reply, sub, ready}    очередная реплика человека
 *   brief  →  {ok, card}                          сборка брифа
 *   send   →  {ok}                                отправка письма
 *
 * Ключей в этом файле нет — см. config.sample.php.
 */

require __DIR__ . '/lib/util.php';
require __DIR__ . '/lib/llm.php';
require __DIR__ . '/lib/prompts.php';
require __DIR__ . '/lib/brief.php';
require __DIR__ . '/lib/mailer.php';

// Наружу отдаём только осмысленные ошибки: разбор внутренностей — в лог, не в браузер.
@ini_set('display_errors', '0');

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'POST') pd_fail('нужен POST', 405);

$cfg = pd_config();
$in = pd_body();
$action = isset($in['action']) ? $in['action'] : '';

switch ($action) {
  case 'ping':  pd_action_ping();  break;
  case 'start': pd_action_start(); break;
  case 'turn':  pd_action_turn($in);  break;
  case 'brief': pd_action_brief($in); break;
  case 'send':  pd_action_send($in);  break;
  default: pd_fail('неизвестное действие');
}

// ---------------------------------------------------------------- ping
function pd_action_ping() {
  $cfg = pd_config();
  pd_json(array(
    'ok' => true,
    'live' => true,
    // demo=true — модель не подключена: клиент показывает об этом честную плашку
    'demo' => $cfg['llm'] === 'mock',
  ));
}

// ---------------------------------------------------------------- start
function pd_action_start() {
  if (!pd_rate_ok()) pd_fail('слишком много сессий с этого адреса, попробуйте позже', 429);
  $cfg = pd_config();
  $sess = array(
    'sid' => pd_sid_new(),
    'started' => date('c'),
    'ip' => substr(sha1(pd_ip() . '|pd'), 0, 12),   // хеш, а не адрес: для брифа адрес не нужен
    'ua' => pd_str(isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '', 200),
    'llm' => $cfg['llm'],
    'input' => '',
    'turns' => array(),        // [{q, a, words}]
    'words' => array(),        // всё, что уже висит на экране
    'card' => null,
    'sent' => false,
  );
  // Первый вопрос не спрашиваем у модели: он один и тот же, а лишний вызов — лишняя секунда ожидания.
  $sess['pending_q'] = 'Расскажите про вашу идею.';
  pd_sess_save($sess);
  pd_json(array('ok' => true, 'sid' => $sess['sid'], 'reply' => $sess['pending_q'], 'sub' => 'Мы будем собирать основные смыслы.'));
}

// ---------------------------------------------------------------- turn
function pd_action_turn($in) {
  $cfg = pd_config();
  $sess = pd_sess_load(isset($in['sid']) ? $in['sid'] : '');
  if (!$sess) pd_fail('сессия не найдена, начните заново', 410);
  if (count($sess['turns']) >= (int)$cfg['limit_turns_per_session']) pd_fail('разговор слишком длинный, соберём бриф по сказанному', 409, array('ready' => true));

  $text = pd_str(isset($in['text']) ? $in['text'] : '', (int)$cfg['limit_chars_per_turn']);
  if ($text === '') pd_fail('пустая реплика');
  if (!empty($in['input']) && in_array($in['input'], array('voice', 'text'), true)) {
    // Если человек хоть раз печатал — в брифе честнее написать «текстом».
    $sess['input'] = ($sess['input'] === '' || $sess['input'] === $in['input']) ? $in['input'] : 'смешанно';
  }

  // Стенограмма для модели: вопрос ассистента → ответ человека.
  $messages = array();
  foreach ($sess['turns'] as $t) {
    if (!empty($t['a'])) $messages[] = array('role' => 'user', 'content' => $t['a']);
    if (!empty($t['next'])) $messages[] = array('role' => 'assistant', 'content' => $t['next']);
  }
  $messages[] = array('role' => 'user', 'content' => $text);

  // Подсказываем модели, что уже на экране — чтобы не повторяла смыслы.
  $onScreen = $sess['words'] ? "\n\nУже на экране: " . implode(', ', array_slice($sess['words'], -18)) : '';

  $res = pd_llm(pd_prompt_turn() . $onScreen, $messages, 500);
  $data = $res['error'] ? null : pd_json_from_text($res['text']);

  if (!$data) {
    // Разговор важнее аккуратности: даже если модель сорвалась, человек не должен
    // видеть тупик — задаём следующий вопрос из запаса и продолжаем слушать.
    if ($res['error']) pd_log('turn', $res['error']);
    $data = array('words' => array(), 'reply' => pd_fallback_question(count($sess['turns'])), 'sub' => '', 'ready' => count($sess['turns']) >= 4);
  }

  $words = array();
  if (!empty($data['words']) && is_array($data['words'])) {
    foreach ($data['words'] as $w) {
      $t = pd_str(isset($w['t']) ? $w['t'] : '', 40);
      if ($t === '' || in_array($t, $sess['words'], true)) continue;
      $weight = isset($w['w']) ? (float)$w['w'] : 1.0;
      if ($weight < 0.8) $weight = 0.8;
      if ($weight > 1.4) $weight = 1.4;
      $words[] = array('t' => $t, 'w' => round($weight, 2), 'key' => !empty($w['key']));
      $sess['words'][] = $t;
      if (count($words) >= 4) break;
    }
  }

  $reply = pd_str(isset($data['reply']) ? $data['reply'] : '', 200);
  if ($reply === '') $reply = pd_fallback_question(count($sess['turns']));

  $sess['turns'][] = array(
    'q' => isset($sess['pending_q']) ? $sess['pending_q'] : '',
    'a' => $text,
    'next' => $reply,
    'at' => date('c'),
  );
  $sess['pending_q'] = $reply;
  $sess['usage'] = array(
    (isset($sess['usage'][0]) ? $sess['usage'][0] : 0) + $res['usage'][0],
    (isset($sess['usage'][1]) ? $sess['usage'][1] : 0) + $res['usage'][1],
  );
  pd_sess_save($sess);

  pd_json(array(
    'ok' => true,
    'words' => $words,
    'reply' => $reply,
    'sub' => pd_str(isset($data['sub']) ? $data['sub'] : '', 80),
    'ready' => !empty($data['ready']) || count($sess['turns']) >= 8,
  ));
}

/** Запас вопросов на случай, если модель недоступна: разговор не должен упираться в стену. */
function pd_fallback_question($n) {
  $q = array(
    'Что должно случиться с человеком внутри?',
    'Кто ваш посетитель — кого вы видите первым?',
    'Где это будет? Площадка уже есть?',
    'К какой дате нужно открыться?',
    'Что ещё важно знать про проект?',
  );
  return $q[min($n, count($q) - 1)];
}

// ---------------------------------------------------------------- brief
function pd_action_brief($in) {
  $sess = pd_sess_load(isset($in['sid']) ? $in['sid'] : '');
  if (!$sess) pd_fail('сессия не найдена, начните заново', 410);
  if (!$sess['turns']) pd_fail('пока нечего собирать: расскажите про идею');

  $talk = array();
  foreach ($sess['turns'] as $t) {
    if (!empty($t['q'])) $talk[] = 'Ассистент: ' . $t['q'];
    if (!empty($t['a'])) $talk[] = 'Человек: ' . $t['a'];
  }
  $messages = array(array('role' => 'user', 'content' => "Стенограмма разговора:\n\n" . implode("\n", $talk)));

  $res = pd_llm(pd_prompt_brief(), $messages, 1600);
  $card = $res['error'] ? null : pd_json_from_text($res['text']);

  if (!$card) {
    if ($res['error']) pd_log('brief', $res['error']);
    // Бриф всё равно уйдёт: без разбора моделью, но со стенограммой — Андрей прочитает сам.
    $said = array();
    foreach ($sess['turns'] as $t) if (!empty($t['a'])) $said[] = $t['a'];
    $card = array(
      'title' => 'Запрос с сайта (модель не разобрала — стенограмма ниже)',
      'idea' => pd_str(implode(' ', $said), 900),
      'who' => 'не обсуждали', 'feel' => 'не обсуждали',
      'tags' => array('Разбор не удался'),
      'brief' => array('task' => pd_str(implode(' ', $said), 2000)),
      'open_questions' => array('Прочитать стенограмму целиком: разбор моделью не удался'),
      'quotes' => array_slice($said, 0, 2),
      'heat' => 'warm',
      'degraded' => true,
    );
  }

  // Чистим то, что уйдёт и в письмо, и на экран.
  $card['title'] = pd_str(isset($card['title']) ? $card['title'] : '', 160);
  $card['idea']  = pd_str(isset($card['idea']) ? $card['idea'] : '', 900);
  $card['who']   = pd_str(isset($card['who']) ? $card['who'] : '', 300);
  $card['feel']  = pd_str(isset($card['feel']) ? $card['feel'] : '', 300);
  $tags = array();
  if (!empty($card['tags']) && is_array($card['tags'])) {
    foreach (array_slice($card['tags'], 0, 7) as $t) { $t = pd_str($t, 40); if ($t !== '') $tags[] = $t; }
  }
  $card['tags'] = $tags;

  $sess['card'] = $card;
  $sess['usage'] = array(
    (isset($sess['usage'][0]) ? $sess['usage'][0] : 0) + $res['usage'][0],
    (isset($sess['usage'][1]) ? $sess['usage'][1] : 0) + $res['usage'][1],
  );
  pd_sess_save($sess);

  // На экран — только карточка концепции. Внутренняя часть брифа остаётся на сервере.
  pd_json(array('ok' => true, 'card' => array(
    'title' => $card['title'], 'idea' => $card['idea'],
    'who' => $card['who'], 'feel' => $card['feel'], 'tags' => $card['tags'],
  )));
}

// ---------------------------------------------------------------- send
function pd_action_send($in) {
  $cfg = pd_config();
  $sess = pd_sess_load(isset($in['sid']) ? $in['sid'] : '');
  if (!$sess) pd_fail('сессия не найдена, начните заново', 410);
  if (empty($sess['card'])) pd_fail('бриф ещё не собран');
  if (!empty($sess['sent'])) pd_json(array('ok' => true, 'already' => true));   // двойной клик не шлёт два письма

  $name = pd_str(isset($in['name']) ? $in['name'] : '', 120);
  $contact = pd_str(isset($in['contact']) ? $in['contact'] : '', 160);
  $company = pd_str(isset($in['company']) ? $in['company'] : '', 160);
  if ($name === '' || $contact === '') pd_fail('нужны имя и способ связи');
  if (empty($in['agree'])) pd_fail('нужно согласие на отправку');
  // Простейшая ловушка для ботов: в честном контакте есть либо @, либо цифры.
  if (strpos($contact, '@') === false && !preg_match('/\d/', $contact)) pd_fail('укажите email или телефон');

  $c = array('name' => $name, 'contact' => $contact, 'company' => $company);
  $sess['contact'] = $c;

  $card = $sess['card'];
  $subj = 'Бриф с сайта: ' . ($card['title'] !== '' ? $card['title'] : 'запрос без названия');
  $html = pd_brief_html($card, $c, $sess);
  $textVer = pd_brief_text($card, $c, $sess);
  $replyTo = filter_var($contact, FILTER_VALIDATE_EMAIL) ? $contact : '';

  list($ok, $info) = pd_send_mail($subj, $html, $textVer, $replyTo);

  $sess['sent'] = $ok;
  $sess['sent_info'] = $info;
  $sess['sent_at'] = date('c');
  if (empty($cfg['keep_transcripts'])) { $sess['turns'] = array(); $sess['card'] = null; }
  pd_sess_save($sess);

  if (!$ok) {
    pd_log('send', $info);
    // Копию в outbox кладём всегда: бриф не должен потеряться из-за почтового сервера.
    pd_mail_file($subj, array('Subject: ' . $subj), $textVer, $html);
    pd_fail('письмо не ушло: ' . $info, 502);
  }
  pd_json(array('ok' => true, 'info' => $info));
}
