# Журнал деплоя

Записи пишет `deploy.sh`, новые сверху.

Каждая запись — одна поставка на боевой хостинг: дата, ветка и хеш, с которого
залито, список коммитов, попавших в поставку, и файлы, реально уехавшие на сервер.
Строка `удалено` — файлы, которых больше нет в `site/` и которые снялись с сервера.

<!-- НОВЫЕ ЗАПИСИ ДОБАВЛЯЮТСЯ ПОД ЭТОЙ СТРОКОЙ. НЕ УДАЛЯТЬ. -->

## 2026-08-11 16:58 — hybrid-v8 @ 8d85210

**Коммиты в этой поставке**
```
8d85210 Мягкий онбординг полёта по ?ob=1: коридор, руль, цель, безопасный старт
95c2273 Журнал деплоя: dcb5950
```

**На сервер отправлено файлов:** 2, удалено: 3074
```
hero-scene.html
index.html
```


## 2026-08-08 03:31 — hybrid-v8 @ dcb5950

**Коммиты в этой поставке**
```
dcb5950 Заставка при загрузке, логотип в шапке по сетке, воздух в плашке, финал без крупного лого
0d3c037 Метки на кадрах: точно по центру, мелкие и контрастные
35a062c Подсказки на кадрах и ролик в сезоне вместо картинки
b673d3b Разметка: приближаемся к полю; кадрам во всю ширину дан воздух сверху
e02424f Сезон: теннисный кадр заменён на баскетбольный
1f65e9a Разметка наезжает нижней гранью, схема «Паспорт мяча» собрана по числам
bdb518c Разметка: камера опускается к плоскости, и поле сжимается в линию
d008566 Полноэкранные кадры выровнены, разметка площадок сходится в линию
21dc22b Разметка площадок на фоне, ролик арены, мягкая прокрутка, кнопка «в начало»
1fc88e6 Рентген купола, слёт-разлёт курсора, форма баскетбольного мяча
89a9ed7 Мячи по фотографиям, курсор-мяч только на двух экранах, вступление без наложений
239cafa Мячи по геометрии, курсор-мяч и слои параллакса в книге концепции
2d64d06 Мяч концепции: шесть видов спорта по кругу и по клику, 27000 точек
c01385d Концепция «Музей Мяча», правки по замечаниям. Статус документа больше не налезает на заголовок: он стоял абсолютом в углу, а кегль «МУЗЕЙ МЯЧА» считается от вьюпорта — теперь строка в общем потоке под слоганом. Имя в подвале вдвое мельче. Мяч на первом экране переписан: вместо CSS-сферы из градиентов — облако точек, как глобус на сайте, спираль Фибоначчи (пояса ровные, проверено), швы как у мячей последних чемпионатов (три наклонённых круга плюс волна по долготе, 17% точек на швах), вращение полное и непрерывное вокруг наклонённой оси, курсор лишь подкручивает. Музыка тише на 30% (0.26 → 0.18). Перечисления поданы по смыслу, текст не тронут: путь — шагами с крупной цифрой и линией (главы 03 и 12), наборы — карточками с индексом (7 списков), опоры раздела — крупной фразой с номером, короткие остаются строками; появляются вслед за прокруткой
04788c8 Журнал деплоя: 159d6f4
```

**На сервер отправлено файлов:** 17, удалено: 0
```
ball/assets/illustrations/arena-basketball.webp
ball/assets/illustrations/arena-dome-xray.webp
ball/assets/video/
ball/assets/video/arena-show.mp4
ball/assets/video/season-basketball.mp4
ball/css/components.css
ball/css/layout.css
ball/js/app.js
ball/js/ball.js
ball/js/boot.js
ball/js/courts.js
ball/js/hotspots.js
ball/js/lists.js
ball/js/scroll.js
ball/js/ui.js
ball/js/xray.js
ball/private/page.html
```


## 2026-08-07 21:31 — hybrid-v8 @ 159d6f4

