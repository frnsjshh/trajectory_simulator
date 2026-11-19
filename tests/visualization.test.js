const test = require('node:test');
const assert = require('node:assert/strict');
const { generatePhysicsModel, positionAtTime } = require('../js/trajectory.js');
const { createSceneViewport } = require('../js/visualization.js');

function viewportFor(width, height, model, overrides = {}) {
  return createSceneViewport(width, height, model, {
    state: 'READY',
    planeDistance: 0,
    releasePlaneDistance: 0,
    parameters: { aircraftSpeed: 60, altitude: 90 },
    ...overrides
  });
}

test('scene camera maps release, sensors, fitted curve, and target through one bounded world transform', () => {
  const model = generatePhysicsModel({ aircraftSpeed: 60, altitude: 90 });
  const viewport = viewportFor(900, 480, model);
  const releaseX = viewport.mapSceneX(0);
  const landingX = viewport.mapSceneX(model.landingX);
  assert.equal(releaseX, viewport.originX);
  assert.ok(releaseX > viewport.left && releaseX < viewport.right);
  assert.ok(landingX > viewport.left && landingX < viewport.right);
  for (const point of model.scenePoints) {
    const mapped = viewport.mapSceneX(point.x);
    assert.ok(mapped >= viewport.left && mapped <= viewport.right);
    assert.ok(viewport.mapY(point.y) >= viewport.yTop);
    assert.ok(viewport.mapY(point.y) <= viewport.groundY);
  }
});

test('signed and vertical flights remain on-screen and the release coordinate stays fixed after dropping', () => {
  const vertical = generatePhysicsModel({ aircraftSpeed: 20, altitude: 120, windEnabled: true, windSpeed: 20, windDirection: 'headwind' });
  const ready = viewportFor(640, 360, vertical);
  const falling = viewportFor(640, 360, vertical, { state: 'FALLING', planeDistance: 20, releasePlaneDistance: 0 });
  assert.equal(vertical.landingX, 0);
  assert.equal(ready.originX, falling.mapSceneX(0));
  assert.ok(falling.planeX > falling.originX);

  const leftward = generatePhysicsModel({ aircraftSpeed: 10, altitude: 120, windEnabled: true, windSpeed: 20, windDirection: 'headwind' });
  const leftView = viewportFor(640, 360, leftward);
  assert.ok(leftward.landingX < 0);
  assert.ok(leftView.mapSceneX(leftward.landingX) >= leftView.left);
  assert.ok(leftView.mapSceneX(leftward.landingX) <= leftView.right);
});

test('aircraft stays anchored before release, then flies right off-screen without wrapping', () => {
  const model = generatePhysicsModel({ aircraftSpeed: 60, altitude: 90 });
  const initial = viewportFor(900, 480, model);
  const flying = viewportFor(900, 480, model, { state: 'FLYING', planeDistance: 30 });
  assert.equal(flying.originX, initial.originX, 'the scenery movement must not move the aircraft or attached crate');
  assert.equal(flying.planeX, initial.planeX);
  const dropping = viewportFor(900, 480, model, { state: 'FALLING', planeDistance: 30, releasePlaneDistance: 0 });
  assert.equal(dropping.originX, flying.originX, 'release must not move the crate or predicted curve');
  assert.ok(dropping.planeX > dropping.originX, 'the aircraft starts moving right after release');
  const landed = viewportFor(900, 480, model, { state: 'LANDED', planeDistance: 10000, releasePlaneDistance: 0 });
  assert.equal(landed.originX, dropping.originX, 'the package and target stay fixed while the aircraft leaves');
  assert.ok(landed.planeX > landed.right, 'the aircraft continues right until it exits the viewport');
});

test('manual quadratic peaks between sensors are included in camera bounds', () => {
  const model = { coefficients: [45, 50, -5], releaseAltitude: 45, landingX: 10.83, scenePoints: [{ x: 0, y: 45 }, { x: 8, y: 125 }, { x: 10, y: 45 }] };
  const viewport = viewportFor(640, 360, model);
  assert.ok(viewport.maxAltitude >= 170);
  assert.ok(viewport.mapY(170) >= viewport.yTop);
});

test('resizing changes screen mapping while preserving world-space release and landing alignment', () => {
  const model = generatePhysicsModel({ aircraftSpeed: 120, altitude: 200, windEnabled: true, windSpeed: 20, windDirection: 'tailwind' });
  const small = viewportFor(390, 320, model, { state: 'FALLING', planeDistance: 70, releasePlaneDistance: 70 });
  const large = viewportFor(1200, 700, model, { state: 'FALLING', planeDistance: 70, releasePlaneDistance: 70 });
  assert.equal(small.worldReleaseX, large.worldReleaseX);
  assert.equal(small.worldDomain, large.worldDomain);
  assert.ok(small.mapSceneX(model.landingX) < small.right);
  assert.ok(large.mapSceneX(model.landingX) < large.right);
  for (const viewport of [small, large]) {
    for (const point of model.scenePoints) {
      assert.ok(viewport.mapSceneX(point.x) >= viewport.left && viewport.mapSceneX(point.x) <= viewport.right);
      assert.ok(viewport.mapY(point.y) >= viewport.yTop && viewport.mapY(point.y) <= viewport.groundY);
    }
    for (let index = 0; index <= 20; index += 1) {
      const position = positionAtTime(model, model.flightTime * index / 20);
      const screenX = viewport.mapSceneX(position.x);
      const screenY = viewport.mapY(position.y);
      assert.ok(screenX >= viewport.left && screenX <= viewport.right);
      assert.ok(screenY >= viewport.yTop && screenY <= viewport.groundY);
    }
  }
});