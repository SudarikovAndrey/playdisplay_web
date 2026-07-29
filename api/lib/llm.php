<?php
/**
 * Драйверы языковых моделей. Наружу — одна функция pd_llm($system, $messages, $maxTokens),
 * возвращает array('text' => …, 'error' => …, 'usage' => array(in, out)).
 *
 * Добавить провайдера = добавить ветку в pd_llm и блок в конфиг. Клиент об этом не знает.
 */

function pd_llm($system, $messages, $maxTokens = 700) {
  $cfg = pd_config();
  switch ($cfg['llm']) {
    case 'anthropic':     return pd_llm_anthropic($cfg['anthropic'], $system, $messages, $maxTokens);
    case 'openai_compat': return pd_llm_openai($cfg['openai_compat'], $system, $messages, $maxTokens);
    case 'gigachat':      return pd_llm_gigachat($cfg['gigachat'], $system, $messages, $maxTokens);
    case 'mock':          return pd_llm_mock($system, $messages);
    default:              return array('text' => '', 'error' => 'неизвестный драйвер llm: ' . $cfg['llm'], 'usage' => array(0, 0));
  }
}

// ---------------------------------------------------------------- Anthropic
function pd_llm_anthropic($c, $system, $messages, $maxTokens) {
  if (empty($c['key'])) return array('text' => '', 'error' => 'нет ключа anthropic', 'usage' => array(0, 0));
  list($code, $body, $err) = pd_http_post_json('https://api.anthropic.com/v1/messages', array(
    'model' => $c['model'],
    'max_tokens' => $maxTokens,
    // Системный промпт за сессию уходит 5–6 раз одним и тем же — просим его закешировать.
    // Попадание в кеш стоит 10% от обычного входа. Если промпт короче минимума кеширования,
    // API просто не закеширует его — ошибки не будет.
    'system' => array(array('type' => 'text', 'text' => $system, 'cache_control' => array('type' => 'ephemeral'))),
    'messages' => $messages,
  ), array(
    'x-api-key: ' . $c['key'],
    'anthropic-version: 2023-06-01',
  ));
  if ($err) return array('text' => '', 'error' => 'сеть: ' . $err, 'usage' => array(0, 0));
  $d = json_decode($body, true);
  if ($code !== 200 || !is_array($d)) {
    $m = isset($d['error']['message']) ? $d['error']['message'] : substr($body, 0, 300);
    return array('text' => '', 'error' => 'anthropic ' . $code . ': ' . $m, 'usage' => array(0, 0));
  }
  $text = '';
  if (isset($d['content']) && is_array($d['content'])) {
    foreach ($d['content'] as $blk) if (isset($blk['type'], $blk['text']) && $blk['type'] === 'text') $text .= $blk['text'];
  }
  return array('text' => $text, 'error' => '', 'usage' => array(
    isset($d['usage']['input_tokens']) ? (int)$d['usage']['input_tokens'] : 0,
    isset($d['usage']['output_tokens']) ? (int)$d['usage']['output_tokens'] : 0,
  ));
}

// ------------------------------------------- OpenAI-совместимые (OpenAI, OpenRouter, Yandex, ollama)
function pd_llm_openai($c, $system, $messages, $maxTokens) {
  if (empty($c['base'])) return array('text' => '', 'error' => 'не задан base для openai_compat', 'usage' => array(0, 0));
  // У OpenAI-схемы system — обычное сообщение в начале списка.
  $msgs = array_merge(array(array('role' => 'system', 'content' => $system)), $messages);
  $payload = array('model' => $c['model'], 'messages' => $msgs, 'max_completion_tokens' => $maxTokens);
  $hdr = array();
  if (!empty($c['key'])) $hdr[] = 'Authorization: Bearer ' . $c['key'];

  list($code, $body, $err) = pd_http_post_json(rtrim($c['base'], '/') . '/chat/completions', $payload, $hdr);
  // Старые шлюзы не знают max_completion_tokens — повторяем с max_tokens.
  if ($code === 400 && strpos($body, 'max_completion_tokens') !== false) {
    unset($payload['max_completion_tokens']);
    $payload['max_tokens'] = $maxTokens;
    list($code, $body, $err) = pd_http_post_json(rtrim($c['base'], '/') . '/chat/completions', $payload, $hdr);
  }
  if ($err) return array('text' => '', 'error' => 'сеть: ' . $err, 'usage' => array(0, 0));
  $d = json_decode($body, true);
  if ($code !== 200 || !is_array($d)) {
    $m = isset($d['error']['message']) ? $d['error']['message'] : substr($body, 0, 300);
    return array('text' => '', 'error' => 'llm ' . $code . ': ' . $m, 'usage' => array(0, 0));
  }
  $text = isset($d['choices'][0]['message']['content']) ? $d['choices'][0]['message']['content'] : '';
  if (is_array($text)) {   // некоторые шлюзы отдают content массивом блоков
    $acc = '';
    foreach ($text as $blk) if (isset($blk['text'])) $acc .= $blk['text'];
    $text = $acc;
  }
  return array('text' => (string)$text, 'error' => '', 'usage' => array(
    isset($d['usage']['prompt_tokens']) ? (int)$d['usage']['prompt_tokens'] : 0,
    isset($d['usage']['completion_tokens']) ? (int)$d['usage']['completion_tokens'] : 0,
  ));
}

