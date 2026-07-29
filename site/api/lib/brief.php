<?php
/**
 * Оформление брифа: HTML-письмо и текстовая версия.
 *
 * Письмо читают в почтовом клиенте, поэтому вся вёрстка — таблицами и инлайновыми
 * стилями, без внешних шрифтов и картинок. Тёмная тема сайта здесь не годится:
 * бриф распечатывают и пересылают, значит светлый фон и чёрный текст.
 */

function pd_heat_label($h) {
  switch ($h) {
    case 'hot':  return array('Конкретный запрос', '#0a7d67', '#e6f7f3');
    case 'cold': return array('Общий разговор', '#8a6d3b', '#fdf6e3');
    default:     return array('Идея без деталей', '#3d6b8a', '#eef5fa');
  }
}

/** Ярлык поля брифа → человеческое название в письме. */
function pd_brief_labels() {
  return array(
    'task'        => 'Задача',
    'context'     => 'Контекст',
    'audience'    => 'Аудитория',
    'scenario'    => 'Что происходит с посетителем',
    'format'      => 'Формат',
    'place'       => 'Площадка',
    'scale'       => 'Масштаб',
    'timeline'    => 'Сроки',
    'budget'      => 'Бюджет',
    'constraints' => 'Ограничения',
    'success'     => 'Что считать успехом',
  );
}