**Коммиты в этой поставке**
```
159d6f4 Калитка концепции падала с 500 на отправке пароля. Причина — новизна кода на старом PHP: declare(strict_types) превращает несовпадение типов во внутренних функциях в фатальную ошибку, setcookie() с массивом настроек живёт только с 7.3, hash_pbkdf2 — с 5.5. Переписал на минимум: Set-Cookie собирается руками, у PBKDF2 и сравнения есть свои реализации на hash_hmac, strict_types убран. Свою реализацию сверил с эталоном — отпечаток тот же. Добавлена диагностика /ball/?diag: версия PHP, наличие функций, лежит ли книга — без пароля и без книги в выводе
6e055a7 Журнал деплоя: 7da830d
```

**На сервер отправлено файлов:** 1, удалено: 0
```
ball/index.php
```


## 2026-08-07 21:21 — hybrid-v8 @ 7da830d

**Коммиты в этой поставке**
```
7da830d Закрытая концепция «Музей Мяча» на /ball/: доступ только по прямой ссылке и по паролю. Проверка на сервере, а не в браузере — вёрстка лежит в private/, куда веб-сервер не пускает вовсе, и отдаётся только после успешной проверки; при клиентской проверке её было бы видно через просмотр кода. Пароля в файлах нет: соль и отпечаток PBKDF2-SHA256, 200 000 итераций, сравнение постоянным по времени, пауза 0,4 с на попытку, вход помнится месяц в cookie только для /ball/. Закрыто от поисковых и AI-краулеров заголовком (вместе с картинками), листинг папки выключен; ни в sitemap, ни в llms.txt, ни в robots.txt пути нет — чтобы не подсказывать его. Картинки переведены из PNG в WebP без потерь: 41 → 24 МБ, сверил все 15 пиксель в пиксель
6c4bda3 Журнал деплоя: a28c3fe
```

**На сервер отправлено файлов:** 83, удалено: 0
```
enemy-lab.html
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
ball/
ball/.htaccess
ball/index.php
ball/assets/
ball/assets/audio/
ball/assets/audio/deep-space-tension.mp3
ball/assets/illustrations/
ball/assets/illustrations/andrey-sudarikov.webp
ball/assets/illustrations/arena-football.webp
ball/assets/illustrations/arena-tennis.webp
ball/assets/illustrations/ball-passport.webp
ball/assets/illustrations/family-visit.webp
ball/assets/illustrations/interactive-basketball.webp
ball/assets/illustrations/interactive-bowling.webp
ball/assets/illustrations/interactive-golf.webp
ball/assets/illustrations/interactive-volleyball.webp
ball/assets/illustrations/interactive-water-polo.webp
ball/assets/illustrations/lab-inventory.webp
ball/assets/illustrations/lab-table-tennis.webp
ball/assets/illustrations/museum-floorplan.webp
ball/assets/illustrations/philosophy-room.webp
ball/assets/logo/
ball/assets/logo/playdisplay-logo.webp
ball/css/
ball/css/animations.css
ball/css/components.css
ball/css/layout.css
…и ещё 43
```


## 2026-08-05 12:08 — hybrid-v8 @ a28c3fe

**Коммиты в этой поставке**
```
a28c3fe Пустой PDF, зависание на последнем вопросе и слова поверх текста
7af25b0 Журнал деплоя: 0d35e1d
```

**На сервер отправлено файлов:** 1, удалено: 0
```
index.html
```


## 2026-08-04 08:47 — hybrid-v8 @ 0d35e1d

**Коммиты в этой поставке**
```
0d35e1d Перевод проверяем результатом, письмо на живом хосте больше не теряется
8a9a0a0 Журнал деплоя: 5945013
```

**На сервер отправлено файлов:** 3, удалено: 0
```
api/ai.php
api/lib/mailer.php
api/lib/prompts.php
```


## 2026-08-03 22:00 — hybrid-v8 @ 5945013

**Коммиты в этой поставке**
```
5945013 Safari не тянет continuous и требует жеста — микрофон молчал из-за этого
b58b9b3 Журнал деплоя: 0681eed
```

**На сервер отправлено файлов:** 1, удалено: 0
```
index.html
```


## 2026-08-03 21:48 — hybrid-v8 @ 0681eed

**Коммиты в этой поставке**
```
0681eed Микрофон молчал из-за локали, письма не уходили из-за драйвера file
c63982d Журнал деплоя: 269d876
```

