<?php
/**
 * Образец конфигурации AI-ассистента. Ключей в репозитории быть не должно.
 *
 * Локально:  скопировать в site/api/config.php (он в .gitignore) и вписать ключи.
 * На хостинге: положить копию ВЫШЕ веб-корня — ~/wordpress_2/pd-ai-config.php.
 *              ai.php ищет файл в этом порядке:
 *                1) путь из переменной окружения PD_AI_CONFIG
 *                2) ../../pd-ai-config.php  (для timeweb это ~/wordpress_2/pd-ai-config.php)
 *                3) site/api/config.php
 *
 * Без конфига ассистент работает на драйвере mock: диалог идёт по заранее
 * прошитому сценарию, бриф собирается, письмо кладётся в файл. Удобно, чтобы
 * прогнать весь путь до подключения платного API.
 */

return array(

  // ============ КУДА ПРИСЫЛАТЬ БРИФ ============
  'mail_to'       => 'andrey@rolltorule.com',
  'mail_from'     => 'ai@playdisplay.com',
  'mail_fromname' => 'PlayDisplay AI',

  // ============ ЯЗЫКОВАЯ МОДЕЛЬ ============
  // mock          — без сети, прошитый сценарий (по умолчанию)
  // anthropic     — Claude, api.anthropic.com
  // openai_compat — любой сервис с OpenAI-совместимым /chat/completions:
  //                 сам OpenAI, OpenRouter, Yandex Cloud, локальная ollama, посредники
  // gigachat      — GigaChat от Сбера (OAuth-обмен ключа на токен)
  'llm' => 'mock',

  'anthropic' => array(
    'key'   => '',                    // sk-ant-...
    'model' => 'claude-haiku-4-5-20251001',
  ),

  'openai_compat' => array(
    'key'      => '',
    'base'     => 'https://api.openai.com/v1',
    'model'    => 'gpt-5-mini',
    // примеры base/model для других сервисов:
    //   OpenRouter    https://openrouter.ai/api/v1        anthropic/claude-haiku-4.5
    //   Yandex Cloud  https://llm.api.cloud.yandex.net/v1 gpt://<folder-id>/yandexgpt-lite/latest
    //   ollama        http://127.0.0.1:11434/v1           qwen2.5:14b
  ),

  'gigachat' => array(
    'key'   => '',                    // Authorization key (base64 client_id:secret) из личного кабинета
    'scope' => 'GIGACHAT_API_PERS',   // PERS — физлицо, B2B/CORP — организация
    'model' => 'GigaChat',
  ),

  // ============ ОТПРАВКА ПОЧТЫ ============
  // file — письмо кладётся в site/api/outbox/ (ничего настраивать не нужно, для локальной работы)
  // smtp — через ящик на своём домене: доставляется надёжнее всего
  // mail — функция mail() хостинга: ноль настройки, но письма часто уходят в спам
  'mailer' => 'file',

  'smtp' => array(
    'host' => 'smtp.timeweb.ru',
    'port' => 465,
    'secure' => 'ssl',                // ssl (порт 465) или tls (порт 587)
    'user' => 'ai@playdisplay.com',
    'pass' => '',
  ),

  // ============ ЗАЩИТА ОТ ЗЛОУПОТРЕБЛЕНИЙ ============
  'limit_sessions_per_ip_hour' => 8,   // сколько сессий с одного адреса за час
  'limit_turns_per_session'    => 24,  // сколько реплик в одной сессии
  'limit_chars_per_turn'       => 4000,

  // Пишем в лог полную стенограмму сессии (site/api/sessions/). Выключить — false.
  'keep_transcripts' => true,
);
