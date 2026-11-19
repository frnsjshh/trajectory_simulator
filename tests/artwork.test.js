const test = require('node:test');
const assert = require('node:assert/strict');
const artworkModule = require('../js/artwork.js');
const { generatePhysicsModel } = require('../js/trajectory.js');
const { drawScene } = require('../js/visualization.js');

function recordingContext() {
  const calls = Object.create(null);
  const gradient = { addColorStop() {} };
  const context = new Proxy({ calls }, {
    get(target, property) {
      if (property in target) return target[property];
      if (property === 'createLinearGradient' || property === 'createRadialGradient') return () => gradient;
      return (..._args) => { calls[property] = (calls[property] || 0) + 1; };
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    }
  });
  return context;
}

test('default local sprites are replaceable and contain-fit sizing preserves source proportions', () => {
  assert.equal(artworkModule.DEFAULT_ASSETS.aircraft, 'assets/aircraft/courier.svg');
  assert.equal(artworkModule.DEFAULT_ASSETS.package, 'assets/package/supply-crate.svg');
  const plane = artworkModule.getContainedRect(240, 100, 50, 40, 106, 48);
  assert.ok(plane.width <= 106 && plane.height <= 48);
  assert.ok(Math.abs(plane.width / plane.height - 2.4) < 1e-12);
  assert.equal(plane.x + plane.width / 2, 50);
  assert.equal(plane.y + plane.height / 2, 40);
});

test('parallax layers move at distinct speeds, cloud drift shares the clock, and repeat offsets wrap exactly', () => {
  const still = artworkModule.getParallaxOffsets(0, 0, 900);
  const moving = artworkModule.getParallaxOffsets(100, 10, 900);
  assert.ok(moving.mountains < moving.hills);
  assert.ok(moving.hills < moving.forest);
  assert.ok(moving.forest < moving.foreground);
  assert.ok(moving.cloudFar > still.cloudFar);
  assert.ok(moving.cloudNear > moving.cloudFar);
  assert.equal(artworkModule.getRepeatOffset(773, 73), artworkModule.getRepeatOffset(700, 73));
  assert.equal(artworkModule.getRepeatOffset(-1, 73), 72);
});

test('scenery profiles are varied, deterministic, and returned as independent records', () => {
  const first = artworkModule.getSceneryProfile();
  const second = artworkModule.getSceneryProfile();
  assert.equal(first.length, 44);
  assert.deepEqual(first, second);
  assert.notEqual(first[0], second[0]);
  assert.ok(new Set(first.map((tree) => tree.shape)).size > 1);
  assert.ok(new Set(first.map((tree) => tree.foliage)).size > 1);
  first[0].shape = 99;
  assert.notEqual(artworkModule.getSceneryProfile()[0].shape, 99);
});

test('Canvas scenery and vehicle fallbacks render locally without external image objects', () => {
  const artwork = artworkModule.createArtwork({ ImageConstructor: null });
  const ctx = recordingContext();
  assert.equal(artwork.getAssetStatus('aircraft'), 'fallback');
  assert.equal(artwork.getAssetStatus('package'), 'fallback');
  artwork.drawEnvironment(ctx, 900, 480, 1.2, 145);
  artwork.drawAircraft(ctx, null, 300, 140, 1, 2);
  artwork.drawPackage(ctx, null, 320, 260, 0.3, 1);
  assert.ok(ctx.calls.fillRect > 0);
  assert.ok(ctx.calls.ellipse > 0);
  assert.ok(ctx.calls.quadraticCurveTo > 0);
  assert.equal(ctx.calls.drawImage || 0, 0);
});

test('scene artwork draws through the shared viewport without mutating simulation input', () => {
  const model = generatePhysicsModel({ aircraftSpeed: 60, altitude: 90 });
  const frame = {
    model,
    time: 1.1,
    state: 'FALLING',
    previousState: 'FALLING',
    planeDistance: 24,
    releasePlaneDistance: 24,
    packagePosition: { x: 32, y: 70 },
    parameters: { aircraftSpeed: 60 },
    trajectoryVisible: true,
    sensorsVisible: true,
    landingVisible: true
  };
  const original = JSON.stringify(frame);
  const context = recordingContext();
  const canvas = {
    width: 900,
    height: 480,
    getBoundingClientRect: () => ({ width: 900, height: 480 }),
    getContext: () => context
  };
  const previousWindow = global.window;
  global.window = { devicePixelRatio: 1 };
  try {
    const viewport = drawScene(canvas, frame);
    assert.ok(viewport.mapSceneX(model.landingX) > viewport.left);
    assert.ok((context.calls.drawImage || 0) > 0 || (context.calls.ellipse || 0) > 0);
  } finally {
    if (previousWindow === undefined) delete global.window;
    else global.window = previousWindow;
  }
  assert.equal(JSON.stringify(frame), original);
});