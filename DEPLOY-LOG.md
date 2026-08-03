# Журнал деплоя

Записи пишет `deploy.sh`, новые сверху.

Каждая запись — одна поставка на боевой хостинг: дата, ветка и хеш, с которого
залито, список коммитов, попавших в поставку, и файлы, реально уехавшие на сервер.
Строка `удалено` — файлы, которых больше нет в `site/` и которые снялись с сервера.

<!-- НОВЫЕ ЗАПИСИ ДОБАВЛЯЮТСЯ ПОД ЭТОЙ СТРОКОЙ. НЕ УДАЛЯТЬ. -->

## 2026-08-03 11:04 — hybrid-v8 @ d221741

**Коммиты в этой поставке**
```
d221741 Витрина на мобиле: рамка по пропорции кадра и по центру — конец обрезке и сдвигу
528b539 Журнал деплоя: 7ec2fd9
```

**На сервер отправлено файлов:** 2, удалено: 0
```
hero-scene.html
index.html
```


## 2026-08-03 08:48 — hybrid-v8 @ 7ec2fd9

**Коммиты в этой поставке**
```
7ec2fd9 Язык по речи, облако смыслов, файл с запросом и правила данных
153cffc Журнал деплоя: 572d2be
```

**На сервер отправлено файлов:** 2, удалено: 0
```
hero-scene.html
index.html
```


## 2026-08-03 05:58 — hybrid-v8 @ 572d2be

**Коммиты в этой поставке**
```
572d2be Журнал деплоя: ffe521c
```

**На сервер отправлено файлов:** 0, удалено: 0



## 2026-08-03 05:56 — hybrid-v8 @ ffe521c

**Коммиты в этой поставке**
```
ffe521c Язык по речи, облако смыслов, файл с запросом и правила данных
5dbdd29 Правила данных: обрабатывает команда студии, отдельный раздел про приложенные файлы
ce3387c Ассистент: язык по речи, спокойное облако смыслов, файл с запросом и правила данных
1616542 Журнал деплоя: 003cd58
```

**На сервер отправлено файлов:** 13, удалено: 0
```
hero-scene.html
index.html
privacy.html
api/.htaccess
api/README.md
api/ai.php
api/config.sample.php
api/selftest.php
api/lib/brief.php
api/lib/mailer.php
api/lib/prompts.php
api/lib/util.php
data/i18n/en.js
```


## 2026-08-02 22:33 — hybrid-v8 @ 003cd58

**Коммиты в этой поставке**
```
003cd58 Мобильная: касания в игре, центр логотипа, замок прокрутки, лёгкие копии роликов
b133f8d Журнал деплоя: eb70ec5
```

**На сервер отправлено файлов:** 2, удалено: 0
```
hero-scene.html
index.html
```


## 2026-08-02 01:30 — hybrid-v8 @ eb70ec5

**Коммиты в этой поставке**
```
eb70ec5 Мобильная версия целиком: часть правок не доехала черри-пиком
2d6032c Журнал деплоя: d6ccbf5
```

**На сервер отправлено файлов:** 1, удалено: 0
```
index.html
```


## 2026-08-02 01:07 — hybrid-v8 @ d6ccbf5

**Коммиты в этой поставке**
```
d6ccbf5 Мобильная версия: меню, ленты проектов и Атласа, чистое видео, замок прокрутки
8271ce8 Журнал деплоя: c82e1ab
c82e1ab Голый вопрос от модели — это ответ, а не провал
d53af03 Журнал деплоя: 51dec42
11981d5 Смыслы выделяются отдельным проходом: одну задачу модель делает, две — нет
```

**На сервер отправлено файлов:** 402, удалено: 0
```
.htaccess
enemy-lab.html
hero-scene.html
index.html
llms.txt
model.js
odk_frame.js
robots.txt
shape-lab.html
ship-lab.html
ship-points.js
sitemap.xml
styles.css
textures.js
work-3d.html
work-showcase.html
world-lab.html
world-worker.js
world.js
api/.htaccess
api/README.md
api/ai.php
api/config.sample.php
api/selftest.php
api/lib/brief.php
api/lib/guard.php
api/lib/llm.php
api/lib/mailer.php
api/lib/prompts.php
api/lib/util.php
assets/concepts/ar-portal/1.jpg
assets/concepts/ar-portal/2.jpg
assets/concepts/ar-portal/thumb.jpg
assets/concepts/ar-xray/1.jpg
assets/concepts/ar-xray/2.jpg
assets/concepts/ar-xray/thumb.jpg
assets/concepts/art-portrait/1.jpg
assets/concepts/art-portrait/2.jpg
assets/concepts/art-portrait/thumb.jpg
assets/concepts/cabin-hologram/1.jpg
…и ещё 362
```


## 2026-08-02 00:51 — hybrid-v8 @ c82e1ab

**Коммиты в этой поставке**
```
c82e1ab Голый вопрос от модели — это ответ, а не провал
d53af03 Журнал деплоя: 51dec42
11981d5 Смыслы выделяются отдельным проходом: одну задачу модель делает, две — нет
```

**На сервер отправлено файлов:** 3, удалено: 0
```
index.html
api/ai.php
api/lib/prompts.php
```


## 2026-08-02 00:29 — hybrid-v8 @ 51dec42

**Коммиты в этой поставке**
```
11981d5 Смыслы выделяются отдельным проходом: одну задачу модель делает, две — нет
51dec42 Вопросы звучали анкетой, а не беседой; потолок стража опущен по замеру
4a49c91 Разговор ломался со второй реплики: модель копировала формат из истории
cf9854e GigaChat: ключ авторизации чиним перед отправкой, а не после суток поисков
04fbb2f Деплой: сертификат ассистента защищён от заливки
```

**На сервер отправлено файлов:** 43, удалено: 1
```
api/config.sample.php
api/lib/guard.php
api/lib/prompts.php
api/lib/util.php
videos/odk-maks-2021.mp4
videos/proryv-2024-m.mp4
videos/proryv-2024.mp4
videos/proryv-booth-m.mp4
videos/proryv-booth.mp4
videos/ptk-film-m.mp4
videos/ptk-film.mp4
videos/rostec-film-m.mp4
videos/rostec-film.mp4
videos/stalingrad-promo-m.mp4
videos/stalingrad-promo.mp4
videos/urban-ar-m.mp4
videos/urban-ar.mp4
videos/urban-film-m.mp4
videos/urban-film.mp4
videos/urban-oblet-m.mp4
videos/urban-oblet.mp4
videos/urban-wall-m.mp4
videos/urban-wall.mp4
work/airports/index.html
work/bmwx5/index.html
work/coalco/index.html
work/industry-rf/index.html
work/mig2019/index.html
work/odk-oak/index.html
work/pano360/index.html
work/proryv/index.html
work/ptk-group/index.html
work/rostec/index.html
work/sinara/index.html
work/stalingrad/index.html
work/urban-forum-2018/index.html
work/vdnh-space-center/index.html
work/vdnh-space/index.html
```