function pd_brief_html($card, $contact, $sess) {
  $b = isset($card['brief']) && is_array($card['brief']) ? $card['brief'] : array();
  list($heatText, $heatFg, $heatBg) = pd_heat_label(isset($card['heat']) ? $card['heat'] : 'warm');
  $when = date('d.m.Y H:i');

  $rows = '';
  foreach (pd_brief_labels() as $k => $label) {
    $v = isset($b[$k]) ? trim((string)$b[$k]) : '';
    if ($v === '') $v = 'не обсуждали';
    $dim = (pd_lower($v) === 'не обсуждали') ? ' color:#9aa3a8;' : '';
    $rows .= '<tr>'
      . '<td style="padding:11px 16px 11px 0;border-bottom:1px solid #ececec;font:600 12px/1.4 Arial,sans-serif;'
      . 'letter-spacing:.06em;text-transform:uppercase;color:#7a848a;white-space:nowrap;vertical-align:top;width:170px;">'
      . pd_esc($label) . '</td>'
      . '<td style="padding:11px 0;border-bottom:1px solid #ececec;font:400 15px/1.6 Arial,sans-serif;color:#16202a;' . $dim . '">'
      . nl2br(pd_esc($v)) . '</td></tr>';
  }

  $tags = '';
  if (!empty($card['tags']) && is_array($card['tags'])) {
    foreach ($card['tags'] as $t) {
      $tags .= '<span style="display:inline-block;font:600 11px/1 Arial,sans-serif;letter-spacing:.08em;'
        . 'text-transform:uppercase;color:#0a7d67;border:1px solid #b9e5da;padding:7px 10px;margin:0 6px 6px 0;">'
        . pd_esc($t) . '</span> ';
    }
  }

  $questions = '';
  if (!empty($card['open_questions']) && is_array($card['open_questions'])) {
    foreach ($card['open_questions'] as $q) {
      $q = trim((string)$q);
      if ($q === '') continue;
      $questions .= '<li style="margin:0 0 9px;font:400 15px/1.55 Arial,sans-serif;color:#16202a;">' . pd_esc($q) . '</li>';
    }
  }
  $questionsBlock = $questions
    ? '<div style="margin-top:34px;background:#fbf7ee;border-left:3px solid #e0a45c;padding:20px 22px;">'
      . '<div style="font:600 12px/1 Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#a3762f;margin-bottom:14px;">'
      . 'Осталось выяснить</div><ul style="margin:0;padding-left:20px;">' . $questions . '</ul></div>'
    : '';

  $quotes = '';
  if (!empty($card['quotes']) && is_array($card['quotes'])) {
    foreach ($card['quotes'] as $q) {
      $q = trim((string)$q);
      if ($q === '') continue;
      $quotes .= '<p style="margin:0 0 14px;padding-left:16px;border-left:2px solid #d6dde1;'
        . 'font:italic 400 15px/1.6 Georgia,serif;color:#414d55;">«' . pd_esc($q) . '»</p>';
    }
  }
  $quotesBlock = $quotes
    ? '<div style="margin-top:34px;"><div style="font:600 12px/1 Arial,sans-serif;letter-spacing:.1em;'
      . 'text-transform:uppercase;color:#7a848a;margin-bottom:14px;">Своими словами</div>' . $quotes . '</div>'
    : '';

  // Стенограмма — в конце письма, свёрнутая: нужна редко, но иногда решает всё.
  $talk = '';
  if (!empty($sess['turns']) && is_array($sess['turns'])) {
    foreach ($sess['turns'] as $t) {
      if (!empty($t['q'])) $talk .= '<p style="margin:0 0 4px;font:600 13px/1.5 Arial,sans-serif;color:#7a848a;">— ' . pd_esc($t['q']) . '</p>';
      if (!empty($t['a'])) $talk .= '<p style="margin:0 0 16px;font:400 14px/1.6 Arial,sans-serif;color:#16202a;">' . nl2br(pd_esc($t['a'])) . '</p>';
    }
  }
  $talkBlock = $talk
    ? '<div style="margin-top:34px;border-top:1px solid #ececec;padding-top:24px;">'
      . '<div style="font:600 12px/1 Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#7a848a;margin-bottom:14px;">'
      . 'Стенограмма</div>' . $talk . '</div>'
    : '';

  $meta = array(
    'Имя' => isset($contact['name']) ? $contact['name'] : '',
    'Связь' => isset($contact['contact']) ? $contact['contact'] : '',
    'Компания' => isset($contact['company']) ? $contact['company'] : '',
  );
  $metaRows = '';
  foreach ($meta as $k => $v) {
    $v = trim((string)$v);
    if ($v === '') continue;
    $val = pd_esc($v);
    // Живая ссылка: по письму или телефону из брифа сразу удобно ответить.
    if (strpos($v, '@') !== false && strpos($v, ' ') === false) $val = '<a href="mailto:' . $val . '" style="color:#0a7d67;">' . $val . '</a>';
    elseif (preg_match('/^[\d\s()+\-]{7,}$/', $v)) $val = '<a href="tel:' . preg_replace('/[^\d+]/', '', $v) . '" style="color:#0a7d67;">' . $val . '</a>';
    $metaRows .= '<tr><td style="padding:0 14px 6px 0;font:600 12px/1.4 Arial,sans-serif;color:#7a848a;white-space:nowrap;">'
      . pd_esc($k) . '</td><td style="padding:0 0 6px;font:400 15px/1.4 Arial,sans-serif;color:#16202a;">' . $val . '</td></tr>';
  }

  $src = 'сайт playdisplay';
  if (!empty($sess['input'])) $src .= ', ' . ($sess['input'] === 'voice' ? 'голосом' : 'текстом');
  if (!empty($sess['llm'])) $src .= ' · модель: ' . $sess['llm'];

  return '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">'
    . '<meta name="viewport" content="width=device-width,initial-scale=1">'
    . '<title>' . pd_esc(isset($card['title']) ? $card['title'] : 'Бриф') . '</title></head>'
    . '<body style="margin:0;padding:0;background:#f4f5f6;">'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f6;">'
    . '<tr><td align="center" style="padding:28px 14px;">'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:660px;background:#ffffff;">'

    // шапка
    . '<tr><td style="background:#0b1418;padding:26px 30px;">'
    . '<div style="font:700 13px/1 Arial,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#2be0c6;">playdisplay ai</div>'
    . '<div style="margin-top:8px;font:400 12px/1 Arial,sans-serif;color:#8b979d;">Бриф с сайта · ' . pd_esc($when) . '</div>'
    . '</td></tr>'

    . '<tr><td style="padding:30px;">'

    // заголовок и температура запроса
    . '<span style="display:inline-block;font:600 11px/1 Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;'
    . 'color:' . $heatFg . ';background:' . $heatBg . ';padding:7px 11px;">' . pd_esc($heatText) . '</span>'
    . '<h1 style="margin:16px 0 0;font:700 25px/1.25 Georgia,serif;color:#0b1418;">'
    . pd_esc(isset($card['title']) ? $card['title'] : 'Без названия') . '</h1>'
    . '<p style="margin:14px 0 0;font:400 16px/1.65 Arial,sans-serif;color:#2d3a42;">'
    . nl2br(pd_esc(isset($card['idea']) ? $card['idea'] : '')) . '</p>'
    . ($tags ? '<div style="margin-top:18px;">' . $tags . '</div>' : '')

    // кто и зачем — две главные строки
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:26px;">'
    . '<tr><td style="width:50%;vertical-align:top;padding:16px 18px;background:#f7f9fa;border-top:2px solid #0a7d67;">'
    . '<div style="font:600 11px/1 Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#7a848a;">Для кого</div>'
    . '<div style="margin-top:9px;font:400 15px/1.6 Arial,sans-serif;color:#16202a;">' . pd_esc(isset($card['who']) ? $card['who'] : '') . '</div>'
    . '</td><td style="width:12px;"></td>'
    . '<td style="width:50%;vertical-align:top;padding:16px 18px;background:#f7f9fa;border-top:2px solid #0a7d67;">'
    . '<div style="font:600 11px/1 Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#7a848a;">Что должен почувствовать</div>'
    . '<div style="margin-top:9px;font:400 15px/1.6 Arial,sans-serif;color:#16202a;">' . pd_esc(isset($card['feel']) ? $card['feel'] : '') . '</div>'
    . '</td></tr></table>'

    // контакты
    . ($metaRows ? '<div style="margin-top:30px;padding:18px 20px;background:#0b1418;">'
        . '<div style="font:600 11px/1 Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#2be0c6;margin-bottom:12px;">Кто оставил</div>'
        . '<table role="presentation" cellpadding="0" cellspacing="0" style="color:#fff;">'
        . str_replace(array('color:#7a848a', 'color:#16202a'), array('color:#8b979d', 'color:#ffffff'), $metaRows)
        . '</table></div>' : '')

    // подробности
    . '<div style="margin-top:34px;font:600 12px/1 Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#7a848a;">Подробности</div>'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">' . $rows . '</table>'

    . $questionsBlock
    . $quotesBlock
    . $talkBlock

    . '</td></tr>'
    . '<tr><td style="padding:18px 30px 26px;border-top:1px solid #ececec;font:400 12px/1.6 Arial,sans-serif;color:#9aa3a8;">'
    . 'Собрано ассистентом на ' . pd_esc($src) . '. Сессия ' . pd_esc(isset($sess['sid']) ? $sess['sid'] : '—') . '.'
    . '</td></tr>'
    . '</table></td></tr></table></body></html>';
}

