(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TrajectoryVisualization = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const COLORS = { cyan: '#66e4db', amber: '#ffbf78', green: '#83e6b3', ink: '#123346' };

  function prepareCanvas(canvas) {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width || canvas.clientWidth || 1);
    const height = Math.max(1, rect.height || canvas.clientHeight || 1);
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { context, width, height };
  }

  function drawScene(canvas, frame, options = {}) {
    const prepared = prepareCanvas(canvas);
    if (!prepared) return null;
    const { context: ctx, width, height } = prepared;
    const { model, time = 0, state = 'READY', previousState = 'READY', planeDistance = 0, releasePlaneDistance = 0, trajectoryVisible = true, sensorsVisible = true, sensorLabelsVisible = false, landingVisible = true, windIndicatorsVisible = false, parameters = {}, packagePosition = { x: 0, y: 0 }, planeImage = null, packageImage = null, impactTime = 0 } = frame;
    const visualState = state === 'PAUSED' ? previousState : state;
    const coefficients = model?.coefficients || [0, 0, 0];
    const landingX = Number.isFinite(model?.landingX) ? model.landingX : model?.roots?.positiveRoot;
    const range = Number.isFinite(landingX) ? Math.abs(landingX) : 0;
    const sensorPoints = model?.scenePoints || model?.points || [];
    const released = visualState === 'FALLING' || visualState === 'LANDED';
    const left = width * .1;
    const right = width * .9;
    const plotWidth = Math.max(1, right - left);
    const visualDomain = Math.max(range, Number(parameters.aircraftSpeed || 0) * Number(model?.flightTime || 1) * .6, 30);
    const xScale = plotWidth / (visualDomain * 1.15);
    const flightSpan = range * xScale;
    const laneWidth = Math.max(18, plotWidth - flightSpan);
    const laneStart = left + (landingX < 0 ? flightSpan : 0);
    const anchorDistance = released ? releasePlaneDistance : planeDistance;
    const originX = laneStart + positiveModulo(anchorDistance * xScale, laneWidth);
    const yTop = height * .14;
    const groundY = height * .82;
    const maxAltitude = Math.max(200, coefficients[0], ...sensorPoints.map((point) => point.y));
    const yScale = (groundY - yTop) / (maxAltitude * 1.08);
    const mapX = (x) => originX + x * xScale;
    const mapY = (y) => groundY - y * yScale;
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#72b6d2');
    sky.addColorStop(.52, '#a4d5dc');
    sky.addColorStop(1, '#e1dcb7');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = .15;
    ctx.fillStyle = '#fff5dd';
    ctx.beginPath();
    ctx.arc(width * .78, height * .18, height * .09, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawClouds(ctx, width, height, time);
    drawRidge(ctx, width, height, time, .64, '#769c99', .0022, 0);
    drawRidge(ctx, width, height, time, .73, '#567c76', .0036, 1);
    if (windIndicatorsVisible && parameters.windSpeed > 0) drawWindIndicators(ctx, width, height, time, parameters.windDirection, parameters.windSpeed);

    const groundGradient = ctx.createLinearGradient(0, groundY, 0, height);
    groundGradient.addColorStop(0, '#547a56');
    groundGradient.addColorStop(.12, '#3c674c');
    groundGradient.addColorStop(1, '#284c40');
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, groundY, width, height - groundY);
    ctx.fillStyle = 'rgba(217,222,160,.8)';
    ctx.fillRect(0, groundY, width, 2);
    drawGrass(ctx, width, groundY, height, time);

    if (trajectoryVisible && Number.isFinite(landingX)) {
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = COLORS.cyan;
      ctx.shadowColor = 'rgba(48,221,210,.48)';
      ctx.shadowBlur = 7;
      for (let index = 0; index <= 90; index += 1) {
        const progress = index / 90;
        const x = model.basis === 'time' ? 0 : landingX * progress;
        const modelX = model.basis === 'time' ? model.landingTime * progress : x;
        const y = index === 90 ? 0 : coefficients[0] + modelX * (coefficients[1] + coefficients[2] * modelX);
        if (index === 0) ctx.moveTo(mapX(x), mapY(y));
        else ctx.lineTo(mapX(x), mapY(y));
      }
      ctx.stroke();
      ctx.restore();
    }

    if (sensorsVisible) {
      sensorPoints.forEach(({ x, y }, index) => {
        const px = mapX(x);
        const py = mapY(y);
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.amber;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(40,52,48,.65)';
        ctx.stroke();
        if (sensorLabelsVisible) {
          ctx.fillStyle = '#fff1d9';
          ctx.font = '8px "DM Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`S${index + 1}`, px + 6, py - 6);
        }
      });
    }

    if (landingVisible && Number.isFinite(landingX)) drawTarget(ctx, mapX(landingX), groundY, time);

    const planeLaneWidth = Math.max(1, right - left);
    const planeX = released
      ? left + positiveModulo((originX - left) + (planeDistance - releasePlaneDistance) * xScale, planeLaneWidth)
      : originX;
    const planeY = mapY(model?.releaseAltitude ?? coefficients[0]) - 22;

    if (!released && Number.isFinite(landingX) && trajectoryVisible) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(originX, groundY + 1);
      ctx.lineTo(originX, mapY(coefficients[0]) + 13);
      ctx.stroke();
      ctx.restore();
    }

    const propellerAngle = time * 22;
    drawAircraft(ctx, planeImage, planeX, planeY + Math.sin(time * 2.4) * 1.5, Math.min(1, width / 650), propellerAngle);
    if (!released) {
      drawPackage(ctx, packageImage, planeX - 18, mapY(model?.releaseAltitude ?? coefficients[0]) + 11, 0, Math.min(1, width / 650));
    } else if (Number.isFinite(landingX)) {
      const packagePixelX = mapX(packagePosition.x);
      const packagePixelY = mapY(packagePosition.y) + (visualState === 'LANDED' ? -2 : 9);
      if (trajectoryVisible && visualState !== 'LANDED') {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,245,219,.4)';
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(packagePixelX, packagePixelY + 9);
        ctx.lineTo(packagePixelX, groundY);
        ctx.stroke();
        ctx.restore();
      }
      if (visualState !== 'LANDED') drawPackage(ctx, packageImage, packagePixelX, packagePixelY, time * .7, Math.min(1, width / 650));
      else drawImpact(ctx, packagePixelX, groundY, time - impactTime);
    }

    if (state === 'PAUSED') {
      ctx.fillStyle = 'rgba(5,18,28,.32)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(7,25,36,.77)';
      roundedRect(ctx, width / 2 - 45, 17, 90, 23, 11);
      ctx.fill();
      ctx.fillStyle = '#ecf5f4';
      ctx.font = '9px "DM Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Ⅱ  PAUSED', width / 2, 32);
    }

    return { originX, groundY, xScale, yScale, mapX, mapY, landingX };
  }

  function positiveModulo(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }

  function drawWindIndicators(ctx, width, height, time, direction, speed) {
    const sign = direction === 'headwind' ? -1 : 1;
    const span = width + 60;
    const phase = positiveModulo(time * (12 + speed * 2) * sign, span);
    for (let index = 0; index < 4; index += 1) {
      const x = positiveModulo(phase + index * width / 4, span) - 30;
      const y = height * (.28 + index % 2 * .12);
      const arrow = sign * 11;
      ctx.save();
      ctx.strokeStyle = 'rgba(34,112,137,.55)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x - arrow, y);
      ctx.lineTo(x + arrow, y);
      ctx.moveTo(x + arrow, y);
      ctx.lineTo(x + arrow - sign * 5, y - 4);
      ctx.moveTo(x + arrow, y);
      ctx.lineTo(x + arrow - sign * 5, y + 4);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawClouds(ctx, width, height, time) {
    const cloudSets = [
      { y: .25, size: 1, speed: 5, offset: 50, alpha: .44 },
      { y: .38, size: .7, speed: 9, offset: 270, alpha: .32 },
      { y: .17, size: .58, speed: 3, offset: 520, alpha: .29 }
    ];
    cloudSets.forEach((cloud) => {
      const cloudWidth = 68 * cloud.size;
      const x = ((cloud.offset + time * cloud.speed) % (width + cloudWidth * 2)) - cloudWidth;
      drawCloud(ctx, x, height * cloud.y, cloud.size, cloud.alpha);
      drawCloud(ctx, x + width * .68, height * (cloud.y + .045), cloud.size * .72, cloud.alpha * .78);
    });
  }

  function drawCloud(ctx, x, y, scale, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#f6f7e9';
    ctx.beginPath();
    ctx.ellipse(x, y, 27 * scale, 7 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 12 * scale, y - 3 * scale, 12 * scale, 8 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 2 * scale, y - 7 * scale, 15 * scale, 12 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 15 * scale, y - 3 * scale, 12 * scale, 8 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawRidge(ctx, width, height, time, baseline, color, frequency, phase) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, height * baseline);
    for (let x = 0; x <= width + 10; x += 8) {
      const shift = time * (phase ? 3 : 1.5);
      const y = height * baseline - (Math.sin((x + shift) * frequency) * 10 + Math.sin((x + shift) * frequency * 2.2 + phase) * 5 + 6);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawGrass(ctx, width, groundY, height, time) {
    ctx.save();
    ctx.strokeStyle = 'rgba(199,211,144,.29)';
    ctx.lineWidth = 1;
    for (let x = 6; x < width; x += 17) {
      const sway = Math.sin(time * 1.3 + x * .1) * 2;
      const length = 3 + (x % 4);
      ctx.beginPath();
      ctx.moveTo(x, groundY + 4);
      ctx.lineTo(x + sway, groundY + 4 + length);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(218,228,175,.22)';
    for (let x = 9; x < width; x += 79) {
      ctx.beginPath();
      ctx.moveTo(x, height * .93);
      ctx.lineTo(x + 20, height * .925);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTarget(ctx, x, groundY, time) {
    const pulse = 1 + Math.sin(time * 3) * .1;
    ctx.save();
    ctx.globalAlpha = .72;
    ctx.strokeStyle = COLORS.green;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, groundY + 2, 13 * pulse, 4 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, groundY - 11);
    ctx.lineTo(x, groundY + 1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 4, groundY - 7);
    ctx.lineTo(x, groundY - 11);
    ctx.lineTo(x + 4, groundY - 7);
    ctx.stroke();
    ctx.fillStyle = COLORS.green;
    ctx.font = '7px "DM Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TARGET', x, groundY + 18);
    ctx.restore();
  }

  function drawAircraft(ctx, image, x, y, scale, propellerAngle) {
    const width = 73 * scale;
    const height = 37 * scale;
    if (image?.complete && image.naturalWidth) {
      ctx.drawImage(image, x - width * .45, y - height * .55, width, height);
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.shadowColor = 'rgba(22,52,67,.28)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#f4f3e8';
    ctx.beginPath();
    ctx.moveTo(-34, 1);
    ctx.quadraticCurveTo(-30, -5, -17, -6);
    ctx.lineTo(26, -5);
    ctx.quadraticCurveTo(35, -4, 39, 0);
    ctx.quadraticCurveTo(36, 4, 27, 4);
    ctx.lineTo(-27, 5);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#c9d9d9';
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(7, -20);
    ctx.lineTo(16, -20);
    ctx.lineTo(12, -1);
    ctx.lineTo(30, 2);
    ctx.lineTo(12, 5);
    ctx.lineTo(18, 19);
    ctx.lineTo(8, 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b7caca';
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.lineTo(-32, -12);
    ctx.lineTo(-25, -12);
    ctx.lineTo(-12, -1);
    ctx.lineTo(-13, 1);
    ctx.lineTo(-26, 10);
    ctx.lineTo(-31, 9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#49b8bd';
    ctx.beginPath();
    ctx.moveTo(9, -4);
    ctx.lineTo(18, -4);
    ctx.lineTo(23, -2);
    ctx.lineTo(10, -1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(19,54,70,.85)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(39, -7);
    ctx.lineTo(39, 7);
    ctx.stroke();
    ctx.save();
    ctx.translate(39, 0);
    ctx.rotate(propellerAngle);
    ctx.strokeStyle = 'rgba(245,248,233,.8)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(0, 9);
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  function drawPackage(ctx, image, x, y, angle, scale) {
    const size = 17 * scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    if (image?.complete && image.naturalWidth) {
      ctx.drawImage(image, -size * .55, -size * .55, size * 1.1, size * 1.1);
    } else {
      ctx.shadowColor = 'rgba(28,38,27,.25)';
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = '#c98c4e';
      ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#795633';
      ctx.lineWidth = Math.max(1, scale * 1.6);
      ctx.strokeRect(-size / 2, -size / 2, size, size);
      ctx.fillStyle = '#e6bc7e';
      ctx.fillRect(-size * .11, -size / 2, size * .22, size);
      ctx.strokeStyle = 'rgba(105,70,37,.62)';
      ctx.beginPath();
      ctx.moveTo(-size / 2, -size * .13);
      ctx.lineTo(size / 2, -size * .13);
      ctx.stroke();
      ctx.fillStyle = '#dce4d8';
      ctx.font = `${Math.max(4, 5 * scale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✚', 0, size * .18);
    }
    ctx.restore();
  }

  function drawImpact(ctx, x, groundY, elapsed) {
    const duration = .8;
    const progress = Math.max(0, Math.min(1, elapsed / duration));
    if (progress >= 1) return;
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = '#e8d5a5';
    ctx.fillStyle = 'rgba(226,214,177,.45)';
    ctx.lineWidth = 1.5;
    for (let index = 0; index < 3; index += 1) {
      const radius = 5 + progress * (11 + index * 4);
      ctx.beginPath();
      ctx.ellipse(x + (index - 1) * progress * 5, groundY - progress * (5 + index * 2), radius, radius * .35, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(x, groundY - 7 * (1 - progress), Math.max(1, 4 * (1 - progress)), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
  }

  function drawGraph(canvas, model, options = {}) {
    const prepared = prepareCanvas(canvas);
    if (!prepared) return null;
    const { context: ctx, width, height } = prepared;
    const points = model?.points || [];
    const coefficients = model?.coefficients || [0, 0, 0];
    const landing = model?.basis === 'time'
      ? model.landingTime
      : Number.isFinite(model?.landingX) ? model.landingX : model?.roots?.positiveRoot;
    const xValues = [0, landing, ...points.map((point) => point.x)].filter(Number.isFinite);
    const rawMinX = Math.min(...xValues);
    const rawMaxX = Math.max(...xValues);
    const xPadding = Math.max(.5, (rawMaxX - rawMinX) * .1);
    const xMin = rawMinX - xPadding;
    const xMax = rawMaxX + xPadding;
    const samples = Array.from({ length: 81 }, (_, index) => {
      const x = xMin + (xMax - xMin) * index / 80;
      return coefficients[0] + x * (coefficients[1] + coefficients[2] * x);
    });
    const minY = Math.min(0, ...points.map((point) => point.y), ...samples);
    const maxY = Math.max(1, ...points.map((point) => point.y), ...samples);
    const yPadding = Math.max(1, (maxY - minY) * .13);
    const yMin = minY - yPadding * .15;
    const yMax = maxY + yPadding;
    const left = 34;
    const right = width - 9;
    const top = 7;
    const bottom = height - 23;
    const mapX = (x) => left + (x - xMin) / (xMax - xMin) * (right - left);
    const mapY = (y) => bottom - (y - yMin) / (yMax - yMin) * (bottom - top);

    ctx.clearRect(0, 0, width, height);
    ctx.font = '8px "DM Mono", monospace';
    ctx.lineWidth = 1;
    const yTicks = 4;
    for (let index = 0; index <= yTicks; index += 1) {
      const y = yMin + (yMax - yMin) * index / yTicks;
      const pixelY = mapY(y);
      ctx.strokeStyle = 'rgba(168,195,204,.11)';
      ctx.beginPath();
      ctx.moveTo(left, pixelY);
      ctx.lineTo(right, pixelY);
      ctx.stroke();
      ctx.fillStyle = '#8198a4';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(formatTick(y), left - 6, pixelY);
    }
    for (let index = 0; index <= 4; index += 1) {
      const x = xMin + (xMax - xMin) * index / 4;
      const pixelX = mapX(x);
      ctx.strokeStyle = 'rgba(168,195,204,.08)';
      ctx.beginPath();
      ctx.moveTo(pixelX, top);
      ctx.lineTo(pixelX, bottom);
      ctx.stroke();
      ctx.fillStyle = '#8198a4';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(formatTick(x), pixelX, bottom + 5);
    }
    if (yMin <= 0 && yMax >= 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(214,232,218,.47)';
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(left, mapY(0));
      ctx.lineTo(right, mapY(0));
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.beginPath();
    for (let index = 0; index <= 140; index += 1) {
      const x = xMin + (xMax - xMin) * index / 140;
      const y = coefficients[0] + x * (coefficients[1] + coefficients[2] * x);
      if (index === 0) ctx.moveTo(mapX(x), mapY(y));
      else ctx.lineTo(mapX(x), mapY(y));
    }
    ctx.strokeStyle = COLORS.cyan;
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(76,220,210,.35)';
    ctx.shadowBlur = 5;
    ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(mapX(0), mapY(coefficients[0]), 3, 0, Math.PI * 2);
    ctx.fillStyle = '#dffaf1';
    ctx.fill();
    if (options.sensorsVisible !== false) {
      points.forEach(({ x, y }, index) => {
        ctx.beginPath();
        ctx.arc(mapX(x), mapY(y), 3.6, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.amber;
        ctx.fill();
        ctx.strokeStyle = '#392d25';
        ctx.lineWidth = 1;
        ctx.stroke();
        if (options.sensorLabelsVisible) {
          ctx.fillStyle = '#f9d5a5';
          ctx.textAlign = 'left';
          ctx.fillText(`S${index + 1}`, mapX(x) + 5, mapY(y) - 5);
        }
      });
    }
    if (options.landingVisible !== false && Number.isFinite(landing)) {
      ctx.beginPath();
      ctx.arc(mapX(landing), mapY(0), 4, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.green;
      ctx.fill();
      ctx.strokeStyle = '#10342e';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (options.currentPosition && Number.isFinite(options.currentPosition.modelX)) {
      ctx.beginPath();
      ctx.arc(mapX(options.currentPosition.modelX), mapY(options.currentPosition.y), 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#f1fffa';
      ctx.fill();
      ctx.strokeStyle = COLORS.cyan;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    ctx.fillStyle = '#8198a4';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(model?.axisLabel || 'horizontal distance (m)', right, height - 1);
    return { mapX, mapY, xMin, xMax, yMin, yMax, left, right, top, bottom };
  }

  function formatTick(value) {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }

  return { prepareCanvas, drawScene, drawGraph };
});