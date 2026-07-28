// Генерация чанков вне основного потока (ТЗ §20). Тяжёлое здесь — сэмплинг
// поверхности: даже с кэшем крупной формы это 35–55 мс на ближний чанк, а в кадре
// столько нельзя. Готовые TypedArray уходят обратно с transfer (без копирования),
// главный поток только заливает их в GPU.
importScripts('world.js');

let MGR = null;

self.onmessage = function (e) {
  const m = e.data;
  if (m.cmd === 'init') {
    MGR = self.PDWorld.makeManager(m.seed, m.count);
    // план отдаём сразу: по нему главный поток знает границы чанков и может
    // считать окно стриминга, не дожидаясь геометрии
    self.postMessage({ cmd: 'plan', plan: MGR.plan.map(function (c) {
      return { id: c.id, index: c.index, type: c.type, seed: c.seed, phase: c.phase,
               length: c.length, zStart: c.zStart, zEnd: c.zEnd,
               difficulty: c.difficulty, risk: c.risk, corridorW: c.corridorW };
    }), routeLength: MGR.route.length });
    return;
  }
  if (m.cmd === 'chunk') {
    if (!MGR) return;
    const ch = MGR.build(m.index, m.lod);
    self.postMessage({
      cmd: 'chunkReady', index: m.index, lod: m.lod,
      positions: ch.positions, colors: ch.colors, sizes: ch.sizes, featureMask: ch.featureMask,
      // коллизия и коридор — обычные объекты, они мелкие
      colliders: ch.colliders, corridor: ch.corridor.map(function (p) {
        return { t: p.t, x: p.x, y: p.y, z: p.z, r: p.r };
      }),
      valid: ch.valid.ok, fallback: !!ch.fallback, stats: ch.stats
    }, [ch.positions.buffer, ch.colors.buffer, ch.sizes.buffer, ch.featureMask.buffer]);
  }
};
