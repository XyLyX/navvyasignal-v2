import test from 'node:test';
import assert from 'node:assert/strict';
import {expectedWindow,editorialState,type EditorialAssessment} from '../src/lib/editorialFormatStatus.ts';
import type {Story} from '../src/lib/notion.ts';
const story=(date:string,title='Report')=>({createdAt:date,title} as Story);
test('Monday weekly edition covers the completed Monday-Sunday period',()=>{
 assert.deepEqual(expectedWindow('Briefing',new Date('2026-10-19T05:00:00Z')),{start:'2026-10-12',end:'2026-10-18',publishedSince:'2026-10-19'});
 assert.deepEqual(expectedWindow('Long Read',new Date('2026-10-20T10:00:00Z')),{start:'2026-10-12',end:'2026-10-18',publishedSince:'2026-10-19'});
});
test('before 09:00 the previous publication cycle remains valid',()=>{
 assert.equal(expectedWindow('Cross-Desk',new Date('2026-10-19T04:59:00Z')).start,'2026-10-18');
 assert.equal(expectedWindow('Cross-Desk',new Date('2026-10-19T05:00:00Z')).start,'2026-10-19');
});
test('old cards are explicitly previous reports and never presented as current',()=>{
 for(const kind of ['Cross-Desk','Briefing','Long Read'] as const) {
  const state=editorialState(kind,story('2026-10-07T06:00:00Z'),[],new Date('2026-10-19T10:00:00Z'));
  assert.equal(state.current,false);assert.match(state.message,/pending/);
 }
});
test('today publication cannot disguise a briefing for the wrong week',()=>{
 assert.equal(editorialState('Briefing',story('2026-10-19T06:00:00Z','Weekly Briefing — 2026-10-05 to 2026-10-11'),[],new Date('2026-10-19T10:00:00Z')).current,false);
});
test('no connection is an assessed outcome rather than a made-up current article',()=>{
 const assessment:EditorialAssessment={format:'Cross-Desk',edition:'2026-10-19',periodStart:'2026-10-19',periodEnd:'2026-10-19',status:'no_connection',completedAt:'2026-10-19T04:15:00Z'};
 const state=editorialState('Cross-Desk',story('2026-10-07T06:00:00Z'),[assessment],new Date('2026-10-19T10:00:00Z'));
 assert.equal(state.current,false);assert.match(state.message,/assessed/);
});
test('new verified reports are current and future records cannot claim freshness',()=>{
 assert.equal(editorialState('Long Read',story('2026-10-19T06:00:00Z'),[],new Date('2026-10-19T10:00:00Z')).current,true);
 assert.equal(editorialState('Long Read',story('2026-10-20T06:00:00Z'),[],new Date('2026-10-19T10:00:00Z')).current,false);
});
