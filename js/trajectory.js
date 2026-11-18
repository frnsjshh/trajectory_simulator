(function (root, factory) {
  const solver = typeof module === 'object' && module.exports ? require('./solver.js') : root.TrajectorySolver;
  const api = factory(solver);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TrajectoryMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (solver) {
  'use strict';

  function evaluate(coefficients, x) {
    const [a0, a1, a2] = coefficients;
    return a0 + x * (a1 + a2 * x);
  }

  function findPositiveRoot(coefficients, tolerance = 1e-12) {
    const [a0, a1, a2] = coefficients;
    const scale = Math.max(1, Math.abs(a0), Math.abs(a1), Math.abs(a2));
    if (Math.abs(a2) <= tolerance * scale) {
      if (Math.abs(a1) <= tolerance * scale) return { roots: [], positiveRoot: null, reason: 'The altitude equation has no forward x-intercept.' };
      const rootValue = -a0 / a1;
      return { roots: [rootValue], positiveRoot: rootValue > tolerance ? rootValue : null, reason: rootValue > tolerance ? null : 'The only x-intercept is not in the forward direction.' };
    }

    let discriminant = a1 * a1 - 4 * a2 * a0;
    const discTolerance = tolerance * Math.max(1, a1 * a1, Math.abs(4 * a2 * a0));
    if (discriminant < -discTolerance) return { roots: [], positiveRoot: null, reason: 'This polynomial has no real ground intersection.' };
    if (discriminant < 0) discriminant = 0;
    const squareRoot = Math.sqrt(discriminant);
    // This form avoids cancellation when the linear and square-root terms nearly match.
    const q = -0.5 * (a1 + (a1 >= 0 ? squareRoot : -squareRoot));
    const roots = q === 0 ? [-a1 / (2 * a2)] : [q / a2, a0 / q];
    const uniqueRoots = roots.filter((value, index) => Number.isFinite(value) && roots.findIndex((other) => Math.abs(other - value) <= tolerance * Math.max(1, Math.abs(value))) === index).sort((left, right) => left - right);
    const positiveRoot = uniqueRoots.find((value) => value > tolerance) ?? null;
    return {
      roots: uniqueRoots,
      positiveRoot,
      reason: positiveRoot === null ? 'No positive x-intercept is available for a forward landing.' : null
    };
  }

  function fitQuadratic(sensorPoints) {
    if (!Array.isArray(sensorPoints) || sensorPoints.length !== 3) {
      throw new Error('Quadratic interpolation requires exactly three sensor points. Extra points are not silently ignored.');
    }
    const points = sensorPoints.map((point, index) => {
      const x = Number(point.x);
      const y = Number(point.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`Sensor ${index + 1} must contain finite numeric x and y values.`);
      return { x, y };
    });
    for (let left = 0; left < points.length; left += 1) {
      for (let right = left + 1; right < points.length; right += 1) {
        if (points[left].x === points[right].x) throw new Error('Sensor x-values must be distinct for quadratic interpolation.');
      }
    }
    const matrix = points.map(({ x }) => [1, x, x * x]);
    if (matrix.flat().some((value) => !Number.isFinite(value))) throw new Error('Sensor distances are too large to construct a finite coefficient matrix.');
    const solved = solver.solveLinearSystem(matrix, points.map(({ y }) => y));
    const coefficients = solved.solution;
    if (coefficients.some((value) => !Number.isFinite(value))) throw new Error('The fitted coefficients are outside the numeric range.');
    return { points, matrix, values: points.map(({ y }) => y), coefficients, roots: findPositiveRoot(coefficients), ...solved };
  }

  function generatePhysicsModel(parameters = {}) {
    const aircraftSpeed = Number(parameters.aircraftSpeed ?? parameters.speed ?? 60);
    const altitude = Number(parameters.altitude ?? 90);
    const gravity = Number(parameters.gravity ?? 9.81);
    const windEnabled = Boolean(parameters.windEnabled);
    const windSpeed = windEnabled ? Number(parameters.windSpeed ?? 0) : 0;
    const windDirection = parameters.windDirection === 'headwind' ? 'headwind' : 'tailwind';
    if (!Number.isFinite(aircraftSpeed) || aircraftSpeed <= 0) throw new Error('Aircraft speed must be a positive finite number.');
    if (!Number.isFinite(altitude) || altitude <= 0) throw new Error('Release altitude must be a positive finite number.');
    if (!Number.isFinite(gravity) || gravity <= 0) throw new Error('Gravity must be a positive finite number.');
    if (!Number.isFinite(windSpeed) || windSpeed < 0 || windSpeed > 20) throw new Error('Wind speed must be between 0 and 20 m/s.');

    const signedWindSpeed = windEnabled ? (windDirection === 'headwind' ? -windSpeed : windSpeed) : 0;
    const effectiveHorizontalSpeed = aircraftSpeed + signedWindSpeed;
    const flightTime = Math.sqrt(2 * altitude / gravity);
    const basis = Math.abs(effectiveHorizontalSpeed) < 1e-10 ? 'time' : 'distance';
    const fractions = [0.2, 0.5, 0.8];
    const sampleTimes = fractions.map((fraction) => fraction * flightTime);
    const points = sampleTimes.map((time) => ({
      x: basis === 'time' ? time : effectiveHorizontalSpeed * time,
      y: altitude - 0.5 * gravity * time * time
    }));
    const solved = fitQuadratic(points);
    const landingTime = basis === 'time'
      ? solved.roots.positiveRoot
      : flightTime;
    const expectedLandingX = effectiveHorizontalSpeed * flightTime;
    const landingX = basis === 'time'
      ? 0
      : solved.roots.roots.find((value) => Math.sign(value) === Math.sign(expectedLandingX)) ?? null;
    if (landingTime === null || landingX === null) throw new Error('The reconstructed polynomial has no landing root in the physical travel direction.');

    return {
      ...solved,
      basis,
      axisLabel: basis === 'time' ? 'time (s)' : 'horizontal distance (m)',
      gravity,
      releaseAltitude: altitude,
      aircraftSpeed,
      windEnabled,
      windSpeed,
      windDirection,
      signedWindSpeed,
      effectiveHorizontalSpeed,
      flightTime,
      landingTime,
      landingX,
      landingDistance: Math.abs(landingX),
      scenePoints: points.map((point) => ({ x: basis === 'time' ? 0 : point.x, y: point.y }))
    };
  }

  function positionAtTime(model, elapsed) {
    const flightTime = model.flightTime;
    const time = Math.min(flightTime, Math.max(0, Number.isFinite(elapsed) ? elapsed : 0));
    const atLanding = time >= flightTime;
    if (model.basis === 'time') {
      return { x: 0, y: atLanding ? 0 : evaluate(model.coefficients, time), time, modelX: time };
    }
    const x = atLanding ? model.landingX : model.effectiveHorizontalSpeed * time;
    return { x, y: atLanding ? 0 : evaluate(model.coefficients, x), time, modelX: x };
  }

  function sampleTrajectory(coefficients, endX, count = 80) {
    if (!Number.isFinite(endX) || endX < 0) return [];
    const safeCount = Math.max(2, Math.floor(count));
    return Array.from({ length: safeCount + 1 }, (_, index) => {
      const x = endX * index / safeCount;
      return { x, y: evaluate(coefficients, x) };
    });
  }

  function trajectoryPosition(model, progress) {
    const clampedProgress = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
    const landing = model.roots.positiveRoot;
    const x = landing === null ? 0 : landing * clampedProgress;
    return { x, y: clampedProgress === 1 && landing !== null ? 0 : evaluate(model.coefficients, x), progress: clampedProgress };
  }

  return { evaluate, findPositiveRoot, fitQuadratic, generatePhysicsModel, positionAtTime, sampleTrajectory, trajectoryPosition };
});