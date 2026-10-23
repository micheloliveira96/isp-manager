// Recovery for interrupted tests: only the isolated DB and explicitly named lab PPPoE.
const fs = require('fs'), {PrismaClient} = require('@prisma/client'), {createClient} = require('../../mikrotik-gateway/routeros');
if(!/^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/isp_test\?schema=integration$/.test(process.env.DATABASE_URL || '')) throw Error('Destino não é o banco isolado');
const env = Object.fromEntries(fs.readFileSync('../mikrotik-gateway/.env','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)];}));
const rt = createClient({url:env.MIKROTIK_URL,user:env.MIKROTIK_USER,password:env.MIKROTIK_PASSWORD,caPath:'../mikrotik-gateway/certs/lab-ca.crt'}), db = new PrismaClient();
(async()=>{
 const orgs = await db.organization.findMany({where:{slug:{startsWith:'life-'}},include:{internetPlans:true}});
 fs.writeFileSync('../backups/lifecycle-interrupted-test-fixtures.json',JSON.stringify(orgs));
 const before=JSON.parse(fs.readFileSync('../backups/testeips-antes-validacao-20261023.json')).user;
 const lab=(await rt.get('/ppp/secret?name=testeips'))[0];
 if(lab?.comment !== before.comment || before.name !== 'testeips') throw Error('Propriedade do testeips divergente');
 await rt.patch('/ppp/secret/'+encodeURIComponent(lab['.id']),{profile:before.profile,disabled:'false'});
 const sessions=await rt.get('/ppp/active?name=testeips');for(const session of sessions)await rt.del('/ppp/active/'+encodeURIComponent(session['.id']));
 const secrets=await rt.get('/ppp/secret');for(const secret of secrets.filter(s=>s.name.startsWith('isp-life-')&&s.comment?.startsWith('isp-manager:'))) await rt.del('/ppp/secret/'+encodeURIComponent(secret['.id']));
 for(const org of orgs) {
  for(const plan of org.internetPlans) {const p=(await rt.get('/ppp/profile?name=isp-'+plan.id))[0];if(p)await rt.del('/ppp/profile/'+encodeURIComponent(p['.id']));}
  const where={organizationId:org.id};await db.mikrotikJob.deleteMany({where});await db.mikrotikSubscriber.deleteMany({where});await db.mikrotikRouter.deleteMany({where});await db.auditEvent.deleteMany({where});await db.user.deleteMany({where});await db.organization.delete({where:{id:org.id}});
 }
 console.log('Fixture interrompida removida do banco isolado; testeips restaurado ao plano original e habilitado.');
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
