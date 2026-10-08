import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import worker from '../dist/server/index.js';
import { scoreDatabase } from './preview-scores-db.mjs';

const DB=scoreDatabase(),env={DB,ASSETS:{fetch:async()=>new Response('asset')}};
const call=(song='test-song',difficulty='hard',method='GET',data=null,user='owner',origin='https://game.test')=>worker.fetch(new Request(`https://game.test/api/scores/${song}/${difficulty}`,{method,headers:{...(user?{'oai-authenticated-user-id':user}:{}),Origin:origin,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})}),env);
const result=(score,maxCombo=100,overrides={})=>({id:randomUUID(),songId:'test-song',difficulty:'hard',score,maxCombo,noteCount:200,auto:false,completed:true,...overrides});
assert.deepEqual(await(await call()).json(),[]);
for(const [score,combo] of [[720000,75],[1000000,200],[930000,115],[800000,90],[930000,120],[960000,130],[650000,50]])assert.equal((await call('test-song','hard','POST',result(score,combo))).status,200);
let top=await(await call()).json();assert.equal(top.length,5);
assert.deepEqual(top.map(r=>[r.score,r.maxCombo]),[[1000000,200],[960000,130],[930000,120],[930000,115],[800000,90]]);
assert.deepEqual(await(await call('test-song','normal')).json(),[]);
assert.deepEqual(await(await call('other-song')).json(),[]);
assert.deepEqual(await(await call('test-song','hard','GET',null,'other-user')).json(),[]);
assert.equal((await call('test-song','hard','GET',null,null)).status,401);
assert.equal((await call('test-song','hard','POST',result(1000000,200),'owner','https://elsewhere.test')).status,403);
const retry=result(990000,190);let once=await(await call('test-song','hard','POST',retry)).json();
const twice=await(await call('test-song','hard','POST',retry)).json();assert.deepEqual(twice,once);
assert.equal((await DB.prepare('SELECT COUNT(*) AS total FROM scores WHERE user_id=? AND run_id=?').bind('owner',retry.id).first()).total,1);
assert.equal((await call('test-song','hard','POST',{...retry,score:123})).status,409);
for(const patch of [{auto:true},{completed:false},{score:1000001},{score:-1},{score:12.5},{maxCombo:201},{maxCombo:-1},{noteCount:0},{noteCount:10001},{id:'../bad'},{songId:'wrong'},{difficulty:'light'}])assert.equal((await call('test-song','hard','POST',result(900000,100,patch))).status,400);
assert.equal((await call('rules-practice','hard','POST',result(1000000,100,{songId:'rules-practice'}))).status,400);
assert.equal((await call('test-song','master')).status,400);
assert.equal((await call('test-song','hard','PUT',result(999000))).status,405);
assert.equal((await call('test-song','hard','POST',{...result(900000),padding:'x'.repeat(5000)})).status,413);
assert.equal((await worker.fetch(new Request('https://game.test/api/scores/test-song/hard',{headers:{'oai-authenticated-user-id':'owner'}}),{ASSETS:env.ASSETS})).status,503);
assert.equal(await(await worker.fetch(new Request('https://game.test/index.html'),env)).text(),'asset');
const plan=await DB.prepare('EXPLAIN QUERY PLAN SELECT score,max_combo FROM scores WHERE user_id=? AND song_id=? AND difficulty=? ORDER BY score DESC,max_combo DESC,played_at DESC LIMIT 5').bind('owner','test-song','hard').all();
assert.ok(plan.results.some(r=>r.detail.includes('idx_scores_user_song_difficulty_best')));
DB.close();
console.log('PASS cloud top five, score/COMBO ordering, user/song/difficulty isolation, idempotent retries, validation, indexed query and exact million-point storage');

