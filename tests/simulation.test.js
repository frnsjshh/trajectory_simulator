const test = require('node:test');
const assert = require('node:assert/strict');
const { createSimulationState, transitionSimulation } = require('../js/app.js');

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