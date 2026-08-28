// 11 проектов playdisplay.com: кадры 16:9 + remote-превью роликов.
//
// КАДРЫ ВЫНЕСЕНЫ В ФАЙЛЫ 28.08.2026. Раньше каждый лежал здесь строкой base64,
// и файл весил 798 КБ — 580 КБ по сети даже в сжатом виде: base64 раздувает
// картинку на треть, а jpeg внутри неё уже сжат и повторно не жмётся.
// Теперь `src` — обычный путь. THREE.TextureLoader принимает его так же, как
// data-URL, но браузер тянет кадры параллельно, кэширует каждый отдельно и не
// держит на них разбор скрипта.
//
// ВАЖНО ЗНАТЬ, ПРЕЖДЕ ЧЕМ ПРАВИТЬ: сами эти кадры на экране не появляются.
// odk_frame.js перезаписывает src у записей 0,1,2,6,9,10 своими версиями 1280×720,
// а записи 3,4,5,7,8 hero-scene выбрасывает целиком — у них нет ролика в
// LOCAL_VIDEO. Файлы work-*.jpg поэтому лежат на диске, но по сети не едут ни разу.
// Они здесь не мусор, а запас: как только у проекта появится клип, запись оживёт.
const WORKS = [
 {
  "title": "ВДНХ Космос",
  "aspect": 1.7778,
  "bg": "#202022",
  "accent": "#a5a5a5",
  "remote": "https://vumbnail.com/397688406.jpg",
  "src": "assets/frames/work-00.jpg"
 },
 {
  "title": "BMW X5",
  "aspect": 1.7778,
  "bg": "#40414a",
  "accent": "#cbd4e1",
  "remote": "https://vumbnail.com/414266169.jpg",
  "src": "assets/frames/work-01.jpg"
 },
 {
  "title": "Стенд МИГ-35",
  "aspect": 1.7778,
  "bg": "#1a303c",
  "accent": "#448ba6",
  "remote": "https://img.youtube.com/vi/YVteDZL90qc/maxresdefault.jpg",
  "src": "assets/frames/work-02.jpg"
 },
 {
  "title": "Панорама 360",
  "aspect": 1.7778,
  "bg": "#555252",
  "accent": "#cc9254",
  "remote": "https://vumbnail.com/412364504.jpg",
  "src": "assets/frames/work-03.jpg"
 },
 {
  "title": "Сталинград",
  "aspect": 1.7778,
  "bg": "#8b4510",
  "accent": "#ffff00",
  "remote": "https://img.youtube.com/vi/IVmCylimRmY/maxresdefault.jpg",
  "src": "assets/frames/work-04.jpg"
 },
 {
  "title": "Синара",
  "aspect": 1.7778,
  "bg": "#6b5236",
  "accent": "#dc7429",
  "remote": "https://img.youtube.com/vi/lfmqw20YzlY/maxresdefault.jpg",
  "src": "assets/frames/work-05.jpg"
 },
 {
  "title": "Сухой порт COALCO",
  "aspect": 1.7778,
  "bg": "#687b89",
  "accent": "#6995b9",
  "remote": "https://img.youtube.com/vi/6ZBMB54713E/maxresdefault.jpg",
  "src": "assets/frames/work-06.jpg"
 },
 {
  "title": "PTK Group",
  "aspect": 1.7778,
  "bg": "#272723",
  "accent": "#b5afa7",
  "remote": "https://vumbnail.com/522723089.jpg",
  "src": "assets/frames/work-07.jpg"
 },
 {
  "title": "Космонавтика и авиация",
  "aspect": 1.7778,
  "bg": "#432d1c",
  "accent": "#4597ab",
  "remote": "https://vumbnail.com/397679197.jpg",
  "src": "assets/frames/work-08.jpg"
 },
 {
  "title": "ОДК",
  "aspect": 1.7778,
  "bg": "#1a435c",
  "accent": "#07e9f0",
  "remote": "https://img.youtube.com/vi/jgoiEkCIfgQ/maxresdefault.jpg",
  "src": "assets/frames/work-09.jpg"
 },
 {
  "title": "Росатом «Прорыв»",
  "aspect": 1.7778,
  "bg": "#1f4874",
  "accent": "#36b2ff",
  "remote": "https://img.youtube.com/vi/bSNki6_F898/maxresdefault.jpg",
  "src": "assets/frames/work-10.jpg"
 }
];
