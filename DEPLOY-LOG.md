# Журнал деплоя

Записи пишет `deploy.sh`, новые сверху.

Каждая запись — одна поставка на боевой хостинг: дата, ветка и хеш, с которого
залито, список коммитов, попавших в поставку, и файлы, реально уехавшие на сервер.
Строка `удалено` — файлы, которых больше нет в `site/` и которые снялись с сервера.

<!-- НОВЫЕ ЗАПИСИ ДОБАВЛЯЮТСЯ ПОД ЭТОЙ СТРОКОЙ. НЕ УДАЛЯТЬ. -->

## 2026-08-17 20:35 — hybrid-v8 @ 3c39585

**Коммиты в этой поставке**
```
3c39585 Метрика наконец считает: убран ssr:true, из-за которого не уходило ни одного хита
fb54d3b Журнал деплоя: 32bc7d6
```

**На сервер отправлено файлов:** 1, удалено: 0
```
analytics.js
```


## 2026-08-17 19:54 — hybrid-v8 @ 32bc7d6

**Коммиты в этой поставке**
```
32bc7d6 Один адрес сайта: 301 с .ru и www, починены редиректы с решёткой
75983e3 Кадр сборок: машина по центру крупно, заголовок снят, волна света по кузову при смене; курсор снимает затемнение вместо засветки; кадры галереи фиксируются после свайпа
f73d6b0 Сборки NIVA переехали кадром в галерею «Тачки в игре»: светлая земля под колёсами вместо чёрного фона; листание галереи стало плавным
288ce15 Прокачка NIVA: пять сборок с переключением и жёсткой тенью вместо кадра галереи; блок записан в кит
73968cd Курсор освещает кадр гаражного двора: осветлённая копия проявляется сквозь маску, сила растёт к центру, где светят фары
8e8930b Приглашение партнёра через gh api: подкоманды add-collaborator у gh нет
fc8fa2a Сырьё и модели компреда снимаются с сервера, а не консервируются там: правило только для отправляющей стороны вместо exclude
682dbcf Отдельный репозиторий компреда для работы с партнёром: скрипт синхронизации, свой паспорт для Claude; модели гаража выведены из поставки
3d20100 Колода отзывов: поворот вокруг ребра и порядок слоёв - задняя карточка больше не наезжает; плавный ход на одну карточку; версии на файлах кита против годового кэша nginx; новая ссылка на группу
8120df0 Журнал деплоя: f102966
```

**На сервер отправлено файлов:** 19, удалено: 9
```
.htaccess
analytics.js
avtovaz/assets/tuning/
avtovaz/assets/tuning/stage-1.webp
avtovaz/assets/tuning/stage-2.webp
avtovaz/assets/tuning/stage-3.webp
avtovaz/assets/tuning/stage-4.webp
avtovaz/assets/tuning/stage-5.webp
avtovaz/private/page.html
digital/index.html
kit/KIT.md
kit/blocks.json
kit/new-page.py
kit/stamp.py
kit/css/components.css
kit/js/gallery.js
kit/js/spotlight.js
kit/js/stages.js
kit/js/strip.js
```


## 2026-08-17 13:02 — hybrid-v8 @ f102966

