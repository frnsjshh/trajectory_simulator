const test = require('node:test');
const assert = require('node:assert/strict');
const { solveLinearSystem } = require('../js/solver.js');
const { evaluate, findPositiveRoot, fitQuadratic, generatePhysicsModel, positionAtTime, sampleTrajectory, trajectoryPosition } = require('../js/trajectory.js');

test('default sensor readings solve to y = 45 - 5x² and a 3 m landing', () => {
  const result = fitQuadratic([{ x: 0, y: 45 }, { x: 1, y: 40 }, { x: 2, y: 25 }]);
  assert.deepEqual(result.coefficients, [45, 0, -5]);
  assert.equal(result.roots.positiveRoot, 3);
  assert.deepEqual(result.matrix, [[1, 0, 0], [1, 1, 1], [1, 2, 4]]);
  assert.deepEqual(result.values, [45, 40, 25]);
  assert.deepEqual(result.rref, [[1, 0, 0, 45], [0, 1, 0, 0], [0, 0, 1, -5]]);
  assert.ok(result.steps.length > 1);
  assert.deepEqual(result.steps[0].matrix[0], [1, 0, 0, 45]);
  assert.deepEqual(result.steps.at(-1).matrix, result.rref);
});

test('changing sensor data changes the fitted polynomial and landing distance', () => {
  const result = fitQuadratic([{ x: 0, y: 20 }, { x: 1, y: 21 }, { x: 2, y: 18 }]);
  assert.deepEqual(result.coefficients, [20, 3, -2]);
  assert.equal(result.roots.positiveRoot, 4);
  assert.equal(evaluate(result.coefficients, 2), 18);
});

test('Gauss-Jordan elimination uses partial pivoting and records the row swap', () => {
  const result = solveLinearSystem([[0, 1], [1, 1]], [2, 3]);
  assert.deepEqual(result.solution, [1, 2]);
  assert.equal(result.steps[1].operation, 'R1 ↔ R2 (partial pivoting)');
  assert.deepEqual(result.rref, [[1, 0, 1], [0, 1, 2]]);
});

test('large right-hand values do not hide otherwise valid pivots', () => {
  const result = solveLinearSystem([[1, 0], [0, 1]], [1e15, -2e15]);
  assert.deepEqual(result.solution, [1e15, -2e15]);
});

test('singular matrices and malformed/non-finite systems are rejected', () => {
  assert.throws(() => solveLinearSystem([[1, 2], [2, 4]], [3, 6]), /singular|ill-conditioned/i);
  assert.throws(() => solveLinearSystem([[1, 2]], [3]), /square/);
  assert.throws(() => solveLinearSystem([[1, NaN], [0, 1]], [1, 2]), /finite/);
  assert.throws(() => solveLinearSystem([[1, 0], [0, 1]], [1]), /match/);
});

test('interpolation rejects duplicate x-values, non-numeric data, and more than three sensors', () => {
  assert.throws(() => fitQuadratic([{ x: 0, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }]), /distinct/);
  assert.throws(() => fitQuadratic([{ x: 0, y: 1 }, { x: 1, y: Infinity }, { x: 2, y: 3 }]), /finite/);
  assert.throws(() => fitQuadratic([{ x: 0, y: 1 }, { x: 1, y: 2 }]), /exactly three/);
  assert.throws(() => fitQuadratic([{ x: 0, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 4 }]), /exactly three/);
});

test('landing roots support linear and quadratic cases, including no forward root', () => {
  assert.equal(findPositiveRoot([10, -2, 0]).positiveRoot, 5);
  assert.equal(findPositiveRoot([0, 0, 0]).positiveRoot, null);
  assert.equal(findPositiveRoot([1, 0, 1]).positiveRoot, null);
  assert.equal(findPositiveRoot([2, 3, 1]).positiveRoot, null);
  assert.deepEqual(findPositiveRoot([45, 0, -5]).roots, [-3, 3]);
});

