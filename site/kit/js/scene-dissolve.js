/* РАСТВОРЕНИЕ ПЕРЕДНЕГО ПЛАНА В 3D-СЦЕНЕ (Three.js).
 *
 * Задача: показать предмет внутри помещения (машину в гараже, экспонат в зале, стенд в
 * павильоне) так, чтобы камера ходила вокруг него на все 360°, а стены не закрывали обзор.
 *
 * Два очевидных решения не годятся:
 *   • ограничить угол поворота — отбирает у человека главное действие, ради которого сцена
 *     и делалась;
 *   • спрятать стены совсем — тогда пропадает место действия, и предмет висит в пустоте.
 *
 * Здесь третье: всё, что оказалось МЕЖДУ КАМЕРОЙ И ПРЕДМЕТОМ, рассыпается в пыль, а стоит
 * камере уйти — собирается обратно. Помещение видно всегда, предмет не перекрывается никогда.
 *
 * КАК УСТРОЕНО. У материала помещения подменяется фрагментный шейдер: считается глубина
 * фрагмента в координатах камеры, и если она МЕНЬШЕ порога — пиксель отбрасывается.
 *
 * ЧЕТЫРЕ ВЕЩИ, КОТОРЫЕ ЗДЕСЬ ВАЖНЫ (все выяснены на живой сцене):
 *
 * 1. НЕ ПРОЗРАЧНОСТЬ, А ОТБРАСЫВАНИЕ ПИКСЕЛЕЙ. Первая версия делала стены полупрозрачными
 *    (`transparent = true`, `depthWrite = false`). У прозрачных поверхностей своя очередь
 *    отрисовки, и пол гаража лёг белёсой плёнкой ПОВЕРХ колёс. При отбрасывании глубина
 *    остаётся честной, сортировать нечего.
 *
 * 2. ПОРОГ ИДЁТ ЗА КАМЕРОЙ. С постоянным порогом камера отъезжает — и между ней и предметом
 *    оказывается колонна, которая уже дальше порога: кадр перекрыт наглухо. Правильное
 *    значение — расстояние до предмета минус его радиус, пересчитывается каждый кадр.
 *
 * 3. ПОЛ НЕ РАССЫПАЕМ. Он лежит ниже линии взгляда и обзору не мешает, а рассыпающийся под
 *    предметом пол читается как брак картинки. Отсекается по мировой высоте (`floorY`).
 *
 * 4. ШУМ, А НЕ РОВНАЯ ГРАНИЦА. Порог сравнивается со случайным числом от координаты пикселя:
 *    получается пылевое рассыпание. Ровный порог дал бы «стеклянный срез» — видно, что это
 *    приём, а не свойство мира.
 *
 * ПРИМЕНЕНИЕ:
 *     kitDissolve.patch(material, { floorY: 0.4 });      // на каждый материал помещения
 *     kitDissolve.setFade(dist - radius, band);          // каждый кадр, до render()
 */
(function (global) {
  'use strict';

  // Юниформы общие для всех материалов помещения: порог у сцены один.
  var uniforms = {
    uFade: { value: 3.0 },     // ближе этой глубины — рассыпаем
    uBand: { value: 0.8 },     // ширина перехода: сразу или мягко
    uFloorY: { value: 0.0 }    // ниже этой мировой высоты не рассыпаем никогда
  };

  function patch(material, opts) {
    opts = opts || {};
    if (opts.floorY !== undefined) uniforms.uFloorY.value = opts.floorY;

    material.transparent = false;   // см. пункт 1 в шапке файла
    material.depthWrite = true;
    if (opts.doubleSide !== false) material.side = 2; // THREE.DoubleSide: изнутри видна изнанка стен

    material.onBeforeCompile = function (shader) {
      shader.uniforms.uFade = uniforms.uFade;
      shader.uniforms.uBand = uniforms.uBand;
      shader.uniforms.uFloorY = uniforms.uFloorY;

      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'varying float vViewDepth;\nvarying float vWorldY;\nvoid main() {')
        .replace('#include <project_vertex>',
                 '#include <project_vertex>\nvViewDepth = -mvPosition.z;\nvWorldY = (modelMatrix * vec4(transformed, 1.0)).y;');

      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', [
          'uniform float uFade;',
          'uniform float uBand;',
          'uniform float uFloorY;',
          'varying float vViewDepth;',
          'varying float vWorldY;',
          /* Шум по координате пикселя: узор мелкий и в движении не «плывёт» по стене */
          'float kitDissolveHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }',
          'void main() {',
          '  float kitKeep = smoothstep(uFade, uFade + uBand, vViewDepth);',
          '  if (vWorldY > uFloorY && kitKeep < kitDissolveHash(gl_FragCoord.xy)) discard;'
        ].join('\n'));
    };
    material.needsUpdate = true;
    return material;
  }

  /* Вызывать каждый кадр: fade = расстояние от камеры до предмета минус его радиус. */
  function setFade(fade, band) {
    uniforms.uFade.value = Math.max(0.2, fade);
    if (band !== undefined) uniforms.uBand.value = band;
  }

  function setFloor(y) { uniforms.uFloorY.value = y; }

  global.kitDissolve = { patch: patch, setFade: setFade, setFloor: setFloor, uniforms: uniforms };
})(window);