**Коммиты в этой поставке**
```
f102966 Сырьё компреда (avtovaz/material) не уезжает на сервер и не отслеживается
9c656d8 Отзывы листаются как колода: карточки отворачиваются на краях вместо маски, тяга идёт 1:1, шаг стрелки - одна карточка
b6f5397 Отзывы: заголовок «Отзывы игроков в App Store», группа в Телеграме отдельной карточкой в шапке, лента уходит за оба края с растворением, контрастные стрелки поверх карточек и листание тягой
a478b4a Кадры-предметы: половина кадра во всю высоту с центровкой по вертикали вместо привязки к верху
d8d02e9 Лента отзывов: отклик на курсор, вылет за край экрана, стрелки листания и кнопка группы в Телеграме; заголовок первого экрана больше не слипается строками
d5adc22 Обновлена картинка NIVA: исходник уже с прозрачным фоном, вырезание вручную не нужно
fbc65bc NIVA на бездорожье - пятым кадром галереи «Тачки в игре», белый фон и тень вырезаны
610f89d Гараж с тюнингом - шестым кадром галереи: белый фон вырезан, кадр-предмет справа, текст слева
1681ea5 Гаражный двор с четырьмя LADA - первым кадром галереи «Тачки в игре»
910f145 Порядок: экономика контакта и масштаб перенесены после слайда «Что мы предлагаем»
bf4c43e Отзывы на светлых карточках без обрезки текста, подводка снята; слайд про эффекты владения переехал шестым кадром в галерею «Тачки в игре»
d3a12ee Галереи: общее имя в верхнем углу со знаком - «Вселенная» и «Тачки в игре»; блок записан в кит
b201f2d Компред: убраны шесть слайдов (направления, юмор, 3D-сцена, карточка в интерфейсе, награды, почему мы, смета, договор), отзывы перенесены на слайд аудитории, предложение переписано в два направления по 15 млн
04c019e Отзывы: убраны жалобы и вопросы, добавлен отзыв с просьбой машин, значок стора в углу; подвал стал точкой привязки
d419ec8 Полноэкранный режим — в шапку документа и в правила кита; заголовок отзывов
34290b9 Подрезаны два слайда под высоту экрана
eaf7b1c Галерея про тачки, новый порядок слайдов: игра, аудитория, тачки, затем бизнес подряд
4d32f84 Галерея листается, дубль отзывов убран, кнопка в начало и полный экран, плитки площадок
d02df44 Границы бренда: убран пункт про сцены насилия, добавлено про сравнение с другими марками
67a0aad Фулскрин-галерея про игру одним экраном, маркетинговый слайд про влияние на бренд, правки границ и порядка слайдов
8d06d24 Отзывы: только пятизвёздочные, без оговорок про донат и баги
3e70c53 Галерея про игру, отзывы из стора, портрет игрока с гипотезой, термины по-русски, спокойный картон вместо фотофактуры
b0f1629 Правила набора (тире, висяки) в кит; настоящие цифры игры, машины на слайде направлений, кликабельные сторы, знаки крупнее
81b07f1 Первый экран: знаки LADA и игры, смысл про символ эпохи, кадр справа целиком
8c02027 Читаемость кадров-слайдов: плашка под текстом, кегль меньше, порядок слоёв; починен путь к фактуре картона
b491048 Гараж: единый масштаб машин по длине, посадка на найденный пол, камера внутри комнаты, экспозиция ниже
2644753 Растворение переднего плана — в кит отдельным модулем; качество моделей поднято, свет с тенями, три машины
8ead0d3 Горизонтальные кадры игры из Figma во весь экран вместо растянутых вертикальных
be364cc Кадры игры в максимальном разрешении, вертикаль больше не растягивается на широкий слайд
62d961b Компред 0.3: аудитория, экономика контакта, границы бренда, мокап карточки, сроки, кейсы, три уровня, смета и договор; точные данные App Store
0344d8e Сцена гаража: машина внутри интерьера, стены рассыпаются перед камерой, контактное пятно
d58454e Полноэкранные кадры игры: четыре слайда-кадра (район, персонажи, авторазборка, босс)
232e6ea Компред слайдами: 20 экранов с прилипанием, свежие кадры и знаки сторов, просмотр NIVA как в Meshy; кит 0.4
05abd01 Джойстик: экспо-кривая вместо квадратичной — корабль снова рулится
3befc6f Портрет основателя: на «Студии» вместо лица стояла заглушка
9080bfb Иконка вкладки: её не было ни на одной из 33 страниц
105b4a3 Брифы ассистента тоже на info@playdisplay.com
09e0a56 Компред АвтоВАЗу: материалы игры, аудитория из питч-дека, тема «асфальт и картон», 3D-гараж с NIVA; кит 0.3
c1d5cec Заявки формы брони уходят на info@playdisplay.com
86d078e Журнал деплоя: d7d118f
```

