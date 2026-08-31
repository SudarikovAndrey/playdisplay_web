(function () {
  "use strict";

  var script = document.currentScript;
  var scriptUrl = script && script.src ? new URL(script.src, window.location.href) : new URL(window.location.href);
  var attrs = script ? script.dataset : {};

  var config = {
    photo: ((typeof window!=="undefined" && window.matchMedia && window.matchMedia("(orientation: portrait)").matches && attrs.photoPortrait) ? attrs.photoPortrait : (attrs.photo || "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1920&q=80")),
    blur: Number(attrs.blur || 5),
    brightness: Number(attrs.brightness || 0.3),
    rainOpacity: Number(attrs.rainOpacity || 0.88),
    speed: Number(attrs.speed || 0.5),
    zIndex: attrs.zIndex || "0",
    target: attrs.target || "",
    raindropsSrc: attrs.raindropsSrc || new URL("assets/js/raindrops.js", scriptUrl).href
  };

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  function appendStyle() {
    if (document.getElementById("rain-photo-effect-style")) return;

    var style = document.createElement("style");
    style.id = "rain-photo-effect-style";
    style.textContent = [
      ".rain-photo-effect-layer{position:fixed;inset:0;overflow:hidden;pointer-events:none;}",
      ".rain-photo-effect-layer.is-contained{position:absolute;}",
      ".rain-photo-effect-layer img,.rain-photo-effect-layer canvas,.rain-photo-effect-layer .rain-photo-effect-overlay{position:absolute;inset:0;width:100%;height:100%;}",
      ".rain-photo-effect-layer img{object-fit:cover;transform:scale(1.045);}",
      ".rain-photo-effect-layer canvas{display:block;}",
      ".rain-photo-effect-layer .rain-photo-effect-overlay{background:linear-gradient(180deg,rgba(166,213,224,.12),rgba(6,8,12,.36)),radial-gradient(circle at 50% 38%,rgba(255,255,255,.1),transparent 34%);}"
    ].join("");
    document.head.appendChild(style);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-rain-photo-raindrops="true"]');
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        resolve();
        return;
      }

      var el = document.createElement("script");
      el.src = src;
      el.async = true;
      el.dataset.rainPhotoRaindrops = "true";
      el.onload = resolve;
      el.onerror = function () {
        reject(new Error("Could not load raindrops.js: " + src));
      };
      document.body.appendChild(el);
    });
  }

  function createLayer() {
    var target = config.target ? document.querySelector(config.target) : document.body;
    if (!target) target = document.body;

    var contained = target !== document.body;
    if (contained && getComputedStyle(target).position === "static") {
      target.style.position = "relative";
    }

    var layer = document.createElement("div");
    layer.className = "rain-photo-effect-layer" + (contained ? " is-contained" : "");
    layer.style.zIndex = config.zIndex;

    var image = document.createElement("img");
    image.id = "custom-bg";
    image.alt = "";
    /* crossOrigin removed for same-origin canvas */
    image.dataset.rainFilter = "blur(" + config.blur + "px) brightness(" + config.brightness + ")";
    image.style.filter = image.dataset.rainFilter;
    image.src = config.photo;

    var overlay = document.createElement("div");
    overlay.className = "rain-photo-effect-overlay";

    var canvas = document.createElement("canvas");
    canvas.id = "bg-canvas";
    canvas.style.opacity = String(config.rainOpacity);

    layer.appendChild(image);
    layer.appendChild(overlay);
    layer.appendChild(canvas);
    target.prepend(layer);

    return { image: image, canvas: canvas };
  }

  ready(function () {
    appendStyle();

    var nodes = createLayer();
    window.RAINDROPS_SOURCE_IMAGE = nodes.image;
    window.RAINDROPS_SPEED = config.speed;

    function boot() {
      loadScript(config.raindropsSrc).then(function () {
        if (typeof window.__rainSetSpeed === "function") {
          window.__rainSetSpeed(config.speed);
        }
      }).catch(function (error) {
        console.error(error);
      });
    }

    if (nodes.image.complete && nodes.image.naturalWidth > 0) {
      boot();
    } else {
      nodes.image.addEventListener("load", boot, { once: true });
      nodes.image.addEventListener("error", function () {
        console.error("Rain photo effect image failed to load:", config.photo);
      }, { once: true });
    }
  });
})();