test('sampled points and package position follow and clamp to the fitted curve', () => {
  const model = fitQuadratic([{ x: 0, y: 45 }, { x: 1, y: 40 }, { x: 2, y: 25 }]);
  const samples = sampleTrajectory(model.coefficients, model.roots.positiveRoot, 3);
  assert.deepEqual(samples.map(({ x }) => x), [0, 1, 2, 3]);
  assert.deepEqual(samples.map(({ y }) => y), [45, 40, 25, 0]);
  assert.deepEqual(trajectoryPosition(model, .5), { x: 1.5, y: 33.75, progress: .5 });
  assert.deepEqual(trajectoryPosition(model, 1.5), { x: 3, y: 0, progress: 1 });
  assert.deepEqual(trajectoryPosition(model, -1), { x: 0, y: 45, progress: 0 });
});

test('physics sensors are solved back into the trajectory and predict the physical landing', () => {
  const model = generatePhysicsModel({ aircraftSpeed: 60, altitude: 90, gravity: 9.81 });
  const expectedFlightTime = Math.sqrt(2 * 90 / 9.81);
  const expectedLanding = 60 * expectedFlightTime;
  assert.equal(model.points.length, 3);
  assert.ok(model.points.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)));
  assert.ok(Math.abs(model.coefficients[0] - 90) < 1e-9);
  assert.ok(Math.abs(model.coefficients[2] + 9.81 / (2 * 60 ** 2)) < 1e-12);
  model.points.forEach((point) => assert.ok(Math.abs(evaluate(model.coefficients, point.x) - point.y) < 1e-9));
  assert.deepEqual(model.steps.at(-1).matrix, model.rref);
  assert.deepEqual(model.matrix, model.points.map(({ x }) => [1, x, x * x]));
  assert.ok(Math.abs(model.landingX - expectedLanding) < 1e-8);
  assert.ok(Math.abs(positionAtTime(model, expectedFlightTime).x - expectedLanding) < 1e-8);
  assert.ok(Math.abs(positionAtTime(model, expectedFlightTime).y) < 1e-8);
});

test('changing aircraft speed or altitude regenerates the sensor coordinates and fitted curve', () => {
  const baseline = generatePhysicsModel({ aircraftSpeed: 60, altitude: 90 });
  const faster = generatePhysicsModel({ aircraftSpeed: 90, altitude: 90 });
  const higher = generatePhysicsModel({ aircraftSpeed: 60, altitude: 150 });
  assert.notDeepEqual(faster.points, baseline.points);
  assert.notDeepEqual(higher.points, baseline.points);
  assert.ok(faster.landingDistance > baseline.landingDistance);
  assert.ok(higher.landingDistance > baseline.landingDistance);
});

test('wind is a signed velocity adjustment and disabled wind has no effect', () => {
  const calm = generatePhysicsModel({ aircraftSpeed: 12, altitude: 80, windEnabled: false, windSpeed: 18 });
  const tailwind = generatePhysicsModel({ aircraftSpeed: 12, altitude: 80, windEnabled: true, windSpeed: 8, windDirection: 'tailwind' });
  const headwind = generatePhysicsModel({ aircraftSpeed: 12, altitude: 80, windEnabled: true, windSpeed: 8, windDirection: 'headwind' });
  const strongHeadwind = generatePhysicsModel({ aircraftSpeed: 12, altitude: 80, windEnabled: true, windSpeed: 18, windDirection: 'headwind' });
  assert.equal(calm.effectiveHorizontalSpeed, 12);
  assert.equal(tailwind.effectiveHorizontalSpeed, 20);
  assert.equal(headwind.effectiveHorizontalSpeed, 4);
  assert.equal(strongHeadwind.effectiveHorizontalSpeed, -6);
  assert.ok(tailwind.landingDistance > calm.landingDistance);
  assert.ok(headwind.landingDistance < calm.landingDistance);
  assert.ok(strongHeadwind.landingX < 0);
  assert.ok(Math.abs(strongHeadwind.landingX + 6 * strongHeadwind.flightTime) < 1e-8);
});

test('zero effective horizontal velocity uses an explicit time-basis fit', () => {
  const model = generatePhysicsModel({ aircraftSpeed: 10, altitude: 45, windEnabled: true, windSpeed: 10, windDirection: 'headwind' });
  assert.equal(model.basis, 'time');
  assert.equal(model.landingX, 0);
  assert.ok(Math.abs(model.landingTime - Math.sqrt(90 / 9.81)) < 1e-8);
  assert.ok(model.scenePoints.every(({ x }) => x === 0));
  assert.ok(Math.abs(positionAtTime(model, model.flightTime).y) < 1e-8);
});