function pd_brief_text($card, $contact, $sess) {
  $b = isset($card['brief']) && is_array($card['brief']) ? $card['brief'] : array();
  $L = array();
  $L[] = 'БРИФ С САЙТА PLAYDISPLAY · ' . date('d.m.Y H:i');
  $L[] = '';
  $L[] = mb_strtoupper_safe(isset($card['title']) ? $card['title'] : 'Без названия');
  $L[] = '';
  $L[] = isset($card['idea']) ? $card['idea'] : '';
  $L[] = '';
  if (!empty($card['tags']) && is_array($card['tags'])) $L[] = 'Ярлыки: ' . implode(' · ', $card['tags']);
  $L[] = 'Для кого: ' . (isset($card['who']) ? $card['who'] : '—');
  $L[] = 'Что должен почувствовать: ' . (isset($card['feel']) ? $card['feel'] : '—');
  $L[] = '';
  $L[] = '--- КТО ОСТАВИЛ ---';
  $L[] = 'Имя: ' . (isset($contact['name']) ? $contact['name'] : '—');
  $L[] = 'Связь: ' . (isset($contact['contact']) ? $contact['contact'] : '—');
  if (!empty($contact['company'])) $L[] = 'Компания: ' . $contact['company'];
  $L[] = '';
  $L[] = '--- ПОДРОБНОСТИ ---';
  foreach (pd_brief_labels() as $k => $label) {
    $v = isset($b[$k]) ? trim((string)$b[$k]) : '';
    $L[] = $label . ': ' . ($v === '' ? 'не обсуждали' : $v);
  }
  if (!empty($card['open_questions']) && is_array($card['open_questions'])) {
    $L[] = '';
    $L[] = '--- ОСТАЛОСЬ ВЫЯСНИТЬ ---';
    foreach ($card['open_questions'] as $q) if (trim((string)$q) !== '') $L[] = '· ' . $q;
  }
  if (!empty($card['quotes']) && is_array($card['quotes'])) {
    $L[] = '';
    $L[] = '--- СВОИМИ СЛОВАМИ ---';
    foreach ($card['quotes'] as $q) if (trim((string)$q) !== '') $L[] = '«' . $q . '»';
  }
  if (!empty($sess['turns']) && is_array($sess['turns'])) {
    $L[] = '';
    $L[] = '--- СТЕНОГРАММА ---';
    foreach ($sess['turns'] as $t) {
      if (!empty($t['q'])) $L[] = '— ' . $t['q'];
      if (!empty($t['a'])) $L[] = '  ' . $t['a'];
    }
  }
  $L[] = '';
  $L[] = 'Сессия ' . (isset($sess['sid']) ? $sess['sid'] : '—');
  return implode("\n", $L);
}

function mb_strtoupper_safe($v) {
  return function_exists('mb_strtoupper') ? mb_strtoupper((string)$v, 'UTF-8') : strtoupper((string)$v);
}
