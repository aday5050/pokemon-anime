import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Render the real hook with controlled context and Firestore boundaries.
function createHookHarness() {
  let context = { currentUser: null, progressData: {}, loading: false };
  let hooks = [];
  let cursor = 0;
  let effects = [];
  let changed = false;
  const writes = [];
  const sameDeps = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const useState = (initial) => {
    const i = cursor++;
    if (!(i in hooks)) hooks[i] = initial;
    return [hooks[i], (value) => {
      const next = typeof value === 'function' ? value(hooks[i]) : value;
      if (!Object.is(next, hooks[i])) { hooks[i] = next; changed = true; }
    }];
  };
  const useRef = (initial) => {
    const i = cursor++;
    if (!(i in hooks)) hooks[i] = { current: initial };
    return hooks[i];
  };
  const useEffect = (fn, deps) => {
    const i = cursor++;
    if (!sameDeps(hooks[i], deps)) { hooks[i] = deps; effects.push(fn); }
  };
  const useCallback = (fn, deps) => {
    const i = cursor++;
    if (!hooks[i] || !sameDeps(hooks[i].deps, deps)) hooks[i] = { fn, deps };
    return hooks[i].fn;
  };
  const source = readFileSync(new URL('../src/hooks/useWatchProgress.js', import.meta.url), 'utf8')
    .replace(/^import .*;\s*$/gm, '')
    .replace('export function useWatchProgress', 'function useWatchProgress');
  const factory = new Function('useState', 'useEffect', 'useRef', 'useCallback', 'doc', 'setDoc', 'db', 'useAuth', 'useProgress', `${source}\nreturn useWatchProgress;`);
  const hook = factory(useState, useEffect, useRef, useCallback,
    (_db, _collection, uid) => uid,
    async (uid, data) => { writes.push({ uid, data }); }, {},
    () => ({ currentUser: context.currentUser }),
    () => ({ progressData: context.progressData, loading: context.loading }));
  return {
    render(episodeId, next) {
      context = { ...context, ...next };
      let value;
      let iterations = 0;
      do {
        if (++iterations > 20) throw new Error('Infinite render loop');
        cursor = 0; changed = false; effects = [];
        value = hook(episodeId);
        for (const effect of effects) effect();
      } while (changed);
      return value;
    },
    writes,
  };
}

test('waits for stored progress before restoring an episode', () => {
  const harness = createHookHarness();
  const user = { uid: 'one' };
  let player = harness.render('1_1', { currentUser: user, loading: true });
  assert.equal(player.isLoaded, false);
  player = harness.render('1_1', { loading: false, progressData: { '1_1': { time: 420 } } });
  assert.equal(player.isLoaded, true);
  assert.equal(player.initialProgress, 420);
});

test('restores the same episode separately for a new account', () => {
  const harness = createHookHarness();
  harness.render('1_1', { currentUser: { uid: 'one' }, loading: false, progressData: { '1_1': { time: 120 } } });
  let player = harness.render('1_1', { currentUser: { uid: 'two' }, loading: true, progressData: {} });
  assert.equal(player.isLoaded, false);
  player = harness.render('1_1', { loading: false, progressData: { '1_1': { time: 300 } } });
  assert.equal(player.initialProgress, 300);
});

test('writes progress to the currently signed in account', async () => {
  const harness = createHookHarness();
  harness.render('1_1', { currentUser: { uid: 'one' }, loading: false, progressData: {} });
  const player = harness.render('1_1', { currentUser: { uid: 'two' }, loading: false, progressData: {} });
  await player.saveProgress(30);
  assert.equal(harness.writes.at(-1).uid, 'two');
});
