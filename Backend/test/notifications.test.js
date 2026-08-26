import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { ObjectId } from "mongodb";
import { signToken } from "../src/lib/auth.js";
import { createNotificationsRouter } from "../src/routes/notifications.routes.js";
import { createNotificationsRepository, parseNotificationQuery } from "../src/repositories/notifications.repository.js";
import { notifyOrderOwner } from "../src/services/user-notification.service.js";
import { buildOrderIdentity } from "../src/controllers/orders.controller.js";
import { commitOrderUnitOfWork } from "../src/services/order-unit-of-work.service.js";
import { updateOrderStatus } from "../src/repositories/orders.repository.js";
import { notifyPasswordChanged } from "../src/services/user-notification.service.js";

function matches(doc, query) {
  return Object.entries(query).every(([key, value]) => {
    if (key === '$or') return value.some(clause => matches(doc, clause));
    if (value?.$lt !== undefined) return String(doc[key]) < String(value.$lt);
    return String(doc[key]) === String(value);
  });
}
function memoryCollection() {
  const documents = [];
  return {
    documents,
    find(query) {
      let rows = documents.filter(doc => matches(doc, query));
      return { sort() { rows.sort((a,b) => b.createdAt.localeCompare(a.createdAt) || String(b._id).localeCompare(String(a._id))); return this; }, limit(n) { rows = rows.slice(0,n); return this; }, async toArray() { return structuredClone(rows).map((row,i) => ({ ...row, _id: rows[i]._id })); } };
    },
    async findOne(query) { return documents.find(doc => matches(doc, query)) ?? null; },
    async countDocuments(query) { return documents.filter(doc => matches(doc, query)).length; },
    async updateOne(query, update, options = {}) {
      let doc = documents.find(doc => matches(doc, query));
      if (!doc && options.upsert) { doc = { _id: new ObjectId(), ...update.$setOnInsert }; documents.push(doc); }
      if (doc && update.$set) Object.assign(doc, update.$set);
      return { modifiedCount: doc ? 1 : 0 };
    },
    async updateMany(query, update) { const rows = documents.filter(doc => matches(doc, query)); rows.forEach(doc => Object.assign(doc, update.$set)); return { modifiedCount: rows.length }; },
    async deleteOne(query) { const index = documents.findIndex(doc => matches(doc, query)); if (index < 0) return { deletedCount: 0 }; documents.splice(index,1); return { deletedCount: 1 }; }
  };
}
const notification = (userId, eventKey, overrides = {}) => ({ userId, eventKey, type: 'order', title: 'Pedido confirmado', message: 'Tu pedido está confirmado.', createdAt: '2026-08-26T10:00:00.000Z', ...overrides });

