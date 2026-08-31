/* ============================================================
   BOXING CARTEL — shared data (products + i18n)
   Used by index.html and product.html
   ============================================================ */
const BASE = '';

const PRODUCTS = [
  {
    slug:'essential-hoodie', drop:true, tag:'flagship',
    img:'cat-essential-hoodie.jpg', gallery:['cat-essential-hoodie.jpg'],
    price:'14 900 ₽', sizes:['S','M','L','XL','XXL'],
    cat:{ru:'Худи',en:'Hoodie'},
    name:{ru:'BC Essential Hoodie',en:'BC Essential Hoodie'},
    short:{ru:'Базовое чёрное худи с фирменной надписью.',en:'Essential black hoodie with the brand wordmark.'},
    desc:{ru:'Плотное чёрное худи свободного кроя с лаконичной надписью Boxing Cartel и звездой. База линейки — на каждый день, в зал и на улицу.',en:'A dense black hoodie in a relaxed cut with a minimal Boxing Cartel wordmark and star. The base of the line — for everyday, gym and street.'},
    specs:{ru:['Плотный футер','Свободный крой','Надпись Boxing Cartel · EST. 1995','Плотный капюшон, карман-кенгуру','Цвет: чёрный'],en:['Heavy fleece','Relaxed cut','Boxing Cartel · EST. 1995 print','Structured hood, kangaroo pocket','Colour: black']}
  },
  {
    slug:'faded-tee', drop:true, tag:'new',
    img:'cat-faded-tee.jpg', gallery:['cat-faded-tee.jpg'],
    price:'8 900 ₽', sizes:['S','M','L','XL','XXL'],
    cat:{ru:'Футболка',en:'T-shirt'},
    name:{ru:'BC Faded Tee',en:'BC Faded Tee'},
    short:{ru:'Оверсайз-футболка с эффектом стирки, vintage black.',en:'Washed oversized tee in vintage black.'},
    desc:{ru:'Оверсайз-футболка из плотного хлопка с эффектом винтажной стирки и готической монограммой BC на груди. Характер с первого взгляда.',en:'An oversized heavy-cotton tee with a vintage wash and the gothic BC monogram on the chest. Character at first glance.'},
    specs:{ru:['Плотный хлопок','Винтажная стирка','Оверсайз-крой','Монограмма BC','Цвет: vintage black'],en:['Heavy cotton','Vintage wash','Oversized cut','BC monogram','Colour: vintage black']}
  },
  {
    slug:'legacy-hoodie',
    img:'cat-legacy-hoodie.jpg', gallery:['cat-legacy-hoodie.jpg'],
    price:'15 900 ₽', sizes:['S','M','L','XL','XXL'],
    cat:{ru:'Худи',en:'Hoodie'},
    name:{ru:'BC Legacy Hoodie',en:'BC Legacy Hoodie'},
    short:{ru:'Серое худи с крупной готической монограммой на спине.',en:'Heather-grey hoodie with a large gothic monogram on the back.'},
    desc:{ru:'Светло-серое худи с большой готической монограммой BC на спине и надписью Boxing Cartel. Заметная вещь линейки.',en:'A heather-grey hoodie with an oversized gothic BC monogram on the back and the Boxing Cartel wordmark. A statement piece.'},
    specs:{ru:['Плотный футер','Крупная монограмма BC на спине','Свободный крой','Плотный капюшон','Цвет: heather grey'],en:['Heavy fleece','Large BC monogram on the back','Relaxed cut','Structured hood','Colour: heather grey']}
  },
  {
    slug:'gloves-tee', drop:true,
    img:'cat-gloves-tee.jpg', gallery:['cat-gloves-tee.jpg'],
    price:'8 900 ₽', sizes:['S','M','L','XL','XXL'],
    cat:{ru:'Футболка',en:'T-shirt'},
    name:{ru:'BC Gloves Tee',en:'BC Gloves Tee'},
    short:{ru:'Светлая футболка с принтом перчаток: Unity · Honor · Respect.',en:'Off-white tee with a gloves print: Unity · Honor · Respect.'},
    desc:{ru:'Футболка off-white с графикой боксёрских перчаток и девизом UNITY · HONOR · RESPECT. Светлый акцент к тёмной линейке.',en:'An off-white tee with a boxing-gloves graphic and the UNITY · HONOR · RESPECT motto. A bright accent to the dark line.'},
    specs:{ru:['Плотный хлопок','Принт «перчатки»','Девиз Unity · Honor · Respect','Прямой силуэт','Цвет: off-white'],en:['Heavy cotton','Gloves graphic','Unity · Honor · Respect motto','Straight silhouette','Colour: off-white']}
  },
  {
    slug:'unity-longsleeve', drop:true,
    img:'cat-unity-longsleeve.jpg', gallery:['cat-unity-longsleeve.jpg'],
    price:'9 900 ₽', sizes:['S','M','L','XL','XXL'],
    cat:{ru:'Лонгслив',en:'Longsleeve'},
    name:{ru:'BC Unity Longsleeve',en:'BC Unity Longsleeve'},
    short:{ru:'Чёрный лонгслив с надписями Unity / Honor · Respect на рукавах.',en:'Black long-sleeve with Unity / Honor · Respect down the sleeves.'},
    desc:{ru:'Чёрный лонгслив из плотного хлопка с надписью Boxing Cartel на груди и принтами UNITY и HONOR · RESPECT вдоль рукавов.',en:'A black heavy-cotton long-sleeve with the Boxing Cartel wordmark on the chest and UNITY / HONOR · RESPECT printed down the sleeves.'},
    specs:{ru:['Плотный хлопок','Принты на рукавах','Прямой силуэт','Манжеты в рубчик','Цвет: чёрный'],en:['Heavy cotton','Sleeve prints','Straight silhouette','Ribbed cuffs','Colour: black']}
  },
  {
    slug:'half-zip',
    img:'cat-half-zip.jpg', gallery:['cat-half-zip.jpg'],
    price:'13 900 ₽', sizes:['S','M','L','XL','XXL'],
    cat:{ru:'Полузип',en:'Half-zip'},
    name:{ru:'BC Half Zip',en:'BC Half Zip'},
    short:{ru:'Свитшот на молнии до груди, графит.',en:'Quarter-zip sweatshirt in graphite.'},
    desc:{ru:'Плотный свитшот с молнией до груди и воротником-стойкой, графитовый. Монограмма BC на груди, боковые карманы.',en:'A dense quarter-zip sweatshirt with a stand collar in graphite. BC monogram on the chest, side pockets.'},
    specs:{ru:['Плотный футер','Молния до груди, воротник-стойка','Монограмма BC','Боковые карманы','Цвет: графит'],en:['Heavy fleece','Quarter-zip, stand collar','BC monogram','Side pockets','Colour: graphite']}
  },
  {
    slug:'mesh-shorts',
    img:'cat-mesh-shorts.jpg', gallery:['cat-mesh-shorts.jpg'],
    price:'6 900 ₽', sizes:['S','M','L','XL'],
    cat:{ru:'Шорты',en:'Shorts'},
    name:{ru:'BC Mesh Shorts',en:'BC Mesh Shorts'},
    short:{ru:'Дышащие сетчатые шорты для зала.',en:'Breathable mesh shorts for training.'},
    desc:{ru:'Лёгкие сетчатые шорты с эластичным поясом и монограммой BC. Для бокса, зала и кардио.',en:'Lightweight mesh shorts with an elastic waistband and BC monogram. For boxing, the gym and cardio.'},
    specs:{ru:['Дышащая сетка','Эластичный пояс со шнурком','Монограмма BC','Свободная посадка','Цвет: чёрный'],en:['Breathable mesh','Elastic drawstring waist','BC monogram','Relaxed fit','Colour: black']}
  },
  {
    slug:'sweatpants',
    img:'cat-sweatpants.jpg', gallery:['cat-sweatpants.jpg'],
    price:'10 900 ₽', sizes:['S','M','L','XL','XXL'],
    cat:{ru:'Штаны',en:'Sweatpants'},
    name:{ru:'BC Sweatpants',en:'BC Sweatpants'},
    short:{ru:'Серые джоггеры с фирменной надписью.',en:'Heather-grey joggers with the brand wordmark.'},
    desc:{ru:'Плотные джоггеры свободного кроя с манжетами и надписью Boxing Cartel. Комплект к худи или самостоятельно.',en:'Dense relaxed-fit joggers with cuffs and the Boxing Cartel wordmark. Pair with a hoodie or wear solo.'},
    specs:{ru:['Плотный футер','Свободный крой, манжеты','Эластичный пояс','Надпись Boxing Cartel','Цвет: heather grey'],en:['Heavy fleece','Relaxed fit, cuffs','Elastic waist','Boxing Cartel wordmark','Colour: heather grey']}
  },
  {
    slug:'tank-top',
    img:'cat-tank-top.jpg', gallery:['cat-tank-top.jpg'],
    price:'5 900 ₽', sizes:['S','M','L','XL'],
    cat:{ru:'Майка',en:'Tank top'},
    name:{ru:'BC Tank Top',en:'BC Tank Top'},
    short:{ru:'Чёрная майка с монограммой BC.',en:'Black tank top with the BC monogram.'},
    desc:{ru:'Чёрная майка из плотного хлопка с готической монограммой BC. Для зала, ринга и жаркого сезона.',en:'A black heavy-cotton tank top with the gothic BC monogram. For the gym, the ring and the hot season.'},
    specs:{ru:['Плотный хлопок','Монограмма BC','Прямой крой','Для зала и ринга','Цвет: чёрный'],en:['Heavy cotton','BC monogram','Straight cut','For gym and ring','Colour: black']}
  },
  {
    slug:'tee-unity', drop:true, tag:'new',
    img:'tee-unity-front.png', gallery:['tee-unity-front.png','https://sudarikov.space/boxingcartel/tee-unity-model.png'],
    price:'8 900 ₽', sizes:['M','L','XL'],
    cat:{ru:'Футболка',en:'T-shirt'},
    name:{ru:'Unity Tee',en:'Unity Tee'},
    short:{ru:'Чёрная оверсайз-футболка с малой монограммой BC и крупным принтом на спине.',en:'Black oversized tee with a small BC monogram and a large back print.'},
    desc:{ru:'Плотная чёрная футболка с чистым фронтом: малая готическая монограмма BC на груди и маркировка Boxing Cartel EST. 1995 у низа. На спине — крупный состаренный знак BC и кодекс Unity / Honor / Respect.',en:'A dense black tee with a clean front: a small gothic BC monogram on the chest and Boxing Cartel EST. 1995 mark near the hem. The back carries a large distressed BC mark and the Unity / Honor / Respect code.'},
    specs:{ru:['Премиальный оверсайз-крой','Плотный хлопок 240 г','Малая монограмма BC спереди','Крупный состаренный принт на спине','Кодекс Unity / Honor / Respect'],en:['Premium oversized cut','Heavyweight cotton 240 gsm','Small BC monogram front','Large distressed back print','Unity / Honor / Respect code']}
  },
  {
    slug:'tee-ash-unity', drop:true, tag:'new',
    img:'tee-ash-front.png', gallery:['tee-ash-front.png','tee-ash-back.png','https://sudarikov.space/boxingcartel/tee-ash-model.png'],
    price:'8 900 ₽', sizes:['M','L','XL'],
    cat:{ru:'Футболка',en:'T-shirt'},
    name:{ru:'Ash Unity Tee',en:'Ash Unity Tee'},
    short:{ru:'Светло-серая оверсайз-футболка с малой монограммой BC и крупным принтом на спине.',en:'Light gray oversized tee with a small BC monogram and a large back print.'},
    desc:{ru:'Светло-серая версия Unity Tee: чистый фронт с готической монограммой BC, маркировка Boxing Cartel EST. 1995 у низа и крупный состаренный знак на спине с кодексом Unity / Honor / Respect.',en:'The light gray Unity Tee: clean front with a gothic BC monogram, Boxing Cartel EST. 1995 mark near the hem and a large distressed back mark with the Unity / Honor / Respect code.'},
    specs:{ru:['Премиальный оверсайз-крой','Плотный хлопок 240 г','Светло-серый меланж','Малая монограмма BC спереди','Крупный состаренный принт на спине'],en:['Premium oversized cut','Heavyweight cotton 240 gsm','Light gray melange','Small BC monogram front','Large distressed back print']}
  },
  {
    slug:'bc-mesh-shorts', drop:true, tag:'new',
    img:'mesh-shorts-front.png', gallery:['mesh-shorts-front.png','https://sudarikov.space/boxingcartel/mesh-shorts-back.png','https://sudarikov.space/boxingcartel/mesh-shorts-model.png'],
    price:'6 900 ₽', sizes:['M','L','XL'],
    cat:{ru:'Шорты',en:'Shorts'},
    name:{ru:'BC Mesh Shorts',en:'BC Mesh Shorts'},
    short:{ru:'Чёрные mesh-шорты с вышитой монограммой BC.',en:'Black mesh shorts with an embroidered BC monogram.'},
    desc:{ru:'Лёгкие чёрные шорты из фактурной сетки для тренировок и города. Эластичный пояс со шнурком, боковые разрезы, задние карманы и белая готическая монограмма BC на передней панели.',en:'Lightweight black shorts in textured mesh for training and the city. Elastic drawstring waist, side slits, rear pockets and a white gothic BC monogram on the front panel.'},
    specs:{ru:['Дышащая mesh-ткань','Эластичный пояс со шнурком','Вышитая монограмма BC','Задние прорезные карманы','Боковые разрезы по низу'],en:['Breathable mesh fabric','Elastic drawstring waist','Embroidered BC monogram','Rear welt pockets','Side hem slits']}
  },
  {
    slug:'tee-white-logo', drop:true, tag:'flagship',
    img:'ts1.jpg', gallery:['ts1.jpg','man3.jpg','man6.jpg'],
    price:'8 900 ₽', sizes:['M','L','XL'],
    cat:{ru:'Футболка',en:'T-shirt'},
    name:{ru:'Signature Tee',en:'Signature Tee'},
    short:{ru:'Тёмная футболка с белым лого Boxing Cartel.',en:'Dark tee with the white Boxing Cartel logo.'},
    desc:{ru:'Премиальный оверсайз-крой из плотного хлопка. Чистый силуэт, тяжёлая ткань и белая фирменная надпись на груди — спокойная сила без лишнего шума.',en:'A premium oversized cut in heavy cotton. Clean silhouette, dense fabric and the white wordmark on the chest — quiet strength without noise.'},
    specs:{ru:['Премиальный оверсайз-крой','Плотный хлопок 350–420 г','Белое фирменное лого','Усиленная горловина','Для города, зала и каждого дня'],en:['Premium oversized cut','Heavy cotton 350–420 g','White brand logo','Reinforced neckline','For the city, gym and everyday']}
  },
  {
    slug:'tee-dark-logo',
    img:'tee-dark.jpg', gallery:['tee-dark.jpg','man6.jpg','man3.jpg'],
    price:'8 900 ₽', sizes:['M','L','XL'],
    cat:{ru:'Футболка',en:'T-shirt'},
    name:{ru:'Shadow Tee',en:'Shadow Tee'},
    short:{ru:'Тёмная футболка с тёмным лого — тон в тон.',en:'Dark tee with a tonal, dark-on-dark logo.'},
    desc:{ru:'Тот же премиальный оверсайз, но лого выполнено тон в тон — знак читается только вблизи. Самая сдержанная, «тихая» вещь линейки.',en:'The same premium oversized fit, but with a tonal logo that reads only up close. The quietest piece in the line.'},
    specs:{ru:['Премиальный оверсайз-крой','Плотный хлопок 350–420 г','Тёмное лого тон в тон','Усиленная горловина','Чистый силуэт'],en:['Premium oversized cut','Heavy cotton 350–420 g','Tonal dark-on-dark logo','Reinforced neckline','Clean silhouette']}
  },
  {
    slug:'heavy-hoodie', tag:'new',
    img:'hoody.jpg', gallery:['hoody.jpg','hoody2.jpg','man4.jpg'],
    price:'14 900 ₽', sizes:['52','54','56'],
    cat:{ru:'Худи',en:'Hoodie'},
    name:{ru:'Heavy Hoodie',en:'Heavy Hoodie'},
    short:{ru:'Плотное тёмное худи с фирменным гербом.',en:'A dense dark hoodie with the brand crest.'},
    desc:{ru:'Объёмный силуэт, тяжёлый материал, фирменный герб спереди и надпись на спине. Ключевая вещь линейки: спокойная, плотная, сильная.',en:'An oversized silhouette, heavy fabric, the brand crest on the front and a wordmark on the back. A key piece: calm, dense, strong.'},
    specs:{ru:['Плотный материал','Объёмный оверсайз-крой','Герб спереди, надпись на спине','Плотный капюшон','Усиленные манжеты'],en:['Dense material','Oversized cut','Crest front, wordmark back','Structured hood','Reinforced cuffs']}
  },
  {
    slug:'white-longsleeve',
    img:'ls1.jpg', gallery:['ls1.jpg','ls-model.jpg','man2.jpg'],
    price:'7 900 ₽', sizes:['M','L','XL'],
    cat:{ru:'Лонгслив',en:'Longsleeve'},
    name:{ru:'White Longsleeve',en:'White Longsleeve'},
    short:{ru:'Белый лонгслив с фирменной надписью Boxing Cartel.',en:'White long-sleeve with the Boxing Cartel wordmark.'},
    desc:{ru:'Чистый белый лонгслив из плотного хлопка с лаконичной надписью на груди. Контраст к тёмной линейке — база, которая собирает образ.',en:'A clean white long-sleeve in dense cotton with a minimal chest wordmark. The contrast piece to the dark line.'},
    specs:{ru:['Плотный хлопок','Прямой силуэт','Фирменная надпись на груди','Манжеты в рубчик','На каждый день'],en:['Dense cotton','Straight silhouette','Chest wordmark','Ribbed cuffs','Everyday wear']}
  },
  {
    slug:'bc-cap-black',
    img:'cap-dark.jpg', gallery:['cap-dark.jpg','cap-dark-2.jpg','man6.jpg'],
    price:'4 900 ₽', sizes:['OS'],
    cat:{ru:'Кепка',en:'Cap'},
    name:{ru:'BC Cap Black',en:'BC Cap Black'},
    short:{ru:'Тёмная кепка с готической монограммой BC.',en:'Dark cap with the gothic BC monogram.'},
    desc:{ru:'Чёрная кепка с объёмной вышивкой BC спереди и надписью Boxing Cartel сзади. Держит форму, садится по голове, завершает образ.',en:'A black cap with raised BC embroidery on the front and a Boxing Cartel wordmark on the back. Holds its shape and finishes the look.'},
    specs:{ru:['Вышивка BC спереди','Надпись Boxing Cartel сзади','Регулируемый размер','100% хлопок, усиленный фасад','Цвет: чёрный'],en:['BC embroidery front','Boxing Cartel wordmark back','Adjustable size','100% cotton, reinforced front','Colour: black']}
  },
  {
    slug:'bc-cap-white',
    img:'cap-light.jpg', gallery:['cap-light.jpg','cap-light-back.jpg','cap-light-2.jpg'],
    price:'4 900 ₽', sizes:['OS'],
    cat:{ru:'Кепка',en:'Cap'},
    name:{ru:'BC Cap White',en:'BC Cap White'},
    short:{ru:'Светлая кепка с чёрной монограммой BC.',en:'Light cap with the black BC monogram.'},
    desc:{ru:'Белая версия фирменной кепки: чёрная монограмма BC спереди, надпись Boxing Cartel сзади. Светлый акцент к тёмному гардеробу.',en:'The light version of the signature cap: black BC monogram on the front, Boxing Cartel wordmark on the back. A bright accent to a dark wardrobe.'},
    specs:{ru:['Чёрная монограмма BC','Надпись Boxing Cartel сзади','Регулируемый размер','100% хлопок','Цвет: белый'],en:['Black BC monogram','Boxing Cartel wordmark back','Adjustable size','100% cotton','Colour: white']}
  },
  {
    slug:'duffle-bag',
    img:'bag.jpg', gallery:['bag.jpg','bag2.jpg','bag-model.jpg'],
    price:'9 900 ₽', sizes:['OS'],
    cat:{ru:'Сумка',en:'Bag'},
    name:{ru:'Duffle Bag',en:'Duffle Bag'},
    short:{ru:'Спортивная сумка Boxing Cartel для зала и дороги.',en:'Boxing Cartel duffle for the gym and the road.'},
    desc:{ru:'Вместительная спортивная сумка из плотной влагостойкой ткани с фирменной символикой. Главное отделение на молнии, регулируемый плечевой ремень.',en:'A roomy duffle in durable water-resistant fabric with brand insignia. Zip main compartment and an adjustable shoulder strap.'},
    specs:{ru:['Плотная влагостойкая ткань','Основное отделение на молнии','Регулируемый плечевой ремень','Фирменная символика BC','Цвет: чёрный'],en:['Durable water-resistant fabric','Zip main compartment','Adjustable shoulder strap','BC insignia','Colour: black']}
  },
  {
    slug:'jump-rope',
    img:'rope.jpg', gallery:['rope.jpg','rope-box.jpg'],
    price:'3 900 ₽', sizes:['OS'],
    cat:{ru:'Аксессуар',en:'Accessory'},
    name:{ru:'BC Speed Rope',en:'BC Speed Rope'},
    short:{ru:'Скоростная скакалка Boxing Cartel.',en:'Boxing Cartel speed rope.'},
    desc:{ru:'Скоростная скакалка для бокса и кардио: стальной трос в оплётке, утяжелённые рукояти с накаткой и фирменной символикой BC. Для разминки, выносливости и работы ног.',en:'A speed rope for boxing and cardio: a coated steel cable, weighted knurled handles with BC insignia. For warm-ups, endurance and footwork.'},
    specs:{ru:['Стальной трос в оплётке','Утяжелённые рукояти с накаткой','Скоростные подшипники','Регулируемая длина','Фирменная символика BC'],en:['Coated steel cable','Weighted knurled handles','Speed bearings','Adjustable length','BC insignia']}
  }
];