**На сервер отправлено файлов:** 5, удалено: 0
```
index.html
api/ai.php
api/lib/brief.php
api/lib/mailer.php
api/lib/prompts.php
```


## 2026-08-03 21:27 — hybrid-v8 @ 269d876

**Коммиты в этой поставке**
```
269d876 Журнал деплоя: 46af532
```

**На сервер отправлено файлов:** 0, удалено: 0



## 2026-08-03 21:10 — hybrid-v8 @ 46af532

**Коммиты в этой поставке**
```
46af532 Ассистент: доска смыслов, копия гостю, канал со своим контактом, вылет назад
0689900 Журнал деплоя: 6d3a015
```

**На сервер отправлено файлов:** 5, удалено: 0
```
index.html
api/ai.php
api/lib/brief.php
api/lib/mailer.php
data/i18n/en.js
```


## 2026-08-03 20:35 — hybrid-v8 @ 6d3a015

**Коммиты в этой поставке**
```
6d3a015 Журнал деплоя: b77ccb9
```

**На сервер отправлено файлов:** 0, удалено: 0



## 2026-08-03 20:27 — hybrid-v8 @ b77ccb9

**Коммиты в этой поставке**
```
b77ccb9 Карточка переводилась наполовину: перевод вынесен в отдельный проход
f91330a Журнал деплоя: 0a1d7b1
```

**На сервер отправлено файлов:** 2, удалено: 0
```
api/ai.php
api/lib/prompts.php
```


## 2026-08-03 20:12 — hybrid-v8 @ 0a1d7b1

**Коммиты в этой поставке**
```
0a1d7b1 Генератор вставляет SEO-блок главной сам: вторая ручная ступень убрана
0a993fd Генератор сам вставляет SEO-блок в русскую главную между маркерами — последняя ручная ступень убрана. Английская версия так делала всегда, русская ждала человека, и это та же болезнь, что и промежуточный cases.json. Правка соседнего чата, зафиксирована по просьбе владельца
93a38f7 Генератор читает кейсы прямо из index.html: промежуточного /tmp/cases.json больше нет. Раньше его надо было выкладывать руками, и однажды этого не сделали — английская главная отстала от русской на несколько поставок. Массив CASES разбирается посимвольно (в описаниях есть и «https://», и запятые, на которых регулярки тихо ломались), обязательные поля проверяются с громким падением. Правка соседнего чата, зафиксирована по просьбе владельца
7334d58 Шесть правок по замечаниям. В контакте вместо имени — «Креативная сессия с playdisplay», заголовок стал «Забронируйте 30 минут», чтобы не повторяться. Подпись подвала больше не заезжает под виджет микрофона (зазор 32 px, на телефоне отступ снизу). Кнопка «сыграть в пространство» на загрузке из яркой заливки стала тонкой рамкой на 72% прозрачности — сцена и логотип снова главные. В шапке появился выключатель звука: один на весь сайт, глушит и ролики, и звуки 3D-сцены (ей уходит pdSound), выбор помнится в том же ключе pd_sound. В разделе Студия карточка основателя с портретом и резюме из трёх строк; фотографии пока нет — на её месте монограмма в фирменной типографике, как только положим assets/andrey-sudarikov.jpg, она подхватится сама. Подписи стартовой сцены переводятся: сцена получает язык в адресе и берёт ТОТ ЖЕ словарь, что и сайт — статусы облака точек, подсказки архива и HUD полёта теперь на языке страницы
c23a9f1 Журнал деплоя: d221741
```

**На сервер отправлено файлов:** 37, удалено: 0
```
hero-scene.html
index.html
llms.txt
robots.txt
sitemap.xml
data/i18n/en.js
en/index.html
en/work/airports/index.html
en/work/bmwx5/index.html
en/work/coalco/index.html
en/work/industry-rf/index.html
en/work/mig2019/index.html
en/work/odk-oak/index.html
en/work/pano360/index.html
en/work/proryv/index.html
en/work/ptk-group/index.html
en/work/rostec/index.html
en/work/sinara/index.html
en/work/stalingrad/index.html
en/work/urban-forum-2018/index.html
en/work/vdnh-space-center/index.html
en/work/vdnh-space/index.html
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

