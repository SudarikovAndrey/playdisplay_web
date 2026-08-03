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

/** Файл логотипа для шапки письма. Белый — потому что шапка тёмная. */
function pd_logo_path() {
  $p = dirname(PD_DIR) . '/assets/logos/playdisplay-logo-white.png';   // site/api → site/assets
  return is_file($p) ? $p : '';
}
/**
 * Картинка в письме: внутри почты это ссылка на вложение (cid), а в файле на диске —
 * встроенный base64, иначе превью в браузере показывало бы битый значок.
 */
function pd_logo_src($inline) {
  $p = pd_logo_path();
  if ($p === '') return '';
  if (!$inline) return 'cid:' . PD_LOGO_CID;
  return 'data:image/png;base64,' . base64_encode((string)file_get_contents($p));
}
define('PD_LOGO_CID', 'pdlogo');

/**
 * $inline — как вставлять логотип: false для настоящего письма (cid на вложение),
 * true для файла, который открывают в браузере (base64 прямо в разметке).
 */
function pd_brief_html($card, $contact, $sess, $inline = false) {
  $b = isset($card['brief']) && is_array($card['brief']) ? $card['brief'] : array();
  $titleOrig = trim((string)(isset($card['title']) ? $card['title'] : ''));
  $titleRu = trim((string)(isset($card['title_ru']) ? $card['title_ru'] : ''));
  if ($titleRu === '') $titleRu = $titleOrig;
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

  $chan = (!empty($contact['channels']) && is_array($contact['channels'])) ? implode(' · ', $contact['channels']) : '';
  // Приложенное человеком: файл едет вложением, здесь — только имя, чтобы среди
  // служебных картинок письма было видно, что настоящее ТЗ пришло.
  $attached = '';
  if (!empty($sess['files']) && is_array($sess['files'])) {
    $names = array();
    foreach ($sess['files'] as $fl) {
      if (empty($fl['name'])) continue;
      $kb = isset($fl['size']) ? ' (' . max(1, (int)round($fl['size'] / 1024)) . ' КБ)' : '';
      $names[] = $fl['name'] . $kb;
    }
    $attached = implode(' · ', $names);
  }
  $meta = array(
    'Имя' => isset($contact['name']) ? $contact['name'] : '',
    'Связь' => isset($contact['contact']) ? $contact['contact'] : '',
    'Удобнее' => $chan,
    'Компания' => isset($contact['company']) ? $contact['company'] : '',
    'Ссылка' => isset($contact['link']) ? $contact['link'] : '',
    'Вложение' => $attached,
  );
  $metaRows = '';
  foreach ($meta as $k => $v) {
    $v = trim((string)$v);
    if ($v === '') continue;
    $val = pd_esc($v);
    // Живая ссылка: по адресу из брифа сразу удобно ответить, не копируя его руками.
    // Порядок проверок важен: «@ivanov» — это телеграм, а не почта, и mailto для него
    // был бы битой ссылкой.
    if (preg_match('~^https?://~i', $v)) {
      // Ссылка на облако: кликабельной она нужна больше всего остального в письме.
      $val = '<a href="' . pd_esc($v) . '" style="color:#0a7d67;word-break:break-all;">' . $val . '</a>';
    } elseif (preg_match('/^@[A-Za-z0-9_]{3,}$/', $v)) {
      $val = '<a href="https://t.me/' . pd_esc(substr($v, 1)) . '" style="color:#0a7d67;">' . $val . '</a>';
    } elseif (filter_var($v, FILTER_VALIDATE_EMAIL)) {
      $val = '<a href="mailto:' . $val . '" style="color:#0a7d67;">' . $val . '</a>';
    } elseif (preg_match('/^[\d\s()+\-]{7,}$/', $v)) {
      $val = '<a href="tel:' . preg_replace('/[^\d+]/', '', $v) . '" style="color:#0a7d67;">' . $val . '</a>';
    }
    $metaRows .= '<tr><td style="padding:0 14px 6px 0;font:600 12px/1.4 Arial,sans-serif;color:#7a848a;white-space:nowrap;">'
      . pd_esc($k) . '</td><td style="padding:0 0 6px;font:400 15px/1.4 Arial,sans-serif;color:#16202a;">' . $val . '</td></tr>';
  }

  // Как человек рассказывал. Драйвер модели в письме не упоминаем — это внутренняя
  // деталь настройки, читателю брифа она ничего не говорит.
  $src = 'сайт playdisplay';
  if (!empty($sess['input'])) {
    $how = array('voice' => 'голосом', 'text' => 'текстом', 'смешанно' => 'голосом и текстом');
    $src .= ', ' . (isset($how[$sess['input']]) ? $how[$sess['input']] : $sess['input']);
  }
  // Язык разговора важен: отвечать человеку надо на том языке, на котором он говорил.
  // Берём язык РЕЧИ, а не язык страницы: гость с /en/ мог рассказывать по-русски,
  // и тогда писать ему по-английски было бы странно.
  $talkLang = !empty($sess['talk_lang']) ? $sess['talk_lang'] : (isset($sess['lang']) ? $sess['lang'] : 'ru');
  if ($talkLang !== 'ru') {
    $names = array('en' => 'по-английски', 'pt' => 'по-португальски');
    $src .= ' · разговор шёл ' . (isset($names[$talkLang]) ? $names[$talkLang] : $talkLang);
  }

  // Шапка: логотип студии, а если файла нет — прежняя надпись. Письмо не должно
  // ломаться из-за отсутствующей картинки.
  $logo = pd_logo_src($inline);
  $brand = $logo
    ? '<img src="' . pd_esc($logo) . '" width="163" height="20" alt="playdisplay"'
      . ' style="display:block;border:0;outline:none;text-decoration:none;height:20px;width:163px;">'
    : '<div style="font:700 13px/1 Arial,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:#2be0c6;">playdisplay</div>';

  return '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8">'
    . '<meta name="viewport" content="width=device-width,initial-scale=1">'
    . '<title>' . pd_esc($titleRu !== '' ? $titleRu : 'Бриф') . '</title></head>'
    . '<body style="margin:0;padding:0;background:#f4f5f6;">'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f6;">'
    . '<tr><td align="center" style="padding:28px 14px;">'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:660px;background:#ffffff;">'

    // шапка: логотип студии слева, дата справа
    . '<tr><td style="background:#0b1418;padding:24px 30px;">'
    . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
    . '<td style="vertical-align:middle;">' . $brand . '</td>'
    . '<td style="vertical-align:middle;text-align:right;font:400 11px/1.5 Arial,sans-serif;color:#8b979d;white-space:nowrap;">'
    . 'Бриф с сайта<br>' . pd_esc($when) . '</td>'
    . '</tr></table></td></tr>'

    . '<tr><td style="padding:30px;">'

    // заголовок и температура запроса
    . '<span style="display:inline-block;font:600 11px/1 Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;'
    . 'color:' . $heatFg . ';background:' . $heatBg . ';padding:7px 11px;">' . pd_esc($heatText) . '</span>'
    // Заголовок по-русски, а под ним — как проект назван на языке гостя. Два заголовка,
    // потому что письмо читает студия, а говорить с человеком придётся его словами.
    . '<h1 style="margin:16px 0 0;font:700 25px/1.25 Georgia,serif;color:#0b1418;">'
    . pd_esc($titleRu !== '' ? $titleRu : 'Без названия') . '</h1>'
    . ($titleOrig !== '' && $titleOrig !== $titleRu
        ? '<div style="margin:8px 0 0;font:400 14px/1.5 Arial,sans-serif;color:#7a848a;">'
          . 'На языке гостя: ' . pd_esc($titleOrig) . '</div>'
        : '')
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
  $titleRu = trim((string)(isset($card['title_ru']) ? $card['title_ru'] : ''));
  $titleOrig = trim((string)(isset($card['title']) ? $card['title'] : ''));
  if ($titleRu === '') $titleRu = $titleOrig;
  $L[] = mb_strtoupper_safe($titleRu !== '' ? $titleRu : 'Без названия');
  if ($titleOrig !== '' && $titleOrig !== $titleRu) $L[] = 'На языке гостя: ' . $titleOrig;
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
  if (!empty($contact['channels']) && is_array($contact['channels'])) $L[] = 'Удобнее: ' . implode(' · ', $contact['channels']);
  if (!empty($contact['company'])) $L[] = 'Компания: ' . $contact['company'];
  if (!empty($contact['link'])) $L[] = 'Ссылка: ' . $contact['link'];
  if (!empty($sess['files']) && is_array($sess['files'])) {
    foreach ($sess['files'] as $fl) if (!empty($fl['name'])) $L[] = 'Вложение: ' . $fl['name'];
  }
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