// ---------------------------------------------------------------- GigaChat
/** Ключ обменивается на access_token на 30 минут — кешируем в файле. */
function pd_gigachat_token($c) {
  $cache = pd_dir('sessions') . '/gigachat-token.json';
  if (is_file($cache)) {
    $t = json_decode((string)file_get_contents($cache), true);
    if (is_array($t) && isset($t['token'], $t['exp']) && $t['exp'] > time() + 60) return array($t['token'], '');
  }
  $url = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
  $rq = 'scope=' . urlencode($c['scope']);
  $hdr = array(
    'Content-Type: application/x-www-form-urlencoded',
    'Accept: application/json',
    'RqUID: ' . pd_uuid4(),
    'Authorization: Basic ' . $c['key'],
  );
  // тело не JSON — отправляем как строку, заголовок Content-Type перебивает дефолтный
  list($code, $body, $err) = pd_http_post_json($url, $rq, $hdr, 20);
  if ($err) return array('', 'сеть (oauth): ' . $err);
  $d = json_decode($body, true);
  if ($code !== 200 || empty($d['access_token'])) return array('', 'gigachat oauth ' . $code . ': ' . substr($body, 0, 200));
  $exp = isset($d['expires_at']) ? (int)round($d['expires_at'] / 1000) : time() + 1500;
  @file_put_contents($cache, json_encode(array('token' => $d['access_token'], 'exp' => $exp)), LOCK_EX);
  return array($d['access_token'], '');
}
function pd_uuid4() {
  $b = function_exists('random_bytes') ? random_bytes(16) : pack('N4', mt_rand(), mt_rand(), mt_rand(), mt_rand());
  $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
  $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
  return implode('-', array(bin2hex(substr($b, 0, 4)), bin2hex(substr($b, 4, 2)), bin2hex(substr($b, 6, 2)), bin2hex(substr($b, 8, 2)), bin2hex(substr($b, 10, 6))));
}
function pd_llm_gigachat($c, $system, $messages, $maxTokens) {
  if (empty($c['key'])) return array('text' => '', 'error' => 'нет ключа gigachat', 'usage' => array(0, 0));
  list($tok, $err) = pd_gigachat_token($c);
  if ($err) return array('text' => '', 'error' => $err, 'usage' => array(0, 0));
  $msgs = array_merge(array(array('role' => 'system', 'content' => $system)), $messages);
  list($code, $body, $err) = pd_http_post_json('https://gigachat.devices.sberbank.ru/api/v1/chat/completions', array(
    'model' => $c['model'], 'messages' => $msgs, 'max_tokens' => $maxTokens, 'temperature' => 0.6,
  ), array('Authorization: Bearer ' . $tok, 'Accept: application/json'));
  if ($err) return array('text' => '', 'error' => 'сеть: ' . $err, 'usage' => array(0, 0));
  $d = json_decode($body, true);
  if ($code !== 200 || !is_array($d)) return array('text' => '', 'error' => 'gigachat ' . $code . ': ' . substr($body, 0, 300), 'usage' => array(0, 0));
  return array('text' => isset($d['choices'][0]['message']['content']) ? $d['choices'][0]['message']['content'] : '', 'error' => '', 'usage' => array(
    isset($d['usage']['prompt_tokens']) ? (int)$d['usage']['prompt_tokens'] : 0,
    isset($d['usage']['completion_tokens']) ? (int)$d['usage']['completion_tokens'] : 0,
  ));
}

// ---------------------------------------------------------------- mock
/**
 * Драйвер без сети: гоняет весь путь целиком, чтобы интерфейс и почту можно было
 * проверить до подключения платного API. Смыслы вытаскивает грубо — по частотности слов.
 */
