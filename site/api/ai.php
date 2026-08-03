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
require __DIR__ . '/lib/guard.php';
require __DIR__ . '/lib/llm.php';
require __DIR__ . '/lib/prompts.php';
require __DIR__ . '/lib/brief.php';
require __DIR__ . '/lib/mailer.php';

// Наружу отдаём только осмысленные ошибки: разбор внутренностей — в лог, не в браузер.
@ini_set('display_errors', '0');

// Если этот ai.php обслуживает сайт с другого домена (копия на зарубежном хосте под /en/
// и /pt/), браузер сначала спросит разрешение. Разрешаем только домены из конфига —
// открывать бэкенд всему интернету значит платить за чужие разговоры.
pd_cors();
function pd_cors() {
  $cfg = pd_config();
  $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
  $allowed = isset($cfg['cors_origins']) ? (array)$cfg['cors_origins'] : array();
  if ($origin !== '' && in_array($origin, $allowed, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Max-Age: 86400');
  }
}

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'POST') pd_fail('нужен POST', 405);

$cfg = pd_config();
$in = pd_body();
$action = isset($in['action']) ? $in['action'] : '';
// Файл приходит формой (multipart/form-data), а не JSON: в JSON его не положить,
// а base64 раздул бы тело на треть. Тогда action и sid лежат в $_POST.
if ($action === '' && isset($_POST['action'])) { $action = (string)$_POST['action']; $in = $_POST; }

switch ($action) {
  case 'ping':      pd_action_ping();  break;
  case 'challenge': pd_action_challenge(); break;   // выдать задачу-пропуск
  case 'human':     pd_action_human($in);  break;   // вторая ступень, если поведение странное
  case 'start': pd_action_start(); break;
  case 'turn':  pd_action_turn($in);  break;
  case 'brief': pd_action_brief($in); break;
  case 'file':  pd_action_file($in);  break;   // приложенный запрос или ТЗ
  case 'send':  pd_action_send($in);  break;
  default: pd_fail('неизвестное действие');
}

// ---------------------------------------------------------------- страж
/** Задача выдаётся заранее, пока человек читает первый экран: к нажатию она уже решена. */
function pd_action_challenge() {
  $c = pd_guard_issue();
  pd_json(array('ok' => true, 'challenge' => $c));
}

/**
 * Вторая ступень. Без аргументов выдаёт задание «поймать фазу», с ответом — проверяет
 * и возвращает пропуск, который клиент приложит к start.
 */
function pd_action_human($in) {
  if (!isset($in['hit'])) pd_json(array('ok' => true, 'task' => pd_guard_human_issue()));
  list($ok, $err) = pd_guard_human_check($in);
  if (!$ok) pd_json(array('ok' => false, 'error' => $err, 'task' => pd_guard_human_issue()), 200);
  pd_json(array('ok' => true, 'pass' => pd_guard_pass_new()));
}

// ---------------------------------------------------------------- ping
function pd_action_ping() {
  $cfg = pd_config();
  $in = pd_body();
  $lang = pd_lang_ok(isset($in['lang']) ? $in['lang'] : 'ru');
  // demo=true — модель работать не может (драйвер mock или нет ключа). Клиент показывает
  // честную плашку. Раньше здесь проверялся только драйвер, и с пустым ключом ассистент
  // обещал живой разговор, а выдавал вопросы из запаса — это и выглядело как «данные не те».
  $ready = pd_llm_ready($lang);
  $drv = pd_llm_driver($lang);
  $L = pd_langs();
  pd_json(array(
    'ok' => true,
    'live' => true,
    'demo' => !$ready,
    'why' => $ready ? '' : ($drv === 'mock'
      ? 'в api/config.php выбран драйвер mock'
      : 'драйвер ' . $drv . ' выбран, но ключ не заполнен'),
    // Код для распознавания речи отдаёт сервер: список поддерживаемых языков
    // живёт в одном месте (lib/prompts.php), а не дублируется в клиенте.
    'speech' => $L[$lang]['speech'],
    'lang' => $lang,
  ));
}

