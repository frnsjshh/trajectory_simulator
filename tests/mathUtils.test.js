const test = require('node:test');
const assert = require('node:assert/strict');
const mathUtils = require('../js/mathUtils.js');

test('mathUtils vector operations: creation, addition, subtraction, scaling, dot product, and norm', () => {
  const v1 = [1, 2, 3];
  const v2 = [4, -5, 6];

  assert.deepEqual(mathUtils.createVector(3, 0), [0, 0, 0]);
  assert.deepEqual(mathUtils.vectorAdd(v1, v2), [5, -3, 9]);
  assert.deepEqual(mathUtils.vectorSubtract(v1, v2), [-3, 7, -3]);
  assert.deepEqual(mathUtils.vectorScale(v1, 2), [2, 4, 6]);
  assert.equal(mathUtils.dotProduct(v1, v2), 1 * 4 + 2 * -5 + 3 * 6); // 4 - 10 + 18 = 12
  assert.equal(mathUtils.vectorNorm([3, 4]), 5);
});

test('mathUtils matrix operations: creation, cloning, augmentation, multiplication, and row operations', () => {
  const A = [[1, 2], [3, 4]];
  const B = [5, 6];

  assert.deepEqual(mathUtils.cloneMatrix(A), A);
  assert.notEqual(mathUtils.cloneMatrix(A), A);

  const augmented = mathUtils.augmentMatrix(A, B);
  assert.deepEqual(augmented, [[1, 2, 5], [3, 4, 6]]);

  const product = mathUtils.matrixVectorMultiply(A, [2, 1]);
  assert.deepEqual(product, [1 * 2 + 2 * 1, 3 * 2 + 4 * 1]); // [4, 10]

  const swapped = mathUtils.swapRows(mathUtils.cloneMatrix(A), 0, 1);
  assert.deepEqual(swapped, [[3, 4], [1, 2]]);

  const scaled = mathUtils.scaleRow(mathUtils.cloneMatrix(A), 0, 3);
  assert.deepEqual(scaled, [[3, 6], [3, 4]]);

  const rowOp = mathUtils.addScaledRow(mathUtils.cloneMatrix(A), 1, 0, -3);
  assert.deepEqual(rowOp, [[1, 2], [0, -2]]);
});

test('mathUtils Gauss-Jordan elimination produces exact RREF and solution vector', () => {
  const A = [[1, 0, 0], [1, 1, 1], [1, 2, 4]];
  const B = [45, 40, 25];
  const result = mathUtils.solveLinearSystem(A, B);

  assert.deepEqual(result.solution, [45, 0, -5]);
  assert.deepEqual(result.rref, [[1, 0, 0, 45], [0, 1, 0, 0], [0, 0, 1, -5]]);
  assert.ok(result.steps.length > 0);
});

test('mathUtils polynomial evaluation using Horner method', () => {
  const coeffs = [45, 0, -5]; // y = 45 - 5x²
  assert.equal(mathUtils.evaluatePolynomial(coeffs, 0), 45);
  assert.equal(mathUtils.evaluatePolynomial(coeffs, 1), 40);
  assert.equal(mathUtils.evaluatePolynomial(coeffs, 2), 25);
  assert.equal(mathUtils.evaluatePolynomial(coeffs, 3), 0);
  assert.equal(mathUtils.evaluate(coeffs, 3), 0); // Alias check
});

test('mathUtils parabola vertex calculation', () => {
  const vertex = mathUtils.calculateParabolaVertex([45, 10, -5]);
  // x_v = -10 / (2 * -5) = 1
  // y_v = 45 + 10(1) - 5(1)^2 = 50
  assert.equal(vertex.x, 1);
  assert.equal(vertex.y, 50);

  // Linear case has no vertex
  assert.equal(mathUtils.calculateParabolaVertex([45, 10, 0]), null);
});

test('mathUtils Citardauq quadratic root finder', () => {
  const rootsResult = mathUtils.findPolynomialRoots([45, 0, -5]);
  assert.deepEqual(rootsResult.roots, [-3, 3]);
  assert.equal(rootsResult.positiveRoot, 3);

  // Backward compatibility alias
  assert.equal(mathUtils.findPositiveRoot([45, 0, -5]).positiveRoot, 3);
});

test('mathUtils quadratic curve fitting with Vandermonde matrix', () => {
  const points = [{ x: 0, y: 45 }, { x: 1, y: 40 }, { x: 2, y: 25 }];
  const fitted = mathUtils.fitQuadratic(points);

  assert.deepEqual(fitted.coefficients, [45, 0, -5]);
  assert.equal(fitted.roots.positiveRoot, 3);
  assert.deepEqual(fitted.matrix, [[1, 0, 0], [1, 1, 1], [1, 2, 4]]);
});

test('mathUtils kinematics formulas: flight time, speed, and position', () => {
  const flightTime = mathUtils.calculateFlightTime(90, 9.81);
  const expectedTime = Math.sqrt((2 * 90) / 9.81);
  assert.ok(Math.abs(flightTime - expectedTime) < 1e-12);

  const effSpeedTail = mathUtils.calculateEffectiveHorizontalSpeed(60, 10, 'tailwind', true);
  assert.equal(effSpeedTail, 70);

  const effSpeedHead = mathUtils.calculateEffectiveHorizontalSpeed(60, 10, 'headwind', true);
  assert.equal(effSpeedHead, 50);

  const effSpeedCalm = mathUtils.calculateEffectiveHorizontalSpeed(60, 10, 'tailwind', false);
  assert.equal(effSpeedCalm, 60);

  const pos = mathUtils.calculateKinematicPosition(90, 60, 9.81, 1);
  assert.equal(pos.x, 60);
  assert.ok(Math.abs(pos.y - (90 - 0.5 * 9.81)) < 1e-12);
});

test('mathUtils numerical utilities: positiveModulo, exponentialDecay, niceScaleTick, formatPolynomial', () => {
  assert.equal(mathUtils.positiveModulo(-5, 8), 3);
  assert.equal(mathUtils.positiveModulo(11, 8), 3);

  const smoothed = mathUtils.exponentialDecayBlend(0, 10, 6, 0.5);
  assert.ok(smoothed > 0 && smoothed < 10);

  assert.equal(mathUtils.niceScaleTick(23), 20);
  assert.equal(mathUtils.niceScaleTick(75), 50);
  assert.equal(mathUtils.niceScaleTick(12), 10);

  assert.equal(mathUtils.formatPolynomialText([90, 0, -0.005]), 'y = 90 − 0.005x²');
  assert.equal(mathUtils.formatPolynomialText([90, 5, -0.005]), 'y = 90 + 5x − 0.005x²');
});

test('mathUtils flight path validation', () => {
  const validModel = mathUtils.fitQuadratic([{ x: 0, y: 45 }, { x: 1, y: 40 }, { x: 2, y: 25 }]);
  assert.equal(mathUtils.validateFlightPath(validModel).valid, true);

  const undergroundModel = {
    coefficients: [-10, 5, -1],
    roots: { positiveRoot: 5 },
    landingX: 5
  };
  assert.equal(mathUtils.validateFlightPath(undergroundModel).valid, false);
});
