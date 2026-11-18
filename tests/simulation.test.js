const test = require('node:test');
const assert = require('node:assert/strict');
const { advanceSimulation, createSimulationState, transitionSimulation } = require('../js/app.js');

test('flight state advances through start, release, pause, resume, and landing', () => {
  let state = createSimulationState();
  assert.equal(state.status, 'READY');
  state = transitionSimulation(state, 'start');
  assert.equal(state.status, 'FLYING');
  state.planeProgress = .2;
  state = transitionSimulation(state, 'drop');
  assert.equal(state.status, 'FALLING');
  assert.equal(state.releasePlaneProgress, .2);
  state.progress = .42;
  state = transitionSimulation(state, 'pause');
  assert.equal(state.status, 'PAUSED');
  assert.equal(state.previousState, 'FALLING');
  assert.equal(state.progress, .42);
  state = transitionSimulation(state, 'resume');
  assert.equal(state.status, 'FALLING');
  assert.equal(state.progress, .42);
  state = transitionSimulation(state, 'land');
  assert.equal(state.status, 'LANDED');
  assert.equal(state.progress, 1);
});

test('reset and replay restore repeatable initial flight state', () => {
  let state = transitionSimulation(createSimulationState(), 'start');
  state = transitionSimulation(state, 'drop');
  state.progress = .8;
  state = transitionSimulation(state, 'reset');
  assert.deepEqual(state, createSimulationState());
  state = transitionSimulation(state, 'replay');
  assert.equal(state.status, 'FLYING');
  assert.equal(state.progress, 0);
  assert.equal(state.planeProgress, 0);
});

test('unsupported state transitions do not skip simulation phases', () => {
  let state = createSimulationState();
  state = transitionSimulation(state, 'drop');
  assert.equal(state.status, 'READY');
  state = transitionSimulation(state, 'pause');
  assert.equal(state.status, 'READY');
  state = transitionSimulation(state, 'land');
  assert.equal(state.status, 'READY');
});

test('aircraft movement uses physical speed and is independent of frame partitioning', () => {
  const model = { flightTime: 4 };
  const start = transitionSimulation(createSimulationState(), 'start');
  const oneFrame = advanceSimulation(start, 0.2, { aircraftSpeed: 50 }, model, 1);
  let manyFrames = start;
  for (let index = 0; index < 8; index += 1) manyFrames = advanceSimulation(manyFrames, 0.025, { aircraftSpeed: 50 }, model, 1);
  assert.equal(oneFrame.planeDistance, 10);
  assert.equal(manyFrames.planeDistance, 10);
});

test('release captures the current aircraft position, package lands after model flight time, and pause freezes time', () => {
  const model = { flightTime: 2 };
  let state = transitionSimulation(createSimulationState(), 'start');
  state = advanceSimulation(state, 1, { aircraftSpeed: 30 }, model, 1);
  state = transitionSimulation(state, 'drop');
  assert.equal(state.releasePlaneDistance, 30);
  const paused = transitionSimulation(state, 'pause');
  const frozen = advanceSimulation(paused, 1, { aircraftSpeed: 30 }, model, 1);
  assert.deepEqual([frozen.time, frozen.planeDistance, frozen.flightElapsed], [paused.time, paused.planeDistance, paused.flightElapsed]);
  state = transitionSimulation(paused, 'resume');
  state = advanceSimulation(state, 2, { aircraftSpeed: 30 }, model, 1);
  assert.equal(state.status, 'LANDED');
  assert.equal(state.progress, 1);
  assert.equal(state.planeDistance, 90);
});