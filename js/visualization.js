(function (root, factory) {
  const artworkModule = root?.TrajectoryArtwork || (typeof require === 'function' ? require('./artwork') : null);
  const mathUtils = root?.TrajectoryMathUtils || (typeof require === 'function' ? require('./mathUtils') : null);
  const api = factory(artworkModule, mathUtils);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TrajectoryVisualization = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (artworkModule, mathUtils) {
  'use strict';

  const COLORS = { cyan: '#66e4db', amber: '#ffbf78', green: '#83e6b3', ink: '#123346' };
  const artwork = artworkModule?.createArtwork ? artworkModule.createArtwork() : null;

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

  /**
   * Computes the bounding domain of world coordinates that must be rendered on screen.
   *
   * - WHAT IT DOES:
   *     Measures the minimum and maximum horizontal (x) and vertical (y/altitude) coordinates
   *     spanned by the aircraft flight, crate release point, sensor markers, parabolic apex, and landing target.
   *
   * - HOW IT WORKS:
   *     Delegates to `mathUtils.measureSceneDomain` to calculate:
   *       minX, maxX, margin, minimumSpan (170 m), and parabola vertex altitude y_vertex.
   *
   * - WHY IT IS USED:
   *     Enables the adaptive camera to smoothly frame the entire physical experiment without clipping.
   *
   * - VARIABLES:
   *     @param {object} model - Active trajectory model with points, landingX, and coefficients.
   *     @param {object} [frame={}] - Frame state including aircraft speed and flight parameters.
   *
   * - RESULT:
   *     @returns {{ domainMin: number, domainMax: number, releaseLaneSpan: number, worldDomain: number, minAltitude: number, maxAltitude: number, landingX: number|null }}
   */
  function measureSceneDomain(model, frame = {}) {
    if (mathUtils?.measureSceneDomain) {
      return mathUtils.measureSceneDomain(model, frame);
    }
    const landingX = Number.isFinite(model?.landingX) ? model.landingX : model?.roots?.positiveRoot;
    const landing = Number.isFinite(landingX) ? landingX : 0;
    const sensorPoints = model?.scenePoints || model?.points || [];
    const sensorXs = sensorPoints.map(({ x }) => Number(x)).filter(Number.isFinite);
    const coefficients = model?.coefficients || [0, 0, 0];
    const aircraftSpeed = Math.max(Number(frame.parameters?.aircraftSpeed) || 0, Number(model?.aircraftSpeed) || 0);
    const flightTime = Math.max(0, Number(model?.flightTime) || 0);
    const planeTravel = aircraftSpeed * flightTime;
    const sceneXs = [0, landing, planeTravel, ...sensorXs];
    const minX = Math.min(...sceneXs);
    const maxX = Math.max(...sceneXs);
    const span = Math.max(0, maxX - minX);
    const margin = Math.max(16, span * 0.1);
    const cruise = Math.max(30, aircraftSpeed * 3);
    let domainMin = minX - margin;
    let domainMax = maxX + margin + cruise;
    const minimumSpan = 170;
    if (domainMax - domainMin < minimumSpan) {
      const pad = (minimumSpan - (domainMax - domainMin)) / 2;
      domainMin -= pad;
      domainMax += pad;
    }
    const releaseAltitude = Number(model?.releaseAltitude ?? coefficients[0]) || 0;
    const altitudeValues = [0, releaseAltitude, ...sensorPoints.map(({ y }) => Number(y)).filter(Number.isFinite)];
    const curvature = coefficients[2];
    const vertexX = Math.abs(curvature) > 1e-12 ? -coefficients[1] / (2 * curvature) : NaN;
    if (Number.isFinite(vertexX) && vertexX >= minX && vertexX <= maxX) {
      altitudeValues.push(coefficients[0] + coefficients[1] * vertexX + curvature * vertexX * vertexX);
    }
    const finiteAltitudes = altitudeValues.filter(Number.isFinite);
    return {
      domainMin,
      domainMax,
      releaseLaneSpan: cruise,
      worldDomain: domainMax - domainMin,
      minAltitude: Math.min(0, ...finiteAltitudes),
      maxAltitude: Math.max(10, ...finiteAltitudes),
      landingX: Number.isFinite(landingX) ? landingX : null
    };
  }

  /**
   * Creates the 2D affine transformation camera mapping physical World Coordinates (m)
   * to HTML5 Canvas Screen Pixel Coordinates (px).
   *
   * - WHAT IT DOES:
   *     Calculates horizontal scale (xScale) and vertical scale (yScale), and establishes
   *     linear mapping functions `mapWorldX`, `mapSceneX`, and `mapY`.
   *
   * - HOW IT WORKS:
   *     Delegates to `mathUtils.createSceneViewport`:
   *       s_x = plotWidth / worldDomain
   *       s_y = (groundY - yTop) / (maxAltitude · 1.16)
   *       x_{screen} = left + (worldReleaseX + sceneX) · s_x
   *       y_{screen} = groundY - altitude · s_y  (Inverts y-axis since Canvas y points downward)
   *
   * - WHY IT IS USED:
   *     Maintains visual fidelity, responsiveness, and exact geometric proportions on any screen size.
   *
   * - VARIABLES:
   *     @param {number} width - Canvas display width in pixels.
   *     @param {number} height - Canvas display height in pixels.
   *     @param {object} model - Active trajectory model.
   *     @param {object} [frame={}] - Frame state with camera domain overrides.
   *
   * - RESULT:
   *     @returns {object} Viewport object containing scales, margins, and mapping closures.
   */
  function createSceneViewport(width, height, model, frame = {}) {
    if (mathUtils?.createSceneViewport) {
      return mathUtils.createSceneViewport(width, height, model, frame);
    }
    const safeWidth = Math.max(1, width);
    const safeHeight = Math.max(1, height);
    const measured = measureSceneDomain(model, frame);
    const domainMin = Number.isFinite(frame.domainOverride?.domainMin) ? frame.domainOverride.domainMin : measured.domainMin;
    const domainMax = Number.isFinite(frame.domainOverride?.domainMax) ? frame.domainOverride.domainMax : measured.domainMax;
    const maxAltitude = Number.isFinite(frame.domainOverride?.maxAltitude) ? frame.domainOverride.maxAltitude : measured.maxAltitude;
    const minAltitude = measured.minAltitude;
    const worldDomain = Math.max(1, domainMax - domainMin);
    const left = safeWidth * 0.07;
    const right = safeWidth * 0.93;
    const plotWidth = Math.max(1, right - left);
    const xScale = plotWidth / worldDomain;
    const yTop = safeHeight * 0.18;
    const groundY = safeHeight * 0.8;
    const yScale = (groundY - yTop) / (Math.max(10, maxAltitude) * 1.16);
    const phase = frame.state === 'PAUSED' ? frame.previousState : frame.state;
    const released = phase === 'FALLING' || phase === 'LANDED';
    const releaseDistance = Math.max(0, Number(frame.releasePlaneDistance) || 0);
    const releaseOffset = released ? releaseDistance : 0;
    const worldReleaseX = releaseOffset - domainMin;
    const mapWorldX = (worldX) => left + worldX * xScale;
    const mapSceneX = (sceneX) => mapWorldX(worldReleaseX + sceneX);
    const mapY = (altitude) => groundY - altitude * yScale;
    const planeWorldX = released
      ? worldReleaseX + Math.max(0, (Number(frame.planeDistance) || 0) - releaseDistance)
      : worldReleaseX;
    return {
      left, right, yTop, groundY, xScale, yScale, worldDomain, worldReleaseX, domainMin, domainMax,
      originX: mapSceneX(0), planeX: mapWorldX(planeWorldX), landingX: measured.landingX, maxAltitude, minAltitude,
      mapWorldX, mapSceneX, mapY
    };
  }

  function drawScene(canvas, frame, options = {}) {
    const prepared = prepareCanvas(canvas);
    if (!prepared) return null;
    const { context: ctx, width, height } = prepared;
    const { model, time = 0, sceneryTime = 0, sceneryDistance = 0, state = 'READY', previousState = 'READY', planeDistance = 0, releasePlaneDistance = 0, trajectoryVisible = true, sensorsVisible = true, sensorLabelsVisible = false, landingVisible = true, windIndicatorsVisible = false, parameters = {}, packagePosition = { x: 0, y: 0 }, planeImage = null, packageImage = null, impactTime = 0 } = frame;
    const visualState = state === 'PAUSED' ? previousState : state;
    const coefficients = model?.coefficients || [0, 0, 0];
    const viewport = createSceneViewport(width, height, model, frame);
    const { groundY, xScale, originX, landingX, mapSceneX, mapY } = viewport;
    const mapX = mapSceneX;
    const sensorPoints = model?.scenePoints || model?.points || [];
    const released = visualState === 'FALLING' || visualState === 'LANDED';
    const scrollMeters = Math.max(0, Number(sceneryDistance) || 0);
    artwork?.drawEnvironment(ctx, width, height, sceneryTime, scrollMeters * xScale);
    if (windIndicatorsVisible && parameters.windSpeed > 0) drawWindIndicators(ctx, width, height, sceneryTime, parameters.windDirection, parameters.windSpeed);

    if (trajectoryVisible && Number.isFinite(landingX)) {
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([5, 7]);
      ctx.lineJoin = 'round';
      const steps = 100;
      for (let index = 0; index <= steps; index += 1) {
        const progress = index / steps;
        const sceneX = model?.basis === 'time' ? 0 : landingX * progress;
        const modelX = model?.basis === 'time' ? (Number(model.landingTime) || 0) * progress : sceneX;
        const rawY = coefficients[0] + modelX * (coefficients[1] + coefficients[2] * modelX);
        const y = index === steps ? 0 : rawY;
        const screenX = mapX(sceneX);
        const screenY = mapY(y);
        if (index === 0) ctx.moveTo(screenX, screenY);
        else ctx.lineTo(screenX, screenY);
      }
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(13,47,54,.78)';
      ctx.stroke();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = COLORS.cyan;
      ctx.shadowColor = 'rgba(48,221,210,.48)';
      ctx.shadowBlur = 7;
      ctx.stroke();
      ctx.restore();
    }

    if (sensorsVisible) {
      const markerRadius = Math.max(8, Math.min(12, width / 78));
      sensorPoints.forEach(({ x, y }, index) => {
        drawSensorMarker(ctx, mapX(x), mapY(y), markerRadius, sensorLabelsVisible ? `S${index + 1}  ${formatSceneNumber(x)}, ${formatSceneNumber(y)}` : '');
      });
    }

    if (landingVisible && Number.isFinite(landingX)) drawTarget(ctx, mapX(landingX), groundY, time);

    const planeX = viewport.planeX;
    const releaseY = mapY(coefficients[0]);
    const spriteScale = Math.max(0.92, Math.min(1.28, width / 760));
    const planeY = releaseY - Math.max(22, height * 0.05);

    if (!released && Number.isFinite(landingX) && trajectoryVisible) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,.55)';
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(originX, groundY + 1);
      ctx.lineTo(originX, releaseY + 12);
      ctx.stroke();
      ctx.restore();
    }

    const propellerAngle = time * 22;
    artwork?.drawAircraft(ctx, planeImage, planeX, planeY, spriteScale, propellerAngle);
    if (!released) {
      artwork?.drawPackage(ctx, packageImage, planeX, releaseY, 0, spriteScale);
    } else if (Number.isFinite(landingX)) {
      const packagePixelX = mapX(packagePosition.x);
      const packagePixelY = mapY(Math.max(0, packagePosition.y));
      artwork?.drawPackage(ctx, packageImage, packagePixelX, packagePixelY, visualState === 'LANDED' ? 0 : time * .7, spriteScale);
      if (visualState === 'LANDED') drawImpact(ctx, packagePixelX, groundY, time - impactTime);
    }

    if (state === 'PAUSED') {
      ctx.fillStyle = 'rgba(5,18,28,.32)';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(7,25,36,.77)';
      roundedRect(ctx, width / 2 - 62, 14, 124, 28, 12);
      ctx.fill();
      ctx.fillStyle = '#ecf5f4';
      ctx.font = '15px "DM Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Ⅱ  PAUSED', width / 2, 34);
    }

    return { ...viewport, mapX, mapY };
  }

  /**
   * Euclidean modulo function ensuring strictly positive remainder in [0, divisor).
   *
   * - WHAT IT DOES: Computes positive periodic wrap for animation offsets.
   * - HOW IT WORKS: Delegates to `mathUtils.positiveModulo(value, divisor)`.
   * - FORMULA: ((value % divisor) + divisor) % divisor
   */
  function positiveModulo(value, divisor) {
    if (mathUtils?.positiveModulo) {
      return mathUtils.positiveModulo(value, divisor);
    }
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

  function drawClouds(ctx, width, height, time, scrollPixels) {
    const cloudSets = [
      { y: .22, size: 1.05, factor: 0.22, drift: 6, offset: 40, alpha: .5 },
      { y: .34, size: .72, factor: 0.38, drift: 9, offset: 260, alpha: .36 },
      { y: .14, size: .58, factor: 0.12, drift: 4, offset: 520, alpha: .32 }
    ];
    cloudSets.forEach((cloud) => {
      const cloudWidth = 68 * cloud.size;
      const travel = scrollPixels * cloud.factor + time * cloud.drift;
      const x = positiveModulo(cloud.offset - travel, width + cloudWidth * 2) - cloudWidth;
      drawCloud(ctx, x, height * cloud.y, cloud.size, cloud.alpha);
      drawCloud(ctx, x + width * .62, height * (cloud.y + .05), cloud.size * .74, cloud.alpha * .78);
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

  function drawMountainRange(ctx, width, groundY, scrollPixels, amplitude, color, frequency) {
    const period = Math.max(width + 80, 320);
    const shift = positiveModulo(scrollPixels, period);
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-20, groundY + 4);
    for (let x = -20; x <= width + 24; x += 10) {
      const along = x + shift;
      const peak = Math.sin(along * frequency) * amplitude * 0.62
        + Math.sin(along * frequency * 2.15 + 0.7) * amplitude * 0.24
        + Math.abs(Math.sin(along * frequency * 0.47)) * amplitude * 0.2;
      ctx.lineTo(x, groundY - amplitude * 0.35 - peak);
    }
    ctx.lineTo(width + 24, groundY + 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawBuildings(ctx, width, groundY, scrollPixels) {
    const spacing = 168;
    const shift = positiveModulo(scrollPixels, spacing);
    ctx.save();
    for (let index = -1; ; index += 1) {
      const x = index * spacing - shift;
      if (x > width + spacing) break;
      const kind = positiveModulo(index * 5 + 2, 4);
      if (kind === 0) continue;
      const buildingWidth = 18 + positiveModulo(index * 7, 5) * 6;
      const buildingHeight = 16 + kind * 9 + positiveModulo(index * 3, 4) * 4;
      ctx.fillStyle = kind === 1 ? 'rgba(63, 84, 92, .42)' : 'rgba(86, 96, 104, .34)';
      ctx.fillRect(x, groundY - buildingHeight, buildingWidth, buildingHeight);
      ctx.fillStyle = 'rgba(214, 196, 150, .28)';
      const windowSize = 2;
      for (let row = 4; row < buildingHeight - 3; row += 6) {
        for (let column = 3; column < buildingWidth - 3; column += 6) {
          ctx.fillRect(x + column, groundY - buildingHeight + row, windowSize, windowSize);
        }
      }
    }
    ctx.restore();
  }

  function drawTreeLayer(ctx, width, baseline, scrollPixels, spacing, layer) {
    const shift = positiveModulo(scrollPixels, spacing);
    const first = Math.floor((shift - spacing) / spacing);
    const canopy = ['#2f5b49', '#3d6a52', '#24483c', '#4e7358'];
    ctx.save();
    for (let index = first; ; index += 1) {
      const x = index * spacing - shift;
      if (x > width + spacing) break;
      const variation = positiveModulo(index * 17 + layer * 11, 7);
      const scale = (layer ? 0.82 : 0.62) + variation * 0.07;
      const kind = positiveModulo(index * 3 + layer, 3);
      const treeHeight = (layer ? 34 : 24) + variation * 3.4;
      const treeWidth = (layer ? 15 : 11) + variation * 1.2;
      ctx.fillStyle = layer ? '#6d5640' : '#7b6248';
      ctx.fillRect(x - 1.4 * scale, baseline - treeHeight * 0.34, 2.8 * scale, treeHeight * 0.34 + 2);
      ctx.fillStyle = canopy[(index + layer) % canopy.length];
      ctx.beginPath();
      if (kind === 0) {
        ctx.moveTo(x, baseline - treeHeight * scale);
        ctx.lineTo(x - treeWidth * scale, baseline - treeHeight * 0.28);
        ctx.lineTo(x + treeWidth * scale, baseline - treeHeight * 0.28);
      } else if (kind === 1) {
        ctx.ellipse(x, baseline - treeHeight * 0.62 * scale, treeWidth * scale, treeHeight * 0.42 * scale, 0, 0, Math.PI * 2);
        ctx.moveTo(x - treeWidth * 0.72 * scale, baseline - treeHeight * 0.38);
        ctx.ellipse(x, baseline - treeHeight * 0.46 * scale, treeWidth * 0.82 * scale, treeHeight * 0.28 * scale, 0, 0, Math.PI * 2);
      } else {
        ctx.moveTo(x, baseline - treeHeight * scale);
        ctx.lineTo(x - treeWidth * 0.7 * scale, baseline - treeHeight * 0.48);
        ctx.lineTo(x - treeWidth * 0.28 * scale, baseline - treeHeight * 0.5);
        ctx.lineTo(x - treeWidth * scale, baseline - treeHeight * 0.16);
        ctx.lineTo(x + treeWidth * scale, baseline - treeHeight * 0.16);
        ctx.lineTo(x + treeWidth * 0.28 * scale, baseline - treeHeight * 0.5);
        ctx.lineTo(x + treeWidth * 0.7 * scale, baseline - treeHeight * 0.48);
      }
      ctx.fill();
    }
    ctx.restore();
  }

  function drawGrass(ctx, width, groundY, height, scrollPixels) {
    ctx.save();
    ctx.strokeStyle = 'rgba(199,211,144,.45)';
    ctx.lineWidth = 1.4;
    const grassSpacing = 14;
    const grassOffset = positiveModulo(scrollPixels, grassSpacing);
    for (let x = -grassSpacing; x < width + grassSpacing; x += grassSpacing) {
      const bladeX = x - grassOffset;
      const length = 5 + positiveModulo(x * 3, 5);
      ctx.beginPath();
      ctx.moveTo(bladeX, groundY + 1);
      ctx.lineTo(bladeX - 2, groundY + length);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(232, 214, 150, .28)';
    ctx.lineWidth = 2;
    const stripeSpacing = 64;
    const stripeOffset = positiveModulo(scrollPixels * 1.15, stripeSpacing);
    for (let x = -stripeSpacing; x < width + stripeSpacing; x += stripeSpacing) {
      ctx.beginPath();
      ctx.moveTo(x - stripeOffset, height * 0.9);
      ctx.lineTo(x - stripeOffset + 26, height * 0.9);
      ctx.stroke();
    }
    ctx.restore();
  }

  function formatSceneNumber(value) {
    return Number.isFinite(value) ? value.toFixed(1) : '—';
  }

  function drawSensorMarker(ctx, x, y, radius, label) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(28, 18, 8, .28)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.amber;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#fffaf2';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2, radius * 0.28), 0, Math.PI * 2);
    ctx.fillStyle = '#6a4214';
    ctx.fill();
    if (label) {
      ctx.font = '13px "DM Mono", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const textWidth = ctx.measureText(label).width;
      const boxX = x + radius + 6;
      const boxY = y - 11;
      ctx.fillStyle = 'rgba(28, 18, 8, .78)';
      ctx.fillRect(boxX, boxY, textWidth + 10, 22);
      ctx.fillStyle = '#fff1d9';
      ctx.fillText(label, boxX + 5, y);
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
    ctx.font = '12px "DM Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TARGET', x, groundY + 22);
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
      const x = Number.isFinite(landing) ? landing * index / 80 : xMin + (xMax - xMin) * index / 80;
      return coefficients[0] + x * (coefficients[1] + coefficients[2] * x);
    });
    const minY = Math.min(0, ...points.map((point) => point.y), ...samples);
    const maxY = Math.max(1, ...points.map((point) => point.y), ...samples);
    const yPadding = Math.max(1, (maxY - minY) * .13);
    const yMin = minY - yPadding * .15;
    const yMax = maxY + yPadding;
    const left = 54;
    const right = width - 14;
    const top = 12;
    const bottom = height - 28;
    const mapX = (x) => left + (x - xMin) / (xMax - xMin) * (right - left);
    const mapY = (y) => bottom - (y - yMin) / (yMax - yMin) * (bottom - top);

    ctx.clearRect(0, 0, width, height);
    ctx.font = '13px "DM Mono", monospace';
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
      const x = Number.isFinite(landing) ? landing * index / 140 : xMin + (xMax - xMin) * index / 140;
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
    ctx.arc(mapX(0), mapY(coefficients[0]), 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#dffaf1';
    ctx.fill();
    if (options.sensorsVisible !== false) {
      points.forEach(({ x, y }, index) => {
        ctx.beginPath();
        ctx.arc(mapX(x), mapY(y), 6.5, 0, Math.PI * 2);
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
      ctx.arc(mapX(landing), mapY(0), 5, 0, Math.PI * 2);
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

  return { prepareCanvas, measureSceneDomain, createSceneViewport, drawScene, drawGraph };
});