'use strict';
const assert = require('node:assert/strict');
const NAME = /^[A-Za-z0-9._-]{1,64}$/;
async function collect(gw) {
  try {
    const [identity, resource, interfaces, sessions, users, profiles] = await Promise.all(['/api/router/identity', '/api/router/resource', '/api/interfaces', '/api/pppoe/sessions', '/api/pppoe/users', '/api/pppoe/profiles'].map(p => gw('GET', p)));
    return { online: true, identity, resource, interfaces, sessions, users: users.map(({ password, ...row }) => row), profiles };
  } catch { return { online: false }; }
}
async function execute(job, gw) {
  const p = job.payload || {};
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
module.exports = { execute, collect };
