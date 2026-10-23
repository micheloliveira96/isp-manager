'use strict';
const assert = require('node:assert/strict');
const NAME = /^[A-Za-z0-9._-]{1,64}$/;
async function collect(gw) {
  try {
    const [identity, resource, interfaces, sessions, users, profiles, auth] = await Promise.all(['/api/router/identity', '/api/router/resource', '/api/interfaces', '/api/pppoe/sessions', '/api/pppoe/users', '/api/pppoe/profiles', '/api/pppoe/auth-source'].map(p => gw('GET', p)));
    return { online: true, identity, resource, interfaces, sessions, users: users.map(({ password, ...row }) => row), profiles, authSource: auth.source };
  } catch { return { online: false }; }
}
async function execute(job, gw) {
  const p = job.payload || {};
  if (job.action.startsWith('ACCESS_')) return executeAccess(job, gw);
  if (!['PROVISION', 'PASSWORD', 'PLAN', 'SUSPEND', 'REACTIVATE', 'DISCONNECT', 'SYNC_PLAN', 'REFRESH'].includes(job.action)) throw new Error('Operação inválida');
  if (job.action === 'REFRESH') { assert.equal((await collect(gw)).online, true); return; }
  const userAction = !['SYNC_PLAN'].includes(job.action);
  if (userAction) { assert.match(p.username || '', NAME); assert.match(p.owner || '', /^[A-Za-z0-9_-]{1,64}$/); }
  if (['PROVISION', 'PLAN', 'SYNC_PLAN'].includes(job.action)) {
    assert.match(p.profile || '', /^isp-[A-Za-z0-9_-]{1,60}$/);
    for (const n of [p.downMbps, p.upMbps]) assert.ok(Number.isInteger(n) && n >= 1 && n <= 10000);
    await gw('POST', '/api/plans', { name: p.profile, downMbps: p.downMbps, upMbps: p.upMbps });
    const profile = (await gw('GET', '/api/pppoe/profiles')).find(r => r.name === p.profile);
    assert.equal(profile?.['rate-limit'], `${p.upMbps}M/${p.downMbps}M`);
  }
  if (job.action === 'SYNC_PLAN') return;
  const base = '/api/pppoe/users/' + encodeURIComponent(p.username);
  if (job.action === 'PROVISION') await gw('POST', '/api/pppoe/users', { name: p.username, password: p.password, profile: p.profile, owner: p.owner });
  if (job.action === 'PASSWORD') await gw('PUT', base + '/password', { password: p.password, owner: p.owner });
  if (job.action === 'PLAN') await gw('PUT', base + '/profile', { profile: p.profile, owner: p.owner, reconnect: true });
  if (['SUSPEND', 'REACTIVATE', 'DISCONNECT'].includes(job.action)) await gw('POST', base + '/' + job.action.toLowerCase(), { owner: p.owner });
  const actual = await gw('GET', base);
  if (['PROVISION', 'PLAN'].includes(job.action)) assert.equal(actual.profile, p.profile);
  if (job.action === 'SUSPEND') { assert.equal(actual.disabled, 'true'); assert.equal(actual.session, null); }
  if (['PROVISION', 'REACTIVATE'].includes(job.action)) assert.equal(actual.disabled, 'false');
}
async function executeAccess(job, gw) {
  const p = job.payload || {};
  assert.ok(['ACCESS_ACTIVATE', 'ACCESS_SUSPEND', 'ACCESS_GRACE', 'ACCESS_EXPIRE', 'ACCESS_CHANGE'].includes(job.action));
  assert.match(p.username || '', NAME); assert.match(p.owner || '', /^[A-Za-z0-9_-]{1,64}$/);
  if ((await gw('GET', '/api/pppoe/auth-source')).source !== 'LOCAL') throw Object.assign(new Error('RADIUS_UNSUPPORTED'), {status: 422});
  const base = '/api/pppoe/users/' + encodeURIComponent(p.username);
  let existing;
  try {existing = await gw('GET', base);} catch(e) {if(e.status !== 404) throw e;}
  if(existing && existing.comment !== 'isp-manager:' + p.owner) throw Object.assign(new Error('Propriedade conflitante'), {status: 409});
  if(['ACCESS_ACTIVATE', 'ACCESS_CHANGE'].includes(job.action) || (job.action === 'ACCESS_GRACE' && !existing)) {
    assert.match(p.profile || '', /^isp-[A-Za-z0-9_-]{1,60}$/);
    for(const n of [p.downMbps, p.upMbps]) assert.ok(Number.isInteger(n) && n >= 1 && n <= 10000);
    await gw('POST', '/api/plans', {name: p.profile, downMbps: p.downMbps, upMbps: p.upMbps});
    assert.equal((await gw('GET', '/api/pppoe/profiles')).find(r => r.name === p.profile)?.['rate-limit'], `${p.upMbps}M/${p.downMbps}M`);
    if(job.action !== 'ACCESS_CHANGE') await gw('PUT', base + '/activate', {owner: p.owner, password: p.password, profile: p.profile});
    else {
      assert.ok(existing, 'Secret não encontrado');
      await gw('PUT', base + '/profile', {owner: p.owner, profile: p.profile, reconnect: true});
      await gw('PUT', base + '/password', {owner: p.owner, password: p.password});
    }
  } else if(['ACCESS_SUSPEND', 'ACCESS_EXPIRE'].includes(job.action)) {
    if(existing) await gw('POST', base + '/suspend', {owner: p.owner});
    else assert.equal((await gw('GET', '/api/pppoe/sessions')).filter(s => s.name === p.username).length, 0);
  } else {assert.ok(existing); await gw('POST', base + '/reactivate', {owner: p.owner});}
  let actual;
  try {actual = await gw('GET', base);} catch(e) {if(e.status !== 404) throw e;}
  const suspended = ['ACCESS_SUSPEND', 'ACCESS_EXPIRE'].includes(job.action) || (job.action === 'ACCESS_CHANGE' && job.target === 'SUSPENDED');
  if(suspended) {
    if(actual) assert.equal(actual.disabled, 'true');
    assert.equal((await gw('GET', '/api/pppoe/sessions')).filter(s => s.name === p.username).length, 0);
  } else {assert.equal(actual?.disabled, 'false'); assert.equal(actual?.service, 'pppoe');}
  if(['ACCESS_ACTIVATE', 'ACCESS_CHANGE'].includes(job.action)) assert.equal(actual?.profile, p.profile);
}
module.exports = { execute, collect };
