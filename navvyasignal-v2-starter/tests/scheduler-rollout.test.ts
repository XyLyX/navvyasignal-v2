import test from 'node:test';
import assert from 'node:assert/strict';
import {schedulerConfiguration} from '../src/lib/scheduler-rollout.ts';
import {schedulerActive} from '../src/lib/editorial-scheduler.ts';

test('emergency off overrides the versioned rollout',()=>{
  const c=schedulerConfiguration('off','2026-01-01T00:00:00Z');
  assert.equal(schedulerActive(c.mode,c.startAt,new Date('2026-10-03T00:00:00Z')),false);
});
test('probe cannot claim ownership of live desk scheduling',()=>{
  const c=schedulerConfiguration('probe','2026-01-01T00:00:00Z');
  assert.equal(schedulerActive(c.mode,c.startAt,new Date('2026-10-03T00:00:00Z')),false);
});
test('future cutover claims ownership only at its boundary',()=>{
  const c=schedulerConfiguration('live','2026-10-02T22:30:00Z');
  assert.equal(schedulerActive(c.mode,c.startAt,new Date('2026-10-02T22:29:59Z')),false);
  assert.equal(schedulerActive(c.mode,c.startAt,new Date('2026-10-02T22:30:00Z')),true);
});
test('invalid cutover time remains inactive',()=>{
  const c=schedulerConfiguration('live','invalid');
  assert.equal(schedulerActive(c.mode,c.startAt,new Date()),false);
});