**На сервер отправлено файлов:** 91, удалено: 0
```
favicon.ico
hero-scene.html
index.html
llms.txt
privacy.html
robots.txt
sitemap.xml
api/README.md
api/ai.php
api/config.sample.php
api/lib/util.php
assets/andrey-sudarikov.jpg
assets/logos/favicon-180.png
assets/logos/favicon-32.png
assets/logos/favicon-512.png
assets/logos/mark.png
avtovaz/garage.html
avtovaz/assets/app-icon.png
avtovaz/assets/car-devyatka.jpg
avtovaz/assets/car-niva.jpg
avtovaz/assets/game-logo.png
avtovaz/assets/garage-tuning.png
avtovaz/assets/garage-yard.jpg
avtovaz/assets/lada-emblem.png
avtovaz/assets/lada-lockup.png
avtovaz/assets/niva-offroad.png
avtovaz/assets/shot1.jpg
avtovaz/assets/shot2.jpg
avtovaz/assets/shot3.jpg
avtovaz/assets/shot4.jpg
avtovaz/assets/shot5.jpg
avtovaz/assets/shot6.jpg
avtovaz/assets/shot7.jpg
avtovaz/assets/wide1.jpg
avtovaz/assets/wide2.jpg
avtovaz/assets/wide3.jpg
avtovaz/assets/wide4.jpg
avtovaz/assets/wide5.jpg
avtovaz/assets/wide6.jpg
avtovaz/assets/wide7.jpg
…и ещё 51
```


## 2026-08-15 23:40 — hybrid-v8 @ d7d118f

**Коммиты в этой поставке**
```
d7d118f Отпечаток содержимого у styles.css и analytics.js: nginx кэширует статику год
e309559 Журнал деплоя: 5b76972
```

