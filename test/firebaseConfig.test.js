import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasFirebaseConfig } from '../src/lib/firebaseConfig.js';

test('requires the values needed for Google authentication and Firestore', () => {
  assert.equal(hasFirebaseConfig({}), false);
  assert.equal(hasFirebaseConfig({ apiKey: 'key', authDomain: 'domain', projectId: 'project', appId: 'app' }), true);
  assert.equal(hasFirebaseConfig({ apiKey: ' ', authDomain: 'domain', projectId: 'project', appId: 'app' }), false);
});