function pd_llm_mock($system, $messages) {
  $isBrief = strpos($system, 'Собери из неё бриф') !== false;
  $said = array();
  foreach ($messages as $m) if ($m['role'] === 'user') $said[] = $m['content'];
  // На сборке брифа приходит одно сообщение — вся стенограмма целиком. Разбираем её
  // обратно на реплики человека, иначе в демо-бриф уезжает служебная обёртка промпта.
  if ($isBrief && count($said) === 1) {
    $lines = preg_split('/\n+/', (string)$said[0]);
    $said = array();
    foreach ($lines as $ln) if (strpos($ln, 'Человек: ') === 0) $said[] = trim(substr($ln, strlen('Человек: ')));
  }
  $last = $said ? end($said) : '';
  $turns = count($said);

  if (!$isBrief) {
    $qs = array(
      array('Что должно случиться с человеком внутри?', 'смысл, а не оборудование'),
      array('Кто ваш посетитель — кого вы видите первым?', 'аудитория'),
      array('Где это будет? Площадка уже есть?', 'место и площадь'),
      array('К какой дате нужно открыться?', 'сроки'),
      array('В каком порядке обсуждаете бюджет?', 'без точных цифр'),
    );
    $q = $qs[min($turns - 1 < 0 ? 0 : $turns - 1, count($qs) - 1)];
    return array('text' => json_encode(array(
      'words' => pd_mock_words($last),
      'reply' => $q[0], 'sub' => $q[1],
      'ready' => $turns >= 4,
    ), JSON_UNESCAPED_UNICODE), 'error' => '', 'usage' => array(0, 0));
  }

  $all = pd_str(implode(' ', $said), 3000);
  return array('text' => json_encode(array(
    'title' => 'Черновой бриф из демо-режима (модель не подключена)',
    'idea' => $all !== '' ? $all : 'Разговор не состоялся.',
    'who' => 'не обсуждали',
    'feel' => 'не обсуждали',
    'tags' => array('Демо-режим', 'Модель не подключена'),
    'brief' => array(
      'task' => $all, 'context' => 'не обсуждали', 'audience' => 'не обсуждали',
      'scenario' => 'не обсуждали', 'format' => 'не обсуждали', 'place' => 'не обсуждали',
      'scale' => 'не обсуждали', 'timeline' => 'не обсуждали', 'budget' => 'не обсуждали',
      'constraints' => 'не обсуждали', 'success' => 'не обсуждали',
    ),
    'open_questions' => array('Подключить языковую модель в site/api/config.php', 'Проверить отправку письма'),
    'quotes' => array_slice($said, 0, 2),
    'heat' => 'warm',
  ), JSON_UNESCAPED_UNICODE), 'error' => '', 'usage' => array(0, 0));
}
/** Грубое выделение смыслов для демо: длинные слова из последней реплики. */
function pd_mock_words($text) {
  $stop = ' и в во не что он на я с со как а то все она так его но да ты к у же вы за бы по только ее мне было вот от меня еще нет о из ему теперь когда даже ну вдруг ли если уже или ни быть был него до вас нибудь опять уж вам ведь там потом себя ничего ей может они тут где есть надо ней для мы тебя их чем была сам чтоб без будто чего раз тоже себе под будет ж тогда кто этот того потому этого какой совсем ним здесь этом один почти мой тем чтобы нее сейчас были куда зачем всех никогда можно при наконец два об другой хоть после над больше тот через эти нас про всего них какая много разве три эту моя впрочем хорошо свою этой перед иногда лучше чуть том нельзя такой им более всегда конечно всю между '
        // общие глаголы и вводные: в демо-облаке они смотрятся мусором
        . 'хотим хотел хотела хотелось нужно нужен нужна надо сделать делать сделали думаю думаем кажется наверное вообще примерно значит поэтому потому просто очень такое такие который которые чтобы будем будут может можем ';
  $words = preg_split('/[^\p{L}\p{N}\-]+/u', pd_lower($text), -1, PREG_SPLIT_NO_EMPTY);
  $out = array();
  foreach ((array)$words as $w) {
    if (pd_len($w) < 5) continue;
    if (strpos($stop, ' ' . $w . ' ') !== false) continue;
    $out[] = array('t' => $w, 'w' => 1.0 + (pd_len($w) > 8 ? 0.2 : 0), 'key' => count($out) === 0);
    if (count($out) >= 3) break;
  }
  return $out;
}