const require=createRequire(import.meta.url),base=fs.readFileSync('tools/test-chart-editor.cjs','utf8');
const harness=base.slice(0,base.indexOf('(async()=>{'));
const {run,el,ctx}=new Function('require',harness+'return {run,el,ctx};')(require);
const clientDB=scoreDatabase(),clientEnv={DB:clientDB,ASSETS:env.ASSETS},audioFetch=ctx.fetch;
let blockSave=false,postCount=0,delayNextLoad=null;
ctx.crypto={randomUUID};el('#score-history').dataset={};
ctx.fetch=async(url,options={})=>{
 if(!url.startsWith('/api/scores/'))return audioFetch(url,options);
 if(options.method==='POST'){postCount++;if(blockSave)throw new Error('offline');}
 const response=await worker.fetch(new Request('https://game.test'+url,{method:options.method||'GET',headers:{'oai-authenticated-user-id':'client-owner',Origin:'https://game.test','Content-Type':'application/json'},...(options.body?{body:options.body}:{})}),clientEnv);
 if(!options.method&&delayNextLoad){const release=delayNextLoad;delayNextLoad=null;await release;}
 return response;
};
run(fs.readFileSync('dist/client/score-history.js','utf8'));
const settle=async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));};
const setup=auto=>run(`mode='idle';currentSong={id:'client-song',title:'Test',bpm:120,duration:2,file:'audio/test.mp3',charts:{hard:[{t:.1,end:.1,lane:0,type:'tap'},{t:.3,end:.3,lane:1,type:'tap'}]}};songBuffers.set(currentSong.id,{duration:2});$('#difficulty').value='hard';$('#auto').checked=${auto};`);
run("BeatStreamScores.show('client-song','hard')");await settle();assert.equal(el('[data-history-status]').textContent,'NO RECORD');
setup(false);await run('start()');run('ac.currentTime=startAt+3;notes.forEach(n=>judge(n,0));finish();finish()');await settle();
assert.equal(postCount,1,'one completed manual run is saved once');
let rows=await clientDB.prepare('SELECT * FROM scores').all();assert.equal(rows.results.length,1);assert.equal(rows.results[0].score,1000000);assert.equal(rows.results[0].max_combo,2);
run("BeatStreamScores.show('client-song','hard')");await settle();assert.match(el('[data-history-rows]').innerHTML,/1,000,000/);
setup(true);await run('start()');run('notes.forEach(n=>judge(n,0));finish()');await settle();assert.equal(postCount,1,'AUTO is excluded');
setup(false);run('currentSong.rulesPractice=true');await run('start()');run('notes.forEach(n=>judge(n,0));finish()');await settle();assert.equal(postCount,1,'tutorial is excluded');
setup(false);await run('start()');run('notes.forEach(n=>judge(n,0));showSongMenu()');await settle();assert.equal(postCount,1,'leaving a run is not completion');
blockSave=true;setup(false);await run('start()');run('notes.forEach(n=>judge(n,.1));finish()');await settle();
run("BeatStreamScores.show('client-song','hard')");await settle();assert.equal(el('[data-history-status]').textContent,'成績同步失敗');assert.equal(el('[data-history-retry]').hidden,false);
blockSave=false;await el('[data-history-retry]').onclick();await settle();assert.equal((await clientDB.prepare('SELECT COUNT(*) AS total FROM scores').first()).total,2);assert.equal(el('[data-history-retry]').hidden,true);
// A completed play remains visible while an older, empty history request finishes.
let release;delayNextLoad=new Promise(resolve=>release=resolve);run("BeatStreamScores.show('client-song','normal')");
run("const raceRun=BeatStreamScores.begin('client-song','normal',{auto:false,practice:false,noteCount:4});void BeatStreamScores.record(raceRun,{score:900000,maxCombo:3})");await settle();assert.match(el('[data-history-rows]').innerHTML,/900,000/);
run("BeatStreamScores.show('other-song','light')");release();await settle();assert.doesNotMatch(el('[data-history-rows]').innerHTML,/900,000|1,000,000/,'late responses cannot paint a different selected song');
run("BeatStreamScores.show('client-song','normal')");await settle();assert.match(el('[data-history-rows]').innerHTML,/900,000/);
// A fresh client instance restores server records, independently of its old cache.
run(fs.readFileSync('dist/client/score-history.js','utf8'));run("BeatStreamScores.show('client-song','hard')");await settle();assert.match(el('[data-history-rows]').innerHTML,/1,000,000/);assert.match(el('[data-history-rows]').innerHTML,/650,000/);
assert.equal((el('[data-history-rows]').innerHTML.match(/<tr/g)||[]).length,5);
clientDB.close();console.log('PASS real manual completion, duplicate finish, AUTO/tutorial/abort exclusion, recoverable sync failure, selection races and reload from cloud');