test('API real con JWT: lista, contador, IDOR, lectura, lectura masiva y borrado están aislados', async t => {
  process.env.AUTH_TOKEN_SECRET = 'notification-tests-only-secret';
  const collection = memoryCollection();
  const repository = createNotificationsRepository(async () => collection);
  await repository.create(notification('A','a1'));
  await repository.create(notification('A','a2'));
  await repository.create(notification('B','b1'));
  const bId = String(collection.documents.find(doc => doc.userId === 'B')._id);
  const aId = String(collection.documents.find(doc => doc.userId === 'A')._id);
  const app = express();
  app.use(express.json());
  app.use('/api/notifications', createNotificationsRouter(repository));
  app.use((error, _req, res, _next) => res.status(error.status ?? 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/notifications`;
  const token = signToken({ sub: 'A', role: 'customer' });
  const call = (path = '', method = 'GET', auth = token, body) => fetch(base + path, { method, headers: { ...(auth ? { Authorization: `Bearer ${auth}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  for (const [path,method] of [['','GET'],['/unread-count','GET'],['/read-all','PATCH'],[`/${aId}/read`,'PATCH'],[`/${aId}`,'DELETE']]) assert.equal((await call(path,method,null)).status,401);
  for (const bad of ['invalid', signToken({sub:'A',role:'customer'},-10), signToken({role:'admin'})]) assert.ok([401,403].includes((await call('', 'GET',bad)).status));
  const listed = await call('?userId=B');
  assert.equal(listed.headers.get('cache-control'),'private, no-store');
  const data = await listed.json();
  assert.equal(data.notifications.length,2);
  assert.ok(data.notifications.every(doc => !('userId' in doc) && !('eventKey' in doc)));
  assert.deepEqual(await (await call('/unread-count?userId=B')).json(),{unreadCount:2});
  for (const id of [bId, new ObjectId().toString(), 'invalid']) {
    assert.deepEqual(await (await call(`/${id}/read`,'PATCH',token,{userId:'B'})).json(),{message:'Notificación no encontrada.'});
    assert.equal((await call(`/${id}`,'DELETE')).status,404);
  }
  await call(`/${aId}/read`,'PATCH');
  const firstRead = collection.documents.find(doc => String(doc._id) === aId).readAt;
  await call(`/${aId}/read`,'PATCH');
  assert.equal(collection.documents.find(doc => String(doc._id) === aId).readAt,firstRead);
  assert.deepEqual(await (await call('/unread-count')).json(),{unreadCount:1});
  assert.deepEqual(await (await call('/read-all','PATCH',token,{userId:'B'})).json(),{updated:1});
  assert.deepEqual(await (await call('/unread-count')).json(),{unreadCount:0});
  assert.equal(await repository.count('B'),1);
  assert.equal((await call(`/${aId}`,'DELETE')).status,204);
  assert.equal((await call(`/${aId}`,'DELETE')).status,404);
  assert.equal(await repository.count('B'),1);
  for (const query of ['?limit=0','?limit=51','?limit=2.5','?read=no','?type=unknown','?cursor=invalid','?read[$ne]=true']) assert.equal((await call(query)).status,400);
});

test('paginación estable con fechas iguales, filtros, cursor y eventos duplicados', async () => {
  const collection = memoryCollection();
  const repo = createNotificationsRepository(async () => collection);
  for (let i=0;i<5;i++) await repo.create(notification('A',String(i),{type:i===0?'account':'order'}));
  await repo.create(notification('B','b'));
  await repo.create(notification('A','1'));
  const first = await repo.list('A',parseNotificationQuery({limit:'2'}));
  const second = await repo.list('A',parseNotificationQuery({limit:'2',cursor:first.nextCursor}));
  const third = await repo.list('A',parseNotificationQuery({limit:'2',cursor:second.nextCursor}));
  assert.equal(new Set([...first.notifications,...second.notifications,...third.notifications].map(doc=>doc.id)).size,5);
  assert.equal(third.nextCursor,null);
  assert.equal((await repo.list('A',{type:'account'})).notifications.length,1);
  await repo.read('A',first.notifications[0].id);
  assert.equal((await repo.list('A',{read:false})).notifications.length,4);
  assert.equal((await repo.list('A',{read:true})).notifications.length,1);
  await assert.rejects(repo.list(''), /Sesión/);
  await assert.rejects(repo.remove('',first.notifications[0].id), /Sesión/);
});

test('destinatario canónico: no confiar en userId/accountMode del formulario ni en email del invitado', async () => {
  const payload = {userId:'victim',accountMode:'registered'};
  assert.deepEqual(buildOrderIdentity(payload,null),{accountMode:'guest',userId:null});
  assert.deepEqual(buildOrderIdentity(payload,{sub:'A',role:'customer'}),{accountMode:'registered',userId:'A'});
  const calls=[];
  const repository={create:async (...args)=>calls.push(args)};
  await notifyOrderOwner({orderId:'1',accountMode:'guest',userId:'victim',status:'nuevo'}, {repository});
  assert.equal(calls.length,0);
  for (const status of ['nuevo','confirmado','preparando','listo','enviado','entregado','cancelado','anulado']) {
    await notifyOrderOwner({orderId:'1',accountMode:'registered',userId:'A',status,statusHistory:[{},{}]}, {repository,session:'tx'});
  }
  assert.equal(calls.length,8);
  assert.ok(calls.every(([data,options])=> data.userId==='A' && data.action.url==='/mis-pedidos' && options.session==='tx'));
});

test('el aviso participa en la unidad transaccional y su fallo se propaga para rollback', async () => {
  const calls=[];
  const dependencies={session:'transaction', customerUpserter:async()=>null, stockAdjuster:async()=>calls.push('stock'), orderSaver:async()=>calls.push('order'), notificationWriter:async(_order,{session})=>{assert.equal(session,'transaction');calls.push('notification');throw new Error('notification failed');}};
  await assert.rejects(commitOrderUnitOfWork({items:[]},dependencies),/notification failed/);
  assert.deepEqual(calls,['stock','order','notification']);
});

test('estados repetidos/concurrentes no duplican avisos; cada transición usa la misma sesión', async () => {
  const order={orderId:'MLG-1',userId:'A',accountMode:'registered',status:'nuevo',statusHistory:[{status:'nuevo'}]};
  const writes=[];
  const collection={async findOneAndUpdate(filter,update,options){
    assert.equal(options.session,'tx');
    if(order.status === filter.status.$ne) return null;
    Object.assign(order,update.$set);order.statusHistory.push(update.$push.statusHistory);
    return structuredClone(order);
  }};
  const deps={collectionProvider:async()=>collection,prepare:async()=>{},runTransaction:async fn=>fn('tx'),notificationWriter:async(result,{session})=>writes.push({result,session})};
  await Promise.all([updateOrderStatus('MLG-1','confirmado',{},deps),updateOrderStatus('MLG-1','confirmado',{},deps)]);
  assert.equal(writes.length,1);assert.equal(writes[0].session,'tx');
  await updateOrderStatus('MLG-1','preparando',{},deps);
  assert.equal(writes.length,2);assert.equal(writes[1].result.statusHistory.length,3);
  await assert.rejects(updateOrderStatus('MLG-1','listo',{}, {...deps,notificationWriter:async()=>{throw new Error('rollback');}}),/rollback/);
});

test('aviso de contraseña sin email, token, hash, ni contraseña en el documento', async () => {
  let data;
  await notifyPasswordChanged({_id:'A',email:'private@example.test',passwordHash:'secret'},{repository:{create:async value=>{data=value;}}});
  assert.equal(data.userId,'A');assert.equal(data.type,'account');
  assert.doesNotMatch(JSON.stringify(data),/private@example|secret|passwordHash/);
});
