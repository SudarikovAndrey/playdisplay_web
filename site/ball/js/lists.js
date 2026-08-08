/* ЖИВАЯ ПОДАЧА ПЕРЕЧИСЛЕНИЙ.
 *
 * В книге пятнадцать списков, и все выглядели одинаково: строка, тонкая линия, стрелка.
 * Смысл читался, но глаз уставал, а разные по природе перечисления — этапы пути,
 * набор зон, перечень номинаций — подавались одним приёмом.
 *
 * Разбор идёт по содержанию, а не по разметке, и ничего не переписывает:
 *   • пункты начинаются с «1.», «2.» … → это ПУТЬ. Номер вынимается в крупную цифру,
 *     пункты соединяются линией — читается как последовательность шагов;
 *   • четыре и больше коротких пунктов → это НАБОР. Раскладываем карточками с мелким
 *     индексом: видно объём и легко сравнивать;
 *   • два-три длинных пункта → оставляем как есть, там важнее сама фраза.
 *
 * Текст пунктов не меняется ни на символ: у шагов номер лишь переезжает из строки в
 * отдельный элемент, всё остальное — тот же узел. Появление — по одному, вслед за
 * прокруткой, поэтому длинные перечни не сваливаются на читателя разом.
 */
(function () {
  var lists = document.querySelectorAll('.clean-list');
  if (!lists.length) return;

  var STEP = /^\s*(\d{1,2})\s*[.)]\s+/;      // «1. » или «1) »

  Array.prototype.forEach.call(lists, function (ul) {
    var items = ul.querySelectorAll(':scope > li');
    if (!items.length) return;

    var numbered = true, longest = 0;
    Array.prototype.forEach.call(items, function (li) {
      if (!STEP.test(li.textContent)) numbered = false;
      longest = Math.max(longest, li.textContent.trim().length);
    });

    // одиночный нумерованный пункт — это не список, а опора раздела: в главе
    // «Продуктовая рамка» их четыре, каждая со своим пояснением ниже
    if (numbered && items.length === 1) {
      ul.classList.add('clean-list--pillar');
      var li0 = items[0];
      var w0 = document.createTreeWalker(li0, NodeFilter.SHOW_TEXT, null), n0;
      while ((n0 = w0.nextNode())) {
        var m0 = STEP.exec(n0.nodeValue);
        if (m0) { n0.nodeValue = n0.nodeValue.slice(m0[0].length);
                  var b0 = document.createElement('b');
                  b0.className = 'pillar-num';
                  b0.textContent = m0[1];
                  li0.insertBefore(b0, li0.firstChild);
                  break; }
      }
    } else if (numbered && items.length > 1) {
      ul.classList.add('clean-list--steps');
      Array.prototype.forEach.call(items, function (li) {
        // номер вынимаем в отдельный элемент, сам текст не трогаем
        var walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT, null), n;
        while ((n = walker.nextNode())) {
          var m = STEP.exec(n.nodeValue);
          if (m) { n.nodeValue = n.nodeValue.slice(m[0].length);
                   var b = document.createElement('b');
                   b.className = 'step-num';
                   b.textContent = m[1];
                   li.insertBefore(b, li.firstChild);
                   break; }
        }
      });
    } else if (items.length >= 4 && longest <= 130) {
      ul.classList.add('clean-list--cards');
      Array.prototype.forEach.call(items, function (li, k) {
        var s = document.createElement('b');
        s.className = 'card-num';
        s.textContent = (k + 1 < 10 ? '0' : '') + (k + 1);
        li.insertBefore(s, li.firstChild);
      });
    } else {
      ul.classList.add('clean-list--plain');
    }

    // появление по одному: длинный перечень не должен падать на читателя сразу
    if (window.IntersectionObserver) {
      Array.prototype.forEach.call(items, function (li, k) {
        li.style.transitionDelay = Math.min(k * 55, 480) + 'ms';
      });
      new IntersectionObserver(function (es, obs) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          e.target.classList.add('is-in');
          obs.unobserve(e.target);
        });
      }, { rootMargin: '0px 0px -12% 0px' }).observe(ul);
    } else {
      ul.classList.add('is-in');
    }
  });
})();
