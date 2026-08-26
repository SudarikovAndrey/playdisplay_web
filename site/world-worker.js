// Генерация чанков вне основного потока (ТЗ §20). Тяжёлое здесь — сэмплинг
// поверхности: даже с кэшем крупной формы это 35–55 мс на ближний чанк, а в кадре
// столько нельзя. Готовые TypedArray уходят обратно с transfer (без копирования),
// главный поток только заливает их в GPU.
// ВЕРСИЯ ОБЯЗАТЕЛЬНА (24.08.2026). Сам воркер создаётся с ?v=PD_V, а world.js внутри
// грузился БЕЗ версии — на боевом статику отдаёт nginx с кэшем на год, и телефон мог
// держать прошлогодний world.js в воркере при свежем в главном потоке. План трассы
// у них строится каждым по своей копии: разойдутся — коллизия (probe в главном) будет
// мерить один мир, а на экране (точки из воркера) стоять другой. Подхватываем ту же
// строку версии из адреса самого воркера.
importScripts('world.js' + (self.location.search || ''));

let MGR = null;

self.onmessage = function (e) {
  const m = e.data;
  if (m.cmd === 'init') {
    // Плотность приходит от главного потока: у воркера СВОЯ копия world.js со своим
    // CONFIG, и если её не синхронизировать, поток посчитает геометрию другой
    // плотности, чем ожидает игра (и чем даёт probe для коллизии).
    // База — дефолт модуля, не число здесь: захардкоженный 0.53 однажды молча
    // перетёр обновлённую плотность world.js.
    if (m.dens) {
      const D = self.PDWorld.CONFIG.density;
      if (self.__densBase0 === undefined) { self.__densBase0 = D.base; self.__densBudget0 = D.budget; }
      D.base = self.__densBase0 / Math.sqrt(m.dens);
      D.budget = Math.round(self.__densBudget0 * m.dens);
    }
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
    // Пространственный индекс точек уходит вместе с геометрией: по нему главный
    // поток каждый кадр ищет окрестность корабля для подсветки опасности. Пересчитать
    // его на месте — это снова обход всех точек, то есть тот самый рывок, от которого
    // мы и ушли в поток. Его типизированные массивы тоже отдаём с transfer.
    const ix = ch.index;
    self.postMessage({
      cmd: 'chunkReady', index: m.index, lod: m.lod,
      positions: ch.positions, colors: ch.colors, sizes: ch.sizes, featureMask: ch.featureMask,
      pointIndex: ix ? { cell: ix.cell, minX: ix.minX, z0: ix.z0, cols: ix.cols, rows: ix.rows,
                         start: ix.start, items: ix.items } : null,
      // коллизия и коридор — обычные объекты, они мелкие. floor/ceil нужны игре
      // для наград на разных высотах (низко у дна провала / высоко над трассой)
      colliders: ch.colliders, corridor: ch.corridor.map(function (p) {
        return { t: p.t, x: p.x, y: p.y, z: p.z, r: p.r, floor: p.floor, ceil: isFinite(p.ceil) ? p.ceil : null };
      }),
      valid: ch.valid.ok, fallback: !!ch.fallback, stats: ch.stats
    }, ix ? [ch.positions.buffer, ch.colors.buffer, ch.sizes.buffer, ch.featureMask.buffer,
             ix.start.buffer, ix.items.buffer]
          : [ch.positions.buffer, ch.colors.buffer, ch.sizes.buffer, ch.featureMask.buffer]);
  }
};
