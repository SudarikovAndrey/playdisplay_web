// PD_LOOK — ЕДИНЫЙ рендер точечного лука, версия «минимум ручек» (05.08).
// Урок первого конструктора: полсотни настроек дают непредсказуемый лук и три
// разные картинки в лабе, ангаре и полёте. Здесь ручек десяток, и КАЖДАЯ делает
// одну видимую вещь. Модуль подключают и look-lab.html (конструктор), и игра —
// один шейдер, одни формулы, расходиться нечему.
//
//   const ship = PD_LOOK.make(data, params);
//   scene.add(ship.group);
//   ship.set(params);                    // живое применение ручек, без пересборки
//   ship.uniforms.uPx.value = высотаВьюпортаCSS;   // раз в кадр/resize
//
// data — готовые буферы (их собирает конструктор или игра из своих файлов):
//   pos   Float32Array n×3  — точки равномерно по поверхности
//   edge  Float32Array n×3  — ТА ЖЕ точка, притянутая к ближайшей грани полигона:
//                             ползунок «стягивание» просто смешивает pos↔edge
//   nor   Float32Array n×3  — нормали (свет, изнанка, fresnel)
//   role  Float32Array n    — 1 = точка лежит на грани (ярче и в цвете контура)
//   rand  Float32Array n    — детерминированный хеш точки (дитеринг)
//   lines Float32Array m×6  — отрезки граней для слоя линий (может быть пустым)
//   half  число             — полугабарит в юнитах, cell — шаг сетки (для заслона)
//
// params (все — ползунки конструктора, один в один):
//   hue 0..360   — ЕДИНСТВЕННАЯ цветовая ручка: из неё считаются цвет контура,
//                  заливки и цвет fresnel-кромки (сосед по кругу, +40°)
//   sizePm       — размер точки в ‰ полугабарита (одинаково читается на корабле
//                  в 3 юнита и на крейсере в 300)
//   pxMin, pxMax — пиксельные границы точки: мельче не тает, крупнее не пухнет
//   pull 0..1    — стягивание точек к граням (0 равномерно, 1 все на гранях)
//   xray 0..1    — яркость обратной, невидимой стороны формы
//   fres 0..2    — fresnel: светящаяся кромка на касательных углах
//   light 0..1   — ламберт по нормали (объём граней)
//   lineOp 0..1  — яркость линий граней
//   expo 0.2..3  — экспозиция, общий множитель яркости
//   edgeBright   — во сколько раз точки граней ярче заливки (по умолчанию 2)
(function (root) {
'use strict';

let _tex = null;
function softTex() {
  if (_tex) return _tex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.9)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  _tex = new THREE.CanvasTexture(c);
  return _tex;
}

// один оттенок → три цвета. HSL руками: THREE.Color.setHSL зависит от
// color-management настроек three, а тут нужна стабильная математика.
function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => {
    t = ((t % 1) + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return new THREE.Color(f(h + 1 / 3), f(h), f(h - 1 / 3));
}
function paletteOf(hue) {
  return {
    edge: hsl(hue, 0.85, 0.62),          // контур: сочный, светлый
    fill: hsl(hue, 0.45, 0.30),          // заливка: тот же тон, глуше и темнее
    rim:  hsl(hue + 40, 0.9, 0.6)        // fresnel-кромка: сосед по кругу — живее
  };
}

const VERT = `
  attribute vec3 aEdge;
  attribute vec3 aNormal;
  attribute float aRole, aRand;
  uniform float uPx, uPull, uXray, uSizeW, uEdgeBright, uPxMin, uPxMax;
  uniform float uFres, uLightK, uExpo, uOp;
  uniform float uPass, uOcclSz, uOcclBias;
  uniform vec3 uColEdge, uColFill, uColRim, uLightDir;
  varying vec3 vCol; varying float vA;
  void main() {
    // СТЯГИВАНИЕ: точка живёт на отрезке между «своим» местом на поверхности и
    // проекцией на ближайшую грань. Один mix — весь эффект.
    vec3 p = mix(position, aEdge, uPull);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float d = -mv.z;
    vec3 nw = normalize(mat3(modelViewMatrix) * aNormal);
    vec3 toEye = normalize(-mv.xyz);
    float facing = dot(nw, toEye);

    // ИЗНАНКА: отвёрнутые точки не исчезают, а гаснут до uXray
    float vis = mix(uXray, 1.0, smoothstep(-0.16, 0.24, facing));

    // ОБЪЁМ: обычный ламберт; свет прибит к камере — корабль вертится, свет нет
    float lam = max(0.0, dot(nw, uLightDir));
    float br = mix(1.0, 0.35 + 1.25 * lam * lam, uLightK);

    // FRESNEL: кромка на касательных углах, светит своим цветом
    float rim = pow(1.0 - abs(facing), 2.5) * uFres;

    vec3 col = mix(uColFill, uColEdge, aRole);
    br *= mix(1.0, uEdgeBright, aRole);
    col += uColRim * rim;
    br *= 0.85 + 0.3 * aRand;            // дитеринг: точки чуть разные, картинка живая
    vCol = col * br * uExpo;
    vA = clamp(br, 0.0, 1.8) * vis * uOp;

    // заслон пишет глубину чуть дальше настоящей, иначе точка не проходит
    // собственный тест глубины и модель исчезает целиком
    vec4 mvo = mv;
    if (uPass > 0.5) mvo.z -= uOcclBias;
    gl_Position = projectionMatrix * mvo;
    float px = clamp(uSizeW * uPx * 0.5 / max(d, 0.001), uPxMin, uPxMax);
    if (uPass > 0.5) px *= uOcclSz;
    gl_PointSize = px * step(0.004, vA);
  }`;

const FRAG = `
  uniform sampler2D uTex;
  varying vec3 vCol; varying float vA;
  void main() {
    float a = texture2D(uTex, gl_PointCoord).a * vA;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vCol, a);
  }`;

const FRAG_OCCL = `
  uniform sampler2D uTex;
  varying vec3 vCol; varying float vA;
  void main() {
    if (texture2D(uTex, gl_PointCoord).a * vA < 0.5) discard;
    gl_FragColor = vec4(0.0);
  }`;

const DEFAULTS = {
  hue: 18, sizePm: 6, pxMin: 1, pxMax: 22, pull: 0.35, xray: 0.1,
  fres: 0.7, light: 0.65, lineOp: 0.22, expo: 1, edgeBright: 2, occl: true
};

function make(data, params) {
  const P = Object.assign({}, DEFAULTS, params || {});
  const n = data.pos.length / 3;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(data.pos, 3));
  g.setAttribute('aEdge', new THREE.BufferAttribute(data.edge, 3));
  g.setAttribute('aNormal', new THREE.BufferAttribute(data.nor, 3));
  g.setAttribute('aRole', new THREE.BufferAttribute(data.role, 1));
  g.setAttribute('aRand', new THREE.BufferAttribute(data.rand, 1));

  const uni = {
    uTex: { value: softTex() },
    uPx: { value: (typeof innerHeight !== 'undefined') ? innerHeight : 800 },
    uPull: { value: 0 }, uXray: { value: 0 }, uSizeW: { value: 1 },
    uEdgeBright: { value: 2 }, uPxMin: { value: 1 }, uPxMax: { value: 22 },
    uFres: { value: 0 }, uLightK: { value: 0 }, uExpo: { value: 1 }, uOp: { value: 1 },
    uOcclSz: { value: 1.6 }, uOcclBias: { value: (data.cell || data.half / 60) * 1.6 },
    uColEdge: { value: new THREE.Color() }, uColFill: { value: new THREE.Color() },
    uColRim: { value: new THREE.Color() },
    // свет в координатах камеры: сверху-справа-спереди, наклон подобран глазами
    uLightDir: { value: new THREE.Vector3(0.45, 0.62, 0.64).normalize() }
  };
  const hullMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({}, uni, { uPass: { value: 0 } }),
    transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending, vertexShader: VERT, fragmentShader: FRAG
  });
  const occlMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({}, uni, { uPass: { value: 1 } }),
    transparent: false, depthWrite: true, depthTest: true, blending: THREE.NoBlending,
    colorWrite: false, vertexShader: VERT, fragmentShader: FRAG_OCCL
  });

  const group = new THREE.Group();
  const occl = new THREE.Points(g, occlMat);
  occl.frustumCulled = false; occl.renderOrder = -1;
  group.add(occl);
  const hull = new THREE.Points(g, hullMat);
  hull.frustumCulled = false; hull.renderOrder = 0;
  group.add(hull);

  let lines = null;
  if (data.lines && data.lines.length) {
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(data.lines, 3));
    lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({
      transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
      depthWrite: false, depthTest: true }));
    lines.frustumCulled = false; lines.renderOrder = 1;
    group.add(lines);
  }

  const obj = { group: group, hull: hull, occl: occl, lines: lines,
                geometry: g, uniforms: uni, half: data.half, count: n, params: P };
  obj.set = function (p) {
    Object.assign(P, p || {});
    const pal = paletteOf(P.hue);
    uni.uColEdge.value.copy(pal.edge);
    uni.uColFill.value.copy(pal.fill);
    uni.uColRim.value.copy(pal.rim);
    uni.uSizeW.value = P.sizePm / 1000 * data.half;   // ‰ полугабарита → юниты
    uni.uPxMin.value = Math.min(P.pxMin, P.pxMax);
    uni.uPxMax.value = Math.max(P.pxMin, P.pxMax);
    uni.uPull.value = P.pull;
    uni.uXray.value = P.xray;
    uni.uFres.value = P.fres;
    uni.uLightK.value = P.light;
    uni.uExpo.value = P.expo;
    uni.uEdgeBright.value = P.edgeBright;
    occl.visible = !!P.occl;
    if (lines) {
      lines.visible = P.lineOp > 0.005;
      lines.material.opacity = P.lineOp;
      lines.material.color.copy(pal.edge);
    }
    return obj;
  };
  obj.set(P);
  return obj;
}

root.PD_LOOK = { make: make, paletteOf: paletteOf, hsl: hsl, softTex: softTex, DEFAULTS: DEFAULTS };

})(typeof self !== 'undefined' ? self : this);
