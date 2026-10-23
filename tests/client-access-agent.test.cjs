const test = require('node:test'), assert = require('node:assert/strict');
const {execute} = require('../agent/operations');
test('RADIUS/unknown source stops before all writes', async()=>{
 for(const source of ['RADIUS','UNKNOWN']) {
  let writes=0;
  await assert.rejects(execute({action:'ACCESS_ACTIVATE',payload:{username:'fixture',owner:'owner'}},async(method)=>{if(method!=='GET')writes++;return {source};}),{status:422});
  assert.equal(writes,0);
 }
});
test('grace on an installed suspended customer without a secret creates it only on explicit grant', async()=>{
 let user, rate, enabled=false;
 const job={action:'ACCESS_GRACE',payload:{username:'fixture',owner:'owner',profile:'isp-plan',password:'fixture-password',downMbps:200,upMbps:100}};
 await execute(job,async(method,path,body)=>{
  if(path==='/api/pppoe/auth-source')return {source:'LOCAL'};
  if(path==='/api/plans'){rate=body.upMbps+'M/'+body.downMbps+'M';return {};}
  if(path==='/api/pppoe/profiles')return [{name:'isp-plan','rate-limit':rate}];
  if(path.endsWith('/activate')){user={name:'fixture',comment:'isp-manager:owner',disabled:'false',service:'pppoe',profile:'isp-plan'};enabled=true;return {};}
  if(!user)throw Object.assign(Error('missing'),{status:404});return user;
 });
 assert.equal(enabled,true);
});
test('foreign secret is never claimed by matching username',async()=>{
 let writes=0;
 await assert.rejects(execute({action:'ACCESS_ACTIVATE',payload:{username:'fixture',owner:'owner'}},async(method,path)=>{if(method!=='GET')writes++;return path.endsWith('auth-source')?{source:'LOCAL'}:{comment:'other-owner'};}),{status:409});
 assert.equal(writes,0);
});
