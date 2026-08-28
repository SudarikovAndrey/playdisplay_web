// Кадры вынесены в файлы 28.08.2026 — см. пояснение в шапке textures.js.
// Здесь лежат ВСЕ восемь кадров, которые реально видит зритель: шесть заменяют
// картинки одноимённых записей textures.js, две добавляют новые проекты.
try {
  var _F = function(i,d){ if (typeof WORKS!=="undefined" && WORKS[i]){ WORKS[i].src=WORKS[i].frame=d; delete WORKS[i].remote; } };
  _F(0,"assets/frames/scene-00.jpg");
  _F(1,"assets/frames/scene-01.jpg");
  _F(2,"assets/frames/scene-02.jpg");
  _F(6,"assets/frames/scene-06.jpg");
  _F(9,"assets/frames/scene-09.jpg");
  _F(10,"assets/frames/scene-10.jpg");
  if (typeof WORKS!=="undefined") {
    WORKS.push({ title:"Аэропорты России", aspect:1.7778, bg:"#1b1f24", accent:"#9fb2c4", src:"assets/frames/scene-11.jpg" });
    WORKS.push({ title:"Ростех", aspect:1.7778, bg:"#14181d", accent:"#c8a24a", src:"assets/frames/scene-12.jpg" });
  }
  // подписи проектов: название / клиент / год (правь здесь)
  var _T = ["ВДНХ Космос","BMW X5","МИГ-35","Панорама 360","Сталинград","Синара","COALCO","PTK Group","Космонавтика","ОДК","Росатом","Аэропорты России","Ростех"];
  var _C = ["ВДНХ","BMW","РСК «МиГ»","PANORAMA360","Музей Победы","СТМ","COALCO","PTK Group","ВДНХ","Ростех · ОДК","Росатом","Аэропорты России","Ростех"];
  var _Y = ["2018","2019","2017","2019","2020","2019","2019","2021","2018","2021","2021","2023","2018"];
  if (typeof WORKS!=="undefined") _T.forEach(function(t,i){ if (WORKS[i]) { WORKS[i].title = t; WORKS[i].client = _C[i]; WORKS[i].year = _Y[i]; } });
} catch (e) {}