/* UI strings */
const I18N = {
  ru:{
    ticker:'ПЕРВЫЙ ДРОП 2026 · ДОСТАВКА ПО ВСЕМУ МИРУ · НЕ СЛЕДУЙ. СОЗДАВАЙ. · ЗАСЛУЖИ СВОЙ ЧЁРНЫЙ',
    nav_drop:'Дроп',nav_shop:'Магазин',nav_philo:'Философия',nav_contact:'Контакты',
    hero_eyebrow:'2026 / ПЕРВЫЙ ДРОП',hero_title:'Не следуй.\nСоздавай.',
    hero_text:'Boxing Cartel — монохромный combatwear-бренд. Дисциплина, которую носят в чёрном.',
    hero_slogan:'Дисциплина ринга. Характер улицы.',
    slogan_a:'Дисциплина ринга',slogan_b:'Характер улицы',
    hero_cta1:'Смотреть дроп',hero_cta2:'О бренде',
    drop_eyebrow:'Только что вышло',drop_title:'Новый дроп',see_all:'Вся коллекция →',
    philo_eyebrow:'Философия',philo_title:'Дисциплина\nпревыше таланта',
    philo_p1:'Мы верим, что настоящая сила рождается не во время побед, а в моменты, когда ты остаёшься один на один со своими сомнениями. Каждый удар, каждое повторение — шаг к себе.',
    philo_p2:'Boxing Cartel — это не просто одежда. Это форма характера для тех, кто идёт до конца. Чёрный — наша единственная форма. Бокс — наш кодекс.',
    philo_cta:'В магазин',
    coll_eyebrow:'Капсула 01',coll_title:'Вся коллекция',
    ed1_sub:'OUTERWEAR',ed1_title:'Тяжёлый чёрный',
    ed2_sub:'ESSENTIALS',ed2_title:'Чистый знак',
    news_eyebrow:'Картель',news_title:'Войди в картель',
    news_text:'Дропы, ранний доступ и закрытые релизы. Только для своих.',
    news_ph:'Ваш email',news_btn:'Вступить',news_done:'Спасибо. Вы в списке.',
    foot_about:'Дисциплина. Характер. Братство. Это стиль жизни, а не тренд.',
    foot_shop:'Магазин',foot_info:'Информация',foot_contact:'Контакты',
    cat_tees:'Футболки',cat_hoodies:'Худи',cat_rash:'Рашгарды',cat_caps:'Кепки',
    foot_delivery:'Доставка и оплата',foot_returns:'Возврат',foot_size:'Таблица размеров',
    addr:'Сочи, ул. Энергетиков, 7Б',copyright:'© 2026 Boxing Cartel. Все права защищены.',
    add_cart:'Заказать',order_title:'Заказать товар',order_name:'Ваше имя',order_phone:'Телефон',
    order_size:'Размер',order_send:'Отправить заказ',order_done:'Заказ принят. Мы свяжемся с вами.',
    /* product page */
    pdp_back:'← В магазин',crumb_home:'Главная',crumb_shop:'Магазин',
    pdp_sizes:'Размер',pdp_select:'Выберите размер',pdp_specs:'Характеристики',
    pdp_related:'Рекомендуем',pdp_order:'Заказать',pdp_notfound:'Товар не найден',
    pdp_ships:'Доставка по всему миру · Самовывоз в Сочи'
  },
  en:{
    ticker:'FIRST DROP 2026 · WORLDWIDE SHIPPING · DON’T FOLLOW. FORGE. · EARN YOUR BLACK',
    nav_drop:'Drop',nav_shop:'Shop',nav_philo:'Philosophy',nav_contact:'Contact',
    hero_eyebrow:'2026 / FIRST DROP',hero_title:'Don’t follow.\nForge.',
    hero_text:'Boxing Cartel is an all-black combatwear brand. Discipline you wear in black.',
    hero_slogan:'Discipline of the ring. Character of the street.',
    slogan_a:'Discipline of the ring',slogan_b:'Character of the street',
    hero_cta1:'Shop the drop',hero_cta2:'The brand',
    drop_eyebrow:'Just dropped',drop_title:'New Drop',see_all:'Shop all →',
    philo_eyebrow:'Philosophy',philo_title:'Discipline\nover talent',
    philo_p1:'Real strength is not born in victory. It is forged alone, against your own doubt. Every punch, every rep — a step toward yourself.',
    philo_p2:'Boxing Cartel is not just clothing. It is character, made for those who go all the way. Black is our only uniform. Boxing is our code.',
    philo_cta:'Enter shop',
    coll_eyebrow:'Capsule 01',coll_title:'Full collection',
    ed1_sub:'OUTERWEAR',ed1_title:'Heavy black',
    ed2_sub:'ESSENTIALS',ed2_title:'Clean mark',
    news_eyebrow:'The Cartel',news_title:'Join the cartel',
    news_text:'Drops, early access and private releases. For the inner circle only.',
    news_ph:'Your email',news_btn:'Join',news_done:'Thank you. You’re on the list.',
    foot_about:'Discipline. Character. Brotherhood. A way of life, not a trend.',
    foot_shop:'Shop',foot_info:'Information',foot_contact:'Contact',
    cat_tees:'T-shirts',cat_hoodies:'Hoodies',cat_rash:'Rashguards',cat_caps:'Caps',
    foot_delivery:'Shipping & payment',foot_returns:'Returns',foot_size:'Size guide',
    addr:'Sochi, Energetikov St. 7B',copyright:'© 2026 Boxing Cartel. All rights reserved.',
    add_cart:'Order',order_title:'Order product',order_name:'Your name',order_phone:'Phone',
    order_size:'Size',order_send:'Send order',order_done:'Order received. We’ll be in touch.',
    /* product page */
    pdp_back:'← Back to shop',crumb_home:'Home',crumb_shop:'Shop',
    pdp_sizes:'Size',pdp_select:'Select size',pdp_specs:'Specifications',
    pdp_related:'You may also like',pdp_order:'Order',pdp_notfound:'Product not found',
    pdp_ships:'Worldwide shipping · Pick-up in Sochi'
  }
};
