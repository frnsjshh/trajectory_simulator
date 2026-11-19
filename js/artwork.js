(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TrajectoryArtwork = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_ASSETS = Object.freeze({
    aircraft: 'assets/aircraft/courier.svg',
    package: 'assets/package/supply-crate.svg'
  });
  const CLOUD_LAYERS = Object.freeze([
    Object.freeze({ y: 0.2, size: 0.84, speed: 0.13, drift: 2.3, spacing: 0.42, alpha: 0.24, seed: 11 }),
    Object.freeze({ y: 0.29, size: 1.12, speed: 0.23, drift: 3.6, spacing: 0.58, alpha: 0.38, seed: 29 }),
    Object.freeze({ y: 0.39, size: 0.66, speed: 0.34, drift: 5.1, spacing: 0.37, alpha: 0.27, seed: 47 })
  ]);
  const FOREST = createForest(44);

  function createArtwork(options = {}) {
    const ImageConstructor = options.ImageConstructor || (typeof Image === 'function' ? Image : null);
    const paths = { ...DEFAULT_ASSETS, ...options.paths };
    const images = { aircraft: null, package: null };
    const statuses = { aircraft: 'fallback', package: 'fallback' };

    if (ImageConstructor) {
      Object.keys(images).forEach((kind) => {
        try {
          const image = new ImageConstructor();
          images[kind] = image;
          statuses[kind] = 'loading';
          image.onload = () => { statuses[kind] = 'loaded'; };
          image.onerror = () => { statuses[kind] = 'fallback'; };
          image.src = paths[kind];
        } catch (_error) {
          images[kind] = null;
          statuses[kind] = 'fallback';
        }
      });
    }

    return {
      paths: { ...paths },
      getAssetStatus(kind) { return statuses[kind] || 'fallback'; },
      drawEnvironment,
      drawAircraft(ctx, image, x, y, scale, propellerAngle) {
        drawAircraft(ctx, isUsableImage(image) ? image : images.aircraft, x, y, scale, propellerAngle);
      },
      drawPackage(ctx, image, x, y, angle, scale) {
        drawPackage(ctx, isUsableImage(image) ? image : images.package, x, y, angle, scale);
      }
    };
  }

  function drawEnvironment(ctx, width, height, time = 0, scrollPixels = 0) {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#4e9ec4');
    sky.addColorStop(0.39, '#9ccfe0');
    sky.addColorStop(0.73, '#d7e3d4');
    sky.addColorStop(1, '#e8d9ae');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    drawAtmosphericLight(ctx, width, height);
    drawCloudLayers(ctx, width, height, time, scrollPixels);

    const horizon = height * 0.8;
    drawMountainRange(ctx, width, horizon + 3, scrollPixels * 0.075, height * 0.17, '#a0b7ad', 0);
    drawMountainRange(ctx, width, horizon + 6, scrollPixels * 0.14, height * 0.115, '#77968a', 1);
    drawRollingHills(ctx, width, horizon + 4, scrollPixels * 0.31, height * 0.068);
    drawFarForest(ctx, width, horizon + 4, scrollPixels * 0.47);
    drawGround(ctx, width, height, horizon, scrollPixels);
    drawTreeLayer(ctx, width, horizon + 4, scrollPixels * 0.73, 0);
    drawTreeLayer(ctx, width, horizon + 6, scrollPixels, 1);
  }

  function drawAtmosphericLight(ctx, width, height) {
    const glow = ctx.createRadialGradient(width * 0.78, height * 0.13, 1, width * 0.78, height * 0.13, height * 0.48);
    glow.addColorStop(0, 'rgba(255,249,218,.56)');
    glow.addColorStop(0.36, 'rgba(255,247,218,.18)');
    glow.addColorStop(1, 'rgba(255,247,218,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height * 0.7);

    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = '#fff4cf';
    ctx.beginPath();
    ctx.arc(width * 0.78, height * 0.13, Math.max(12, height * 0.033), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCloudLayers(ctx, width, height, time, scrollPixels) {
    CLOUD_LAYERS.forEach((layer, layerIndex) => {
      const base = width * layer.spacing;
      const repeats = Math.max(3, Math.ceil((width + 180) / base));
      const period = base * repeats;
      const travel = scrollPixels * layer.speed + time * layer.drift;
      const shift = getRepeatOffset(travel, period);
      const first = Math.floor((shift - period) / base) - 1;
      const last = Math.ceil((width + shift) / base) + 1;
      for (let index = first; index <= last; index += 1) {
        const cloudIndex = getRepeatOffset(index, repeats);
        const x = index * base - shift + seededValue(cloudIndex, layer.seed) * base * 0.24;
        const size = layer.size * (0.78 + seededValue(cloudIndex, layer.seed + 8) * 0.42);
        const y = height * (layer.y + (seededValue(cloudIndex, layer.seed + 16) - 0.5) * 0.045);
        drawCloud(ctx, x, y, size * Math.max(0.72, width / 900), layer.alpha, layerIndex);
      }
    });
  }

  function drawCloud(ctx, x, y, scale, alpha, layer) {
    const cloudWidth = 77 * scale;
    const cloudHeight = 17 * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#f8fbf2';
    ctx.beginPath();
    ctx.ellipse(x, y, cloudWidth * 0.5, cloudHeight * 0.42, 0, 0, Math.PI * 2);
    ctx.ellipse(x - cloudWidth * 0.25, y - cloudHeight * 0.18, cloudWidth * 0.19, cloudHeight * 0.56, 0, 0, Math.PI * 2);
    ctx.ellipse(x - cloudWidth * 0.05, y - cloudHeight * 0.42, cloudWidth * 0.23, cloudHeight * 0.86, 0, 0, Math.PI * 2);
    ctx.ellipse(x + cloudWidth * 0.2, y - cloudHeight * 0.23, cloudWidth * 0.18, cloudHeight * 0.61, 0, 0, Math.PI * 2);
    ctx.fill();
    if (layer > 0) {
      ctx.globalAlpha = alpha * 0.48;
      ctx.fillStyle = '#d9e8e5';
      ctx.beginPath();
      ctx.ellipse(x, y + cloudHeight * 0.22, cloudWidth * 0.39, cloudHeight * 0.19, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMountainRange(ctx, width, baseline, scrollPixels, amplitude, layer) {
    const period = Math.max(520, width * 0.82);
    const shift = positiveModulo(scrollPixels, period);
    const tones = layer === 0 ? ['#a8c0b9', '#b9cec5'] : ['#78968b', '#8ca99a'];
    const step = 18;
    ctx.save();
    for (let tile = -1; tile * period - shift < width + period; tile += 1) {
      const start = tile * period - shift;
      ctx.fillStyle = tones[(tile + 1) & 1];
      ctx.beginPath();
      ctx.moveTo(start, baseline + 12);
      for (let x = 0; x <= period + step; x += step) {
        const phase = (x / period) * Math.PI * 2;
        const peaks = Math.sin(phase * (layer ? 2 : 1) + 0.45) * 0.38
          + Math.sin(phase * 3.2 + 1.1 + layer) * 0.2
          + Math.abs(Math.sin(phase * 0.62 + 0.2)) * 0.17;
        const notch = Math.pow(Math.max(0, Math.sin(phase * 1.7 + layer * 0.8)), 5) * 0.22;
        ctx.lineTo(start + x, baseline - amplitude * (0.38 + peaks + notch));
      }
      ctx.lineTo(start + period + step, baseline + 14);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawRollingHills(ctx, width, baseline, scrollPixels, amplitude) {
    const period = Math.max(390, width * 0.7);
    const shift = positiveModulo(scrollPixels, period);
    ctx.save();
    ctx.fillStyle = '#64896e';
    for (let tile = -1; tile * period - shift < width + period; tile += 1) {
      const start = tile * period - shift;
      ctx.beginPath();
      ctx.moveTo(start, baseline + 10);
      for (let x = 0; x <= period + 18; x += 18) {
        const phase = x / period * Math.PI * 2;
        const crest = Math.sin(phase + 0.8) * 0.54 + Math.sin(phase * 2.2 + 1.6) * 0.16;
        ctx.lineTo(start + x, baseline - amplitude * (0.58 + crest));
      }
      ctx.lineTo(start + period + 18, baseline + 12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFarForest(ctx, width, baseline, scrollPixels) {
    const period = 660;
    const shift = positiveModulo(scrollPixels, period);
    ctx.save();
    for (let start = -period - shift; start < width + period; start += period) {
      FOREST.forEach((tree) => {
        const x = start + tree.position * period;
        const size = tree.scale * 0.43;
        const treeHeight = (21 + tree.shape * 2.5) * size;
        ctx.fillStyle = tree.foliage % 2 ? '#587e68' : '#527863';
        drawPine(ctx, x, baseline + 1, size, baseline - treeHeight);
      });
    }
    ctx.restore();
  }

  function drawGround(ctx, width, height, groundY, scrollPixels) {
    const gradient = ctx.createLinearGradient(0, groundY, 0, height);
    gradient.addColorStop(0, '#547e61');
    gradient.addColorStop(0.16, '#426b53');
    gradient.addColorStop(0.58, '#365d4c');
    gradient.addColorStop(1, '#294b42');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, groundY, width, height - groundY);

    ctx.save();
    ctx.fillStyle = 'rgba(197,205,142,.44)';
    ctx.beginPath();
    ctx.moveTo(0, groundY + 1);
    ctx.bezierCurveTo(width * 0.26, groundY - 5, width * 0.7, groundY + 5, width, groundY - 1);
    ctx.lineTo(width, groundY + 5);
    ctx.lineTo(0, groundY + 5);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(208,212,153,.22)';
    ctx.lineWidth = 1.5;
    const stripeSpacing = 77;
    const stripeShift = positiveModulo(scrollPixels * 1.15, stripeSpacing);
    for (let x = -stripeSpacing; x < width + stripeSpacing; x += stripeSpacing) {
      const y = height * (0.9 + seededValue(x, 101) * 0.055);
      ctx.beginPath();
      ctx.moveTo(x - stripeShift, y);
      ctx.lineTo(x + 24 - stripeShift, y - 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTreeLayer(ctx, width, baseline, scrollPixels, layer) {
    const period = 1120;
    const speed = layer ? 1 : 0.73;
    const shift = positiveModulo(scrollPixels * speed, period);
    ctx.save();
    for (let start = -period - shift; start < width + period; start += period) {
      FOREST.forEach((tree) => {
        if (tree.layer !== layer) return;
        const x = start + tree.position * period;
        const scale = tree.scale * (layer ? 0.95 : 0.7);
        const height = (layer ? 57 : 43) * scale;
        const treeWidth = (layer ? 23 : 17) * scale;
        ctx.fillStyle = layer ? '#594e3c' : '#695b43';
        ctx.fillRect(x - 1.6 * scale, baseline - height * 0.28, 3.2 * scale, height * 0.3);
        ctx.fillStyle = treeColor(tree.foliage, layer);
        if (tree.shape === 0) drawPine(ctx, x, baseline, scale, baseline - height);
        else if (tree.shape === 1) drawRoundTree(ctx, x, baseline, treeWidth, height * 0.77);
        else if (tree.shape === 2) drawLayeredPine(ctx, x, baseline, treeWidth, height);
        else drawOak(ctx, x, baseline, treeWidth, height);
      });
    }
    ctx.restore();
  }

  function drawPine(ctx, x, baseline, scale, top) {
    const h = Math.max(8, baseline - top);
    ctx.beginPath();
    ctx.moveTo(x, baseline - h);
    ctx.lineTo(x - h * 0.31, baseline - h * 0.47);
    ctx.lineTo(x - h * 0.18, baseline - h * 0.49);
    ctx.lineTo(x - h * 0.39, baseline - h * 0.12);
    ctx.quadraticCurveTo(x, baseline - h * 0.2, x + h * 0.39, baseline - h * 0.12);
    ctx.lineTo(x + h * 0.17, baseline - h * 0.5);
    ctx.lineTo(x + h * 0.3, baseline - h * 0.47);
    ctx.closePath();
    ctx.fill();
  }

  function drawLayeredPine(ctx, x, baseline, width, height) {
    ctx.beginPath();
    ctx.moveTo(x, baseline - height);
    ctx.lineTo(x - width * 0.48, baseline - height * 0.4);
    ctx.lineTo(x - width * 0.2, baseline - height * 0.42);
    ctx.lineTo(x - width * 0.58, baseline - height * 0.08);
    ctx.lineTo(x + width * 0.58, baseline - height * 0.08);
    ctx.lineTo(x + width * 0.2, baseline - height * 0.42);
    ctx.lineTo(x + width * 0.48, baseline - height * 0.4);
    ctx.closePath();
    ctx.fill();
  }

  function drawRoundTree(ctx, x, baseline, width, height) {
    ctx.beginPath();
    ctx.ellipse(x, baseline - height * 0.6, width * 0.7, height * 0.43, 0, 0, Math.PI * 2);
    ctx.ellipse(x - width * 0.42, baseline - height * 0.42, width * 0.48, height * 0.31, 0, 0, Math.PI * 2);
    ctx.ellipse(x + width * 0.42, baseline - height * 0.4, width * 0.52, height * 0.33, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawOak(ctx, x, baseline, width, height) {
    ctx.beginPath();
    ctx.moveTo(x - width * 0.18, baseline - height * 0.24);
    ctx.quadraticCurveTo(x - width * 0.72, baseline - height * 0.36, x - width * 0.56, baseline - height * 0.72);
    ctx.quadraticCurveTo(x - width * 0.46, baseline - height * 1.04, x - width * 0.06, baseline - height * 0.88);
    ctx.quadraticCurveTo(x + width * 0.18, baseline - height * 1.1, x + width * 0.52, baseline - height * 0.82);
    ctx.quadraticCurveTo(x + width * 0.83, baseline - height * 0.53, x + width * 0.36, baseline - height * 0.24);
    ctx.closePath();
    ctx.fill();
  }

  function treeColor(index, layer) {
    const palette = layer
      ? ['#274b3e', '#315744', '#385e48', '#24483b', '#466548']
      : ['#3b664e', '#467354', '#345e49', '#527b58', '#305743'];
    return palette[Math.floor(seededValue(index, layer + 167) * palette.length)];
  }

  function drawAircraft(ctx, image, x, y, scale, propellerAngle = 0) {
    const maxWidth = 106 * scale;
    const maxHeight = 48 * scale;
    ctx.save();
    ctx.shadowColor = 'rgba(25,57,69,.28)';
    ctx.shadowBlur = 7 * scale;
    ctx.shadowOffsetY = 3 * scale;
    if (isUsableImage(image)) {
      drawContainedImage(ctx, image, x, y, maxWidth, maxHeight);
    } else {
      drawFallbackAircraft(ctx, x, y, scale);
    }
    ctx.restore();

    const propX = x + maxWidth * 0.465;
    const propY = y + maxHeight * 0.015;
    ctx.save();
    ctx.translate(propX, propY);
    ctx.rotate(propellerAngle);
    ctx.strokeStyle = 'rgba(23,58,75,.7)';
    ctx.lineWidth = 2.1 * scale;
    ctx.beginPath();
    ctx.moveTo(0, -11 * scale);
    ctx.lineTo(0, 11 * scale);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(248,251,242,.85)';
    ctx.lineWidth = 1.2 * scale;
    ctx.beginPath();
    ctx.moveTo(0, -8 * scale);
    ctx.lineTo(0, 8 * scale);
    ctx.stroke();
    ctx.fillStyle = '#f4f4e8';
    ctx.beginPath();
    ctx.arc(0, 0, 2.1 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFallbackAircraft(ctx, x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#d8e6e2';
    ctx.beginPath();
    ctx.moveTo(-49, 1);
    ctx.lineTo(-40, -5);
    ctx.lineTo(-28, -7);
    ctx.lineTo(-22, -21);
    ctx.lineTo(-16, -22);
    ctx.lineTo(-13, -7);
    ctx.lineTo(30, -5);
    ctx.quadraticCurveTo(43, -4, 49, 0);
    ctx.quadraticCurveTo(43, 5, 28, 5);
    ctx.lineTo(-19, 7);
    ctx.lineTo(-34, 13);
    ctx.lineTo(-40, 12);
    ctx.lineTo(-34, 6);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#a9c5c6';
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(11, 12);
    ctx.lineTo(20, 12);
    ctx.lineTo(13, 4);
    ctx.lineTo(30, 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#54b9b4';
    ctx.beginPath();
    ctx.moveTo(-30, 3);
    ctx.lineTo(26, 2);
    ctx.lineTo(17, 4.5);
    ctx.lineTo(-29, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#377e88';
    ctx.beginPath();
    ctx.moveTo(12, -4);
    ctx.lineTo(24, -4);
    ctx.lineTo(31, -2);
    ctx.lineTo(12, -1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#536d6d';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-8, 6);
    ctx.lineTo(-6, 11);
    ctx.moveTo(11, 5);
    ctx.lineTo(13, 10);
    ctx.stroke();
    ctx.fillStyle = '#344d57';
    ctx.beginPath();
    ctx.arc(-6, 12, 2.5, 0, Math.PI * 2);
    ctx.arc(13, 11, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPackage(ctx, image, x, y, angle, scale) {
    const size = 21 * scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.shadowColor = 'rgba(26,38,31,.32)';
    ctx.shadowBlur = 5 * scale;
    ctx.shadowOffsetY = 3 * scale;
    if (isUsableImage(image)) {
      drawContainedImage(ctx, image, 0, 0, size * 1.12, size * 1.12);
    } else {
      drawFallbackPackage(ctx, size);
    }
    ctx.restore();
  }

  function drawFallbackPackage(ctx, size) {
    const half = size / 2;
    ctx.fillStyle = '#bd8150';
    ctx.fillRect(-half, -half, size, size);
    ctx.fillStyle = '#d39b65';
    ctx.beginPath();
    ctx.moveTo(-half, -half);
    ctx.lineTo(-half + size * 0.26, -half - size * 0.16);
    ctx.lineTo(half + size * 0.26, -half - size * 0.16);
    ctx.lineTo(half, -half);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9b6845';
    ctx.beginPath();
    ctx.moveTo(half, -half);
    ctx.lineTo(half + size * 0.26, -half - size * 0.16);
    ctx.lineTo(half + size * 0.26, half - size * 0.16);
    ctx.lineTo(half, half);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#704b35';
    ctx.lineWidth = Math.max(1, size * 0.055);
    ctx.strokeRect(-half, -half, size, size);
    ctx.fillStyle = '#e9c38b';
    ctx.fillRect(-size * 0.1, -half, size * 0.2, size);
    ctx.strokeStyle = 'rgba(103,68,43,.72)';
    ctx.beginPath();
    ctx.moveTo(-half, 0);
    ctx.lineTo(half, 0);
    ctx.stroke();
    ctx.fillStyle = '#e4f2dc';
    ctx.fillRect(-size * 0.18, -size * 0.17, size * 0.36, size * 0.36);
    ctx.fillStyle = '#3a8674';
    ctx.fillRect(-size * 0.055, -size * 0.14, size * 0.11, size * 0.3);
    ctx.fillRect(-size * 0.14, -size * 0.055, size * 0.28, size * 0.11);
  }

  function drawContainedImage(ctx, image, centerX, centerY, maxWidth, maxHeight) {
    const rect = getContainedRect(image.naturalWidth, image.naturalHeight, centerX, centerY, maxWidth, maxHeight);
    ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  }

  function getContainedRect(sourceWidth, sourceHeight, centerX, centerY, maxWidth, maxHeight) {
    const width = Math.max(1, Number(sourceWidth) || 1);
    const height = Math.max(1, Number(sourceHeight) || 1);
    const scale = Math.min(maxWidth / width, maxHeight / height);
    const drawWidth = width * scale;
    const drawHeight = height * scale;
    return { x: centerX - drawWidth / 2, y: centerY - drawHeight / 2, width: drawWidth, height: drawHeight };
  }

  function isUsableImage(image) {
    return Boolean(image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
  }

  function getParallaxOffsets(scrollPixels, time = 0, width = 800) {
    const safeWidth = Math.max(1, Number(width) || 1);
    const scene = Math.max(0, Number(scrollPixels) || 0);
    const elapsed = Math.max(0, Number(time) || 0);
    return Object.freeze({
      mountains: scene * 0.075,
      hills: scene * 0.31,
      forest: scene * 0.73,
      foreground: scene,
      cloudFar: scene * CLOUD_LAYERS[0].speed + elapsed * CLOUD_LAYERS[0].drift,
      cloudNear: scene * CLOUD_LAYERS[2].speed + elapsed * CLOUD_LAYERS[2].drift,
      width: safeWidth
    });
  }

  function getRepeatOffset(value, period) {
    return positiveModulo(value, period);
  }

  function getSceneryProfile() {
    return FOREST.map((tree) => ({ ...tree }));
  }

  function createForest(count) {
    return Object.freeze(Array.from({ length: count }, (_, index) => Object.freeze({
      position: index / count,
      scale: 0.68 + seededValue(index, 207) * 0.76,
      shape: Math.floor(seededValue(index, 209) * 4),
      foliage: Math.floor(seededValue(index, 211) * 5),
      layer: index % 2
    })));
  }

  function seededValue(index, seed) {
    const value = Math.sin((index + 1) * 127.1 + seed * 311.7) * 43758.5453;
    return value - Math.floor(value);
  }

  function positiveModulo(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }

  return {
    DEFAULT_ASSETS,
    createArtwork,
    drawEnvironment,
    getContainedRect,
    getParallaxOffsets,
    getRepeatOffset,
    getSceneryProfile,
    isUsableImage
  };
});