**На сервер отправлено файлов:** 36, удалено: 0
```
.htaccess
index.html
llms.txt
robots.txt
sitemap.xml
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


## 2026-08-15 22:58 — hybrid-v8 @ 5b76972

**Коммиты в этой поставке**
```
5b76972 Форма брони вместо mailto; аудит сайта по десяти ролям
cc94216 Три.js и шрифты — свои, а не с чужих CDN; загрузчики моделей по требованию
39b41e2 Сжатие и кэш на сервере, счётчики только на боевом, политика — по правде
3f5d870 Компред LADA × Рынок Пацана: 10 разделов на ките; кит 0.2 — пропуск под число, сопоставление, плашка с ценой, широкая глава + три мобильные починки
adb0eab Компред для АвтоВАЗа: скелет закрытой страницы на ките + локальный просмотр /avtovaz/
7d67548 Журнал деплоя: 6e1b17d
```

**На сервер отправлено файлов:** 113, удалено: 111
```
.htaccess
analytics.js
hero-scene.html
index.html
llms.txt
privacy.html
robots.txt
sitemap.xml
styles.css
api/ai.php
assets/fonts/fonts.css
assets/fonts/onest-400-cyrillic-ext.woff2
assets/fonts/onest-400-cyrillic.woff2
assets/fonts/onest-400-latin-ext.woff2
assets/fonts/onest-400-latin.woff2
assets/fonts/onest-500-cyrillic-ext.woff2
assets/fonts/onest-500-cyrillic.woff2
assets/fonts/onest-500-latin-ext.woff2
assets/fonts/onest-500-latin.woff2
assets/fonts/onest-600-cyrillic-ext.woff2
assets/fonts/onest-600-cyrillic.woff2
assets/fonts/onest-600-latin-ext.woff2
assets/fonts/onest-600-latin.woff2
assets/fonts/onest-700-cyrillic-ext.woff2
assets/fonts/onest-700-cyrillic.woff2
assets/fonts/onest-700-latin-ext.woff2
assets/fonts/onest-700-latin.woff2
assets/fonts/roboto-mono-400-cyrillic-ext.woff2
assets/fonts/roboto-mono-400-cyrillic.woff2
assets/fonts/roboto-mono-400-latin-ext.woff2
assets/fonts/roboto-mono-400-latin.woff2
assets/fonts/roboto-mono-500-cyrillic-ext.woff2
assets/fonts/roboto-mono-500-cyrillic.woff2
assets/fonts/roboto-mono-500-latin-ext.woff2
assets/fonts/roboto-mono-500-latin.woff2
assets/fonts/unbounded-400-cyrillic-ext.woff2
assets/fonts/unbounded-400-cyrillic.woff2
assets/fonts/unbounded-400-latin-ext.woff2
assets/fonts/unbounded-400-latin.woff2
assets/fonts/unbounded-500-cyrillic-ext.woff2
…и ещё 73
```


## 2026-08-12 19:08 — hybrid-v8 @ 6e1b17d

**Коммиты в этой поставке**
```
6e1b17d Журнал деплоя: 882f8c0
```

**На сервер отправлено файлов:** 0, удалено: 0



## 2026-08-12 13:27 — hybrid-v8 @ 882f8c0

**Коммиты в этой поставке**
```
882f8c0 Мобильный полёт: руль вдвое мягче, камера держит корабль в кадре
95bb4b3 Журнал деплоя: 9c9fba3
```

**На сервер отправлено файлов:** 2, удалено: 0
```
hero-scene.html
index.html
```


## 2026-08-12 13:03 — hybrid-v8 @ 9c9fba3

**Коммиты в этой поставке**
```
9c9fba3 Игра: новый руль
a651f99 Руль = скорость: углы достижимы; аудит — чистка онбординга при выходе
bf4662c Журнал деплоя: 9af21b4
```

**На сервер отправлено файлов:** 18, удалено: 0
```
hero-scene.html
index.html
sitemap.xml
api/README.md
api/ai.php
digital/
digital/digital.css
digital/digital.js
digital/index.html
digital/assets/
digital/assets/complex-loop.mp4
digital/assets/complex.jpg
digital/assets/virtual-event-loop.mp4
digital/assets/virtual-event.jpg
digital/assets/youth-loop.mp4
digital/assets/youth.jpg
kit/js/catalog.js
kit/js/reveal-cursor.js
```


## 2026-08-11 18:13 — hybrid-v8 @ 9af21b4

**Коммиты в этой поставке**
```
9af21b4 Игра: старт без рывков
f16b978 Старт полёта на мобиле — через затемнение; подсказка печатается у кольца; руль мягче
757c41a Конструктор презентационных страниц site/kit и навык для новых чатов
fcd1124 Журнал деплоя: c35d432
```

**На сервер отправлено файлов:** 5, удалено: 0
```
hero-scene.html
index.html
kit/catalog.html
kit/js/hotspots.js
kit/js/lists.js
```


## 2026-08-11 17:49 — hybrid-v8 @ c35d432

**Коммиты в этой поставке**
```
c35d432 Игра: производительность и онбординг
48ff1c3 Онбординг: неуязвимость без мигания, один джойстик, приборы после корабля
afcf6b2 Журнал деплоя: 9644b52
```

**На сервер отправлено файлов:** 12, удалено: 0
```
hero-scene.html
index.html
kit/KIT.md
kit/catalog.html
kit/new-page.py
kit/assets/demo/
kit/assets/demo/frame-xray.webp
kit/assets/demo/frame.webp
kit/assets/demo/logo.webp
kit/assets/demo/motion.mp4
kit/assets/demo/portrait.webp
kit/js/catalog.js
```


## 2026-08-11 17:31 — hybrid-v8 @ 9644b52

**Коммиты в этой поставке**
```
9644b52 Игра: онбординг и приборы
59bbcad Журнал деплоя: f48ee88
```

**На сервер отправлено файлов:** 22, удалено: 0
```
kit/
kit/blocks.json
kit/assets/
kit/css/
kit/css/animations.css
kit/css/components.css
kit/css/layout.css
kit/css/scrub.css
kit/css/typography.css
kit/js/
kit/js/ball.js
kit/js/boot.js
kit/js/courts.js
kit/js/hotspots.js
kit/js/lists.js
kit/js/nav.js
kit/js/parallax.js
kit/js/reveal-cursor.js
kit/js/scrub.js
kit/js/ui.js
kit/js/xray.js
kit/parts/
```


## 2026-08-11 17:22 — hybrid-v8 @ f48ee88

**Коммиты в этой поставке**
```
f48ee88 Журнал деплоя: 047896a
```

**На сервер отправлено файлов:** 0, удалено: 0



## 2026-08-11 17:20 — hybrid-v8 @ 047896a

**Коммиты в этой поставке**
```
047896a Игра: онбординг и приборы
9d7fb62 Аналитика и SEO: GA4 (G-8L3XFCPG2V) + Метрика (111509723) с событиями воронки, обогащённый JSON-LD, llms.txt с услугами, файлы верификации GSC и Вебмастера
38c8f8e Журнал деплоя: 8d85210
```

**На сервер отправлено файлов:** 39, удалено: 0
```
analytics.js
googlef6f357af5bf896e5.html
hero-scene.html
index.html
llms.txt
robots.txt
sitemap.xml
yandex_c3a5c35e56115302.html
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

