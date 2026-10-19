import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=(p:string)=>fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('desks never carry build credentials or refresh steps',()=>{
 for(const name of ['v2-editorial-pipeline.yml','v2-manual-desk.yml']){
 const source=read('.github/workflows/'+name);
 assert.doesNotMatch(source,/BUILD_HOOK|refresh_publication|Request.*refresh/);
 assert.doesNotMatch(source,/maritime_energy|west_asia|technology_ai|global_politics|markets_capital/);
 }
});
test('only daily release is scheduled to build; exceptional publication requires explicit flag',()=>{
 const daily=read('.github/workflows/v2-daily-release.yml');assert.match(daily,/cron: '0 5 \* \* \*'/);
 const extra=read('.github/workflows/v2-static-refresh.yml');assert.doesNotMatch(extra,/cron:|schedule:/);
 assert.match(extra,/inputs.publish_now && !inputs.dry_run/);
 assert.match(extra,/regional-publication/);assert.match(daily,/regional-publication/);
 assert.match(read('pipeline/refresh_publication.py'),/Direct refresh builds are retired/);
});
test('queue maintenance has no model approval or build path',()=>{
 const queue=read('.github/workflows/v2-queue-maintenance.yml');assert.doesNotMatch(queue,/BUILD_HOOK|refresh_publication/);
 const source=read('pipeline/recheck_queue.py');
 const run=source.slice(source.indexOf('def run('),source.indexOf("if __name__"));
 assert.doesNotMatch(run,/_claude_final_recovery|Ready to Post.*True|archived.*True/);
});