// ---------------------------------------------------------------- start
function pd_action_start() {
  $cfg = pd_config();
  $in = pd_body();

  // Страж стоит ПЕРЕД лимитом и до создания сессии: смысл в том, чтобы скрипт не мог
  // даже завести разговор, не заплатив вычислениями. Пропуск второй ступени принимается
  // вместо задачи — его выдали только что и тоже за подписью.
  if (empty($cfg['guard_off'])) {
    if (pd_guard_pass_ok($in)) {
      // уже подтвердил, что живой — пускаем
    } else {
      list($gok, $gerr, $needHuman) = pd_guard_check($in);
      if (!$gok) pd_fail($gerr, 403, array('challenge' => pd_guard_issue()));
      if ($needHuman) pd_json(array('ok' => false, 'need_human' => true, 'task' => pd_guard_human_issue()), 200);
    }
  }

  if (!pd_rate_ok()) pd_fail('слишком много сессий с этого адреса, попробуйте позже', 429);
  // Уборка по обещанным срокам. Здесь, а не в cron: на шаред-хостинге cron может быть
  // не настроен вовсе, а сроки хранения напечатаны на privacy.html и должны соблюдаться.
  pd_sweep();
  // Язык приходит из <html lang> страницы: у сайта под каждый язык своя папка (/en/, /pt/).
  $lang = pd_lang_ok(isset($in['lang']) ? $in['lang'] : 'ru');
  $L = pd_langs();
  $sess = array(
    'sid' => pd_sid_new(),
    'started' => date('c'),
    'ip' => substr(sha1(pd_ip() . '|pd'), 0, 12),   // хеш, а не адрес: для брифа адрес не нужен
    'ua' => pd_str(isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '', 200),
    'lang' => $lang,
    'llm' => pd_llm_driver($lang),
    'input' => '',
    'turns' => array(),        // [{q, a, words}]
    'words' => array(),        // всё, что уже висит на экране
    'card' => null,
    'sent' => false,
  );
  // Первый вопрос не спрашиваем у модели: он один и тот же, а лишний вызов — лишняя секунда ожидания.
  $sess['pending_q'] = $L[$lang]['first'];
  pd_sess_save($sess);
  pd_json(array('ok' => true, 'sid' => $sess['sid'], 'reply' => $sess['pending_q'],
    'sub' => $L[$lang]['sub'], 'speech' => $L[$lang]['speech']));
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

  // Стенограмма для модели: ответ человека → реплика ассистента.
  //
  // Реплику ассистента кладём В ТОМ ЖЕ ФОРМАТЕ, в котором просим отвечать, — то есть
  // строкой JSON, а не голым вопросом. Иначе модель видит в истории собственный «ответ»
  // обычной фразой и на следующем ходу копирует этот формат: разбор падает, разговор
  // сваливается на резервные вопросы. Ловилось так: первая реплика в сессии проходила
  // (истории ещё нет, формат берётся из системного промпта), а все следующие — нет.
  $messages = array();
  foreach ($sess['turns'] as $t) {
    if (!empty($t['a'])) $messages[] = array('role' => 'user', 'content' => $t['a']);
    if (!empty($t['next'])) {
      $said = array('words' => array(), 'reply' => $t['next'], 'sub' => isset($t['sub']) ? $t['sub'] : '', 'ready' => false);
      $messages[] = array('role' => 'assistant', 'content' => json_encode($said, JSON_UNESCAPED_UNICODE));
    }
  }
  $messages[] = array('role' => 'user', 'content' => $text);

  // Язык определяем по РЕЧИ, а не по странице: гость с /en/ вполне может рассказывать
  // по-русски. Голос копим по всей сессии, чтобы одна вставка на чужом языке
  // («Moscow City» посреди русского рассказа) не переключала разговор целиком.
  $seen = pd_detect_lang($text);
  if ($seen !== '') {
    if (!isset($sess['lang_votes']) || !is_array($sess['lang_votes'])) $sess['lang_votes'] = array();
    $sess['lang_votes'][$seen] = (isset($sess['lang_votes'][$seen]) ? (int)$sess['lang_votes'][$seen] : 0) + 1;
  }
  $lang = pd_talk_lang($sess);
  $langChanged = (isset($sess['talk_lang']) ? $sess['talk_lang'] : '') !== $lang;
  $sess['talk_lang'] = $lang;

  // Бюджет с запасом: короткий вопрос занимает 60–100 токенов, но у моделей с рассуждением
  // часть выхода уходит на размышление, и при тесном лимите ответ приходит пустым.
  $res = pd_llm(pd_prompt_turn($lang), $messages, 900, $lang);
  $data = $res['error'] ? null : pd_json_from_text($res['text']);

  // Модель может ответить просто вопросом, без JSON-обёртки. Это не ошибка: она
  // прислала ровно то, что нужно, — вопрос. Раньше такой ответ считался провалом,
  // и разговор без причины сваливался на резервные вопросы (поймано на боевом
  // 02.08.2026: «Какие экспонаты и интерактивные элементы вы хотели бы видеть?»).
  // Воевать за формат бессмысленно, когда содержание верное.
  if (!$data && !$res['error']) {
    $plain = pd_str($res['text'], 200);
    // Ровно одна короткая строка без следов JSON — принимаем как реплику.
    if ($plain !== '' && strpos($plain, '{') === false && strpos($plain, "\n") === false) {
      $data = array(
        'reply' => $plain,
        'sub' => '',
        // Нет вопросительного знака — модель, скорее всего, закончила расспрашивать.
        'ready' => strpos($plain, '?') === false,
      );
    }
  }

  $degraded = false;
  if (!$data) {
    // Разговор важнее аккуратности: даже если модель сорвалась, человек не должен
    // видеть тупик — задаём следующий вопрос из запаса и продолжаем слушать.
    // Но и молчать об этом нельзя: без пометки вопросы из запаса выглядят как живой разговор.
    $degraded = true;
    // Логируем ОБА случая. Раньше писалась только ошибка транспорта, а самый
    // неприятный случай — «модель ответила, но не тем форматом» — уходил в тишину,
    // и по логу нельзя было понять, почему разговор идёт по резервным вопросам.
    if ($res['error']) pd_log('turn', $res['error']);
    else pd_log('turn', 'ответ не разобран как JSON, первые 300 знаков: ' . pd_str($res['text'], 300));
    $data = array('words' => array(), 'reply' => pd_fallback_question(count($sess['turns']), $lang), 'sub' => '', 'ready' => count($sess['turns']) >= 4);
  }

  // ---- второй проход: смысловые объекты ----
  // Отдельным коротким вызовом, потому что одним ответом модель делала только первое
  // дело из двух — вопрос был, смыслы приходили пустыми со второй реплики.
  // Провал этого прохода разговор не ломает: будет просто меньше слов на экране.
  $rawWords = array();
  if (pd_len($text) >= 12) {          // на «да» и «ок» тратить вызов незачем
    $onScreen = $sess['words'] ? "\n\nУже на экране (не повторяй): " . implode(', ', array_slice($sess['words'], -18)) : '';
    $wres = pd_llm(pd_prompt_words($lang) . $onScreen,
      array(array('role' => 'user', 'content' => $text)), 400, $lang);
    $wdata = $wres['error'] ? null : pd_json_from_text($wres['text']);
    if (!empty($wdata['words']) && is_array($wdata['words'])) $rawWords = $wdata['words'];
    elseif ($wres['error']) pd_log('words', $wres['error']);
    $res['usage'] = array($res['usage'][0] + $wres['usage'][0], $res['usage'][1] + $wres['usage'][1]);
  }
  // Если основной проход всё же вернул смыслы (другая модель может и так уметь) — берём их.
  if (!$rawWords && !empty($data['words']) && is_array($data['words'])) $rawWords = $data['words'];

  $words = array();
  if ($rawWords) {
    foreach ($rawWords as $w) {
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
  if ($reply === '') $reply = pd_fallback_question(count($sess['turns']), $lang);

  $sess['turns'][] = array(
    'q' => isset($sess['pending_q']) ? $sess['pending_q'] : '',
    'a' => $text,
    'next' => $reply,
    // Подсказку храним, чтобы на следующем ходу вернуть модели её собственную
    // реплику целиком, а не наполовину.
    'sub' => pd_str(isset($data['sub']) ? $data['sub'] : '', 80),
    'at' => date('c'),
  );
  $sess['pending_q'] = $reply;
  $sess['usage'] = array(
    (isset($sess['usage'][0]) ? $sess['usage'][0] : 0) + $res['usage'][0],
    (isset($sess['usage'][1]) ? $sess['usage'][1] : 0) + $res['usage'][1],
  );
  pd_sess_save($sess);

  $L = pd_langs();
  pd_json(array(
    'ok' => true,
    'words' => $words,
    'reply' => $reply,
    'sub' => pd_str(isset($data['sub']) ? $data['sub'] : '', 80),
    'ready' => !empty($data['ready']) || count($sess['turns']) >= 8,
    'degraded' => $degraded,
    // Язык разговора разошёлся с языком страницы — говорим клиенту, чтобы он
    // переключил и распознавание речи: иначе русская речь на /en/ распознаётся
    // латиницей в кашу. Отдаём только при смене, чтобы не дёргать микрофон зря.
    'speech' => $langChanged ? $L[$lang]['speech'] : '',
    'lang' => $lang,
  ));
}

/** Запас вопросов на случай, если модель недоступна: разговор не должен упираться в стену. */
function pd_fallback_question($n, $lang = 'ru') {
  $all = array(
    'ru' => array(
      'Что должно случиться с человеком внутри?',
      'Кто ваш посетитель — кого вы видите первым?',
      'Где это будет? Площадка уже есть?',
      'К какой дате нужно открыться?',
      'Что ещё важно знать про проект?',
    ),
    'en' => array(
      'What should happen to a person inside?',
      'Who is your visitor — who do you picture first?',
      'Where will it be? Do you have the venue?',
      'By what date do you need to open?',
      'What else is important to know?',
    ),
    'pt' => array(
      'O que deve acontecer com a pessoa lá dentro?',
      'Quem é o seu visitante — quem você imagina primeiro?',
      'Onde vai ser? O espaço já existe?',
      'Para que data precisa abrir?',
      'O que mais é importante saber?',
    ),
  );
  $lang = isset($all[$lang]) ? $lang : 'ru';
  $q = $all[$lang];
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

  // Язык разговора, а не язык страницы: карточку человек увидит на том языке,
  // на котором рассказывал. Подробная часть письма всё равно придёт по-русски.
  $lang = pd_talk_lang($sess);
  $res = pd_llm(pd_prompt_brief($lang), $messages, 2600, $lang);
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

  // ---- второй проход: карточка на язык гостя ----
  // Бриф написан по-русски целиком — так его читает студия. Но верхнюю карточку
  // видит человек, и она должна быть на его языке. Русский заголовок сохраняем
  // ДО перевода: он идёт в тему письма, и студия ищет письма по-русски.
  $card['title_ru'] = $card['title'];
  if ($lang !== 'ru') {
    $ask = array('title' => $card['title'], 'idea' => $card['idea'],
      'who' => $card['who'], 'feel' => $card['feel'], 'tags' => $card['tags']);
    $tres = pd_llm(pd_prompt_card($lang),
      array(array('role' => 'user', 'content' => json_encode($ask, JSON_UNESCAPED_UNICODE))), 900, $lang);
    $tr = $tres['error'] ? null : pd_json_from_text($tres['text']);
    if ($tr) {
      // Поле берём только если перевод непустой: половина карточки на чужом языке
      // хуже, чем вся на русском — человек решит, что интерфейс сломался.
      foreach (array('title', 'idea', 'who', 'feel') as $k) {
        $v = pd_str(isset($tr[$k]) ? $tr[$k] : '', $k === 'idea' ? 900 : 300);
        if ($v !== '') $card[$k] = $v;
      }
      if (!empty($tr['tags']) && is_array($tr['tags']) && count($tr['tags']) === count($tags)) {
        $t2 = array();
        foreach ($tr['tags'] as $t) { $t = pd_str($t, 40); if ($t !== '') $t2[] = $t; }
        if (count($t2) === count($tags)) $card['tags'] = $t2;
      }
    } else {
      // Не перевелось — показываем русскую карточку. Это не тупик: смысл верный,
      // язык не тот. Молчать всё равно нельзя, поэтому пишем в лог.
      pd_log('card', $tres['error'] ? $tres['error'] : 'перевод карточки не разобран: ' . pd_str($tres['text'], 200));
    }
    $res['usage'] = array($res['usage'][0] + $tres['usage'][0], $res['usage'][1] + $tres['usage'][1]);
  }

  $sess['card'] = $card;
  $sess['usage'] = array(
    (isset($sess['usage'][0]) ? $sess['usage'][0] : 0) + $res['usage'][0],
    (isset($sess['usage'][1]) ? $sess['usage'][1] : 0) + $res['usage'][1],
  );
  pd_sess_save($sess);

  // На экран — только карточка концепции. Внутренняя часть брифа остаётся на сервере.
  // degraded говорит клиенту, что модель не сработала: показать это надо, иначе человек
  // примет заглушку за настоящий разбор своих слов.
  pd_json(array(
    'ok' => true,
    'degraded' => !empty($card['degraded']),
    'card' => array(
      'title' => $card['title'], 'idea' => $card['idea'],
      'who' => $card['who'], 'feel' => $card['feel'], 'tags' => $card['tags'],
    ),
  ));
}

// ---------------------------------------------------------------- file
/**
 * Что принимаем и чем это должно оказаться внутри. Расширение — только первый фильтр:
 * дальше смотрим настоящий тип содержимого, потому что назвать exe документом легко.
 * Офисные форматы 2007+ — это zip, и старый libmagic честно говорит про них
 * «application/zip»; отвергать за это нельзя.
 */
function pd_upload_types() {
  $zip = array('application/zip', 'application/octet-stream');
  return array(
    'pdf'  => array('application/pdf'),
    'doc'  => array('application/msword', 'application/vnd.ms-office', 'application/x-ole-storage', 'application/octet-stream'),
    'docx' => array_merge(array('application/vnd.openxmlformats-officedocument.wordprocessingml.document'), $zip),
    'ppt'  => array('application/vnd.ms-powerpoint', 'application/vnd.ms-office', 'application/x-ole-storage', 'application/octet-stream'),
    'pptx' => array_merge(array('application/vnd.openxmlformats-officedocument.presentationml.presentation'), $zip),
    'xls'  => array('application/vnd.ms-excel', 'application/vnd.ms-office', 'application/x-ole-storage', 'application/octet-stream'),
    'xlsx' => array_merge(array('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), $zip),
    'png'  => array('image/png'),
    'jpg'  => array('image/jpeg'),
    'jpeg' => array('image/jpeg'),
    'webp' => array('image/webp'),
  );
}

/** Ошибки самой загрузки — человеческими словами, а не кодом PHP. */
function pd_upload_error($code, $maxMb) {
  switch ($code) {
    case UPLOAD_ERR_INI_SIZE:
    case UPLOAD_ERR_FORM_SIZE:  return 'файл больше ' . $maxMb . ' МБ — пришлите ссылкой на облако';
    case UPLOAD_ERR_PARTIAL:    return 'файл дошёл не полностью — попробуйте ещё раз';
    case UPLOAD_ERR_NO_FILE:    return 'файл не выбран';
    case UPLOAD_ERR_NO_TMP_DIR:
    case UPLOAD_ERR_CANT_WRITE: return 'сервер не смог сохранить файл — пришлите ссылкой';
    default:                    return 'файл не принят';
  }
}

/**
 * Приём приложенного файла. Идёт ПОСЛЕ согласия и ТОЛЬКО в живой сессии, поэтому
 * стража здесь нет: до этой точки скрипт без разговора и брифа не доберётся.
 *
 * Файл никогда не отдаётся с сервера обратно: uploads/ закрыт .htaccess, имя на диске
 * своё, случайное, а имя из формы к файловой системе вообще не подпускается.
 */
function pd_action_file($in) {
  $cfg = pd_config();
  $sess = pd_sess_load(isset($in['sid']) ? $in['sid'] : '');
  if (!$sess) pd_fail('сессия не найдена, начните заново', 410);
  if (!empty($sess['sent'])) pd_fail('бриф уже отправлен');
  if (empty($in['agree'])) pd_fail('нужно согласие на обработку данных');

  $maxMb = (float)$cfg['upload_max_mb'];
  $maxFiles = (int)$cfg['upload_max_files'];
  $files = (isset($sess['files']) && is_array($sess['files'])) ? $sess['files'] : array();
  if (count($files) >= $maxFiles) pd_fail('больше ' . $maxFiles . ' файлов не нужно — остальное пришлите ссылкой');

  if (empty($_FILES['file']) || !isset($_FILES['file']['error'])) pd_fail('файл не пришёл');
  $f = $_FILES['file'];
  if ((int)$f['error'] !== UPLOAD_ERR_OK) pd_fail(pd_upload_error((int)$f['error'], $maxMb));
  if (!is_uploaded_file($f['tmp_name'])) pd_fail('файл не пришёл');
  $size = (int)$f['size'];
  if ($size <= 0) pd_fail('файл пустой');
  if ($size > $maxMb * 1048576) pd_fail('файл больше ' . $maxMb . ' МБ — пришлите ссылкой на облако');

  // Имя из формы чистим, но на диск не кладём: оно нужно только чтобы подписать
  // вложение в письме. Слэши и управляющие символы убираем сразу.
  $orig = pd_str(isset($f['name']) ? $f['name'] : 'file', 120);
  $orig = preg_replace('~[\\\\/\x00-\x1F]~u', '', $orig);
  if ($orig === '') $orig = 'file';
  $ext = pd_lower(pathinfo($orig, PATHINFO_EXTENSION));
  $allow = pd_upload_types();
  if (!isset($allow[$ext])) pd_fail('такой файл не примем: pdf, word, powerpoint, excel или картинка');

  // Расширению верить нельзя. Если finfo на хостинге нет, остаёмся на белом списке
  // расширений: файл всё равно не отдаётся наружу и не исполняется.
  if (function_exists('finfo_open')) {
    $fi = @finfo_open(FILEINFO_MIME_TYPE);
    $mime = $fi ? (string)@finfo_file($fi, $f['tmp_name']) : '';
    if ($fi) @finfo_close($fi);
    if ($mime !== '' && !in_array($mime, $allow[$ext], true)) {
      pd_log('file', 'отклонён .' . $ext . ', внутри ' . $mime);
      pd_fail('содержимое файла не похоже на .' . $ext);
    }
  }

  $dir = pd_dir('uploads') . '/' . $sess['sid'];
  if (!is_dir($dir) && !@mkdir($dir, 0775, true)) pd_fail('сервер не смог сохранить файл', 500);
  $safe = bin2hex(function_exists('random_bytes') ? random_bytes(6) : pack('N', mt_rand())) . '.' . $ext;
  if (!@move_uploaded_file($f['tmp_name'], $dir . '/' . $safe)) pd_fail('сервер не смог сохранить файл', 500);

  $files[] = array('name' => $orig, 'size' => $size, 'file' => $safe, 'mime' => $allow[$ext][0]);
  $sess['files'] = $files;
  pd_sess_save($sess);

  $out = array();
  foreach ($files as $fl) $out[] = array('name' => $fl['name'], 'size' => $fl['size']);
  pd_json(array('ok' => true, 'files' => $out));
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

  // Каналы связи приходят списком из отмеченных кнопок. Берём только знакомые названия:
  // это ярлыки нашего же интерфейса, произвольный текст здесь не нужен.
  $known = array('Telegram', 'WhatsApp', 'Звонок', 'Почта');
  $channels = array();
  if (!empty($in['channels']) && is_array($in['channels'])) {
    foreach ($in['channels'] as $ch) if (in_array($ch, $known, true) && !in_array($ch, $channels, true)) $channels[] = $ch;
  }

  // Ссылка на облако — второй путь для тех, у кого материалы не в одном файле.
  // Схему дописываем сами: люди копируют адрес без «https://» постоянно.
  $link = pd_str(isset($in['link']) ? $in['link'] : '', 400);
  if ($link !== '') {
    if (!preg_match('~^https?://~i', $link)) $link = 'https://' . $link;
    if (!filter_var($link, FILTER_VALIDATE_URL)) pd_fail('ссылка выглядит неверно — проверьте её');
  }

  $c = array('name' => $name, 'contact' => $contact, 'company' => $company,
    'channels' => $channels, 'link' => $link);
  $sess['contact'] = $c;

  $card = $sess['card'];
  $subjTitle = !empty($card['title_ru']) ? $card['title_ru'] : $card['title'];
  $subj = 'Бриф с сайта: ' . ($subjTitle !== '' ? $subjTitle : 'запрос без названия');
  $html = pd_brief_html($card, $c, $sess);            // логотип ссылкой на вложение
  $preview = pd_brief_html($card, $c, $sess, true);   // логотип встроен: для файла на диске
  $textVer = pd_brief_text($card, $c, $sess);
  $replyTo = filter_var($contact, FILTER_VALIDATE_EMAIL) ? $contact : '';

  // Вложения собираем прямо перед отправкой: файла могло и не остаться, если уборка
  // унесла брошенную загрузку, а падать из-за этого письму незачем.
  $attach = array();
  $upDir = PD_DIR . '/uploads/' . $sess['sid'];
  foreach ((isset($sess['files']) && is_array($sess['files'])) ? $sess['files'] : array() as $fl) {
    $p = $upDir . '/' . (isset($fl['file']) ? $fl['file'] : '');
    if (isset($fl['file']) && is_file($p)) {
      $attach[] = array('path' => $p, 'name' => $fl['name'],
        'mime' => isset($fl['mime']) ? $fl['mime'] : 'application/octet-stream');
    }
  }

  list($ok, $info) = pd_send_mail($subj, $html, $textVer, $replyTo, $preview, $attach);

  // Файл сделал свою работу — уехал в письмо. Держать его у себя мы не обещали
  // и не будем: на privacy.html так и написано, «удаляется сразу после отправки».
  if ($ok && $attach) pd_rmdir_files($upDir);

  $sess['sent'] = $ok;
  $sess['sent_info'] = $info;
  $sess['sent_at'] = date('c');
  if (empty($cfg['keep_transcripts'])) { $sess['turns'] = array(); $sess['card'] = null; }
  pd_sess_save($sess);

  if (!$ok) {
    pd_log('send', $info);
    // Копию в outbox кладём всегда: бриф не должен потеряться из-за почтового сервера.
    pd_mail_file($subj, array('Subject: ' . $subj), $textVer, $preview);
    pd_fail('письмо не ушло: ' . $info, 502);
  }
  pd_json(array('ok' => true, 'info' => $info));
}
