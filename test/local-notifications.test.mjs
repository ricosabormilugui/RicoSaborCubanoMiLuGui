import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import '@angular/compiler';
import * as angular from '@angular/core';

const root=fileURLToPath(new URL('../',import.meta.url));
function loader(overrides={}) {
  const cache=new Map();
  function load(path) {
    path=resolve(root,path);
    if(cache.has(path))return cache.get(path);
    const js=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;
    const module={exports:{}};
    const require=name=>{
      if(name in overrides)return overrides[name];
      if(name==='@angular/core')return {...angular,effect:()=>{},Component:()=>target=>target};
      if(name==='@angular/core/rxjs-interop')return {takeUntilDestroyed:()=>x=>x};
      if(name==='@angular/router')return {NavigationEnd:class {}};
      if(name.endsWith('api.config'))return {resolveApiBaseUrl:()=>'/api'};
      if(name.endsWith('customer-auth.service'))return {CustomerAuthService:class {}};
      if(name.endsWith('api-client'))return {ApiRequestError:class extends Error{},requestJson:()=>{throw new Error('Unexpected private API');}};
      if(name.startsWith('.'))return load(resolve(dirname(path),name+'.ts'));
      throw new Error('Unmocked '+name);
    };
    new Function('require','module','exports',js)(require,module,module.exports);
    cache.set(path,module.exports);return module.exports;
  }return load;
}
const load=loader();
const {NotificationHistoryService}=load('src/app/core/services/notification-history.service.ts');
const {LOCAL_NOTIFICATION_CONFIG:config}=load('src/app/core/notifications/local-notification.types.ts');
const event=(title='Producto añadido al carrito')=>({type:'success',title,action:{label:'Ver carrito',url:'/carrito'}});
function storage(initial=null){let raw=initial;return {getItem:key=>{assert.equal(key,config.storageKey);return raw;},setItem:(key,value)=>{assert.equal(key,config.storageKey);raw=value;},get raw(){return raw;}};}

test('historial local: guardar y recuperar después de recarga; no serializa objetos extra',()=>{
  const s=storage(),first=new NotificationHistoryService(s);first.add({...event(),email:'secret@example.test',order:{address:'private'},handler(){}});
  const second=new NotificationHistoryService(s);assert.equal(second.items().length,1);assert.equal(second.unreadCount(),1);
  assert.deepEqual(second.items(),first.items());assert.doesNotMatch(s.raw,/secret|address|handler/);
});
test('lectura, lectura masiva, eliminación y limpieza sobreviven a recarga',()=>{
  const s=storage(),h=new NotificationHistoryService(s);h.add(event('Uno'));h.add(event('Dos'));
  const id=h.items()[0].id;assert.equal(h.markRead(id),true);assert.equal(new NotificationHistoryService(s).unreadCount(),1);
  h.markAllRead();assert.equal(new NotificationHistoryService(s).unreadCount(),0);
  assert.equal(h.remove(id),true);assert.equal(new NotificationHistoryService(s).items().length,1);
  assert.equal(h.remove('missing'),false);h.clear();assert.deepEqual(new NotificationHistoryService(s).items(),[]);
});
test('límite de 50 conserva los avisos recientes y purga caducados al cargar',()=>{
  const s=storage(),h=new NotificationHistoryService(s),now=Date.now();
  for(let i=0;i<60;i++)h.add(event('Aviso '+i),now-60_000+i*1000);
  assert.equal(h.items().length,50);assert.equal(h.items()[0].title,'Aviso 59');assert.equal(h.items().at(-1).title,'Aviso 10');
  const data=JSON.parse(s.raw);data.items[0].createdAt=new Date(Date.now()-config.maxAgeMs-1).toISOString();s.setItem(config.storageKey,JSON.stringify(data));
  const reloaded=new NotificationHistoryService(s);assert.equal(reloaded.items().length,49);assert.equal(JSON.parse(s.raw).items.length,49);
});
test('deduplicación temporal funciona también después de recargar',()=>{
  const s=storage(),h=new NotificationHistoryService(s),now=Date.now();
  h.add(event(),now-20_000);h.add(event(),now-19_000);assert.equal(h.items().length,1);
  h.add(event(),now);const next=new NotificationHistoryService(s);next.add(event());assert.equal(next.items().length,2);
});

test('cambios de almacenamiento de otra pestaña actualizan actividad y badge',()=>{
  const s=storage(),first=new NotificationHistoryService(s),second=new NotificationHistoryService(s);
  first.add(event());second.onStorage({key:'unrelated'});assert.equal(second.unreadCount(),0);
  second.onStorage({key:config.storageKey});assert.equal(second.unreadCount(),1);
  first.clear();second.onStorage({key:config.storageKey});assert.equal(second.items().length,0);
});
test('JSON corrupto, esquema no válido, storage bloqueado y cuota no rompen la app',()=>{
  for(const raw of ['{broken','null','{"version":99,"items":[]}','{"version":1,"items":"bad"}']){
    const h=new NotificationHistoryService(storage(raw));assert.deepEqual(h.items(),[]);h.add(event());assert.equal(h.items().length,1);
  }
  const inaccessible=new NotificationHistoryService(null);inaccessible.add(event());inaccessible.reload();assert.equal(inaccessible.items().length,1);assert.ok(inaccessible.storageWarning());
  const quota=new NotificationHistoryService({getItem:()=>null,setItem:()=>{throw new Error('Quota');}});quota.add(event());quota.reload();assert.equal(quota.items().length,1);assert.ok(quota.storageWarning());
});
test('datos manipulados, URLs externas, emails, teléfonos y JWT no se guardan',()=>{
  const s=storage(),h=new NotificationHistoryService(s);
  for(const title of ['secret@example.test','+34 600 123 456','Bearer token','<img src=x>'])h.add(event(title));
  assert.equal(h.items().length,0);
  h.add({...event(),message:'eyJhbGciOiJIUzI1NiJ9.payload.signature',action:{label:'Abrir',url:'https://evil.test'}});
  assert.equal(h.items()[0].message,'');assert.equal(h.items()[0].action,null);
  const data=JSON.parse(s.raw);data.items.push({...data.items[0],id:'mongodb-id',title:'Privado'});data.items[0].email='secret@example.test';
  s.setItem(config.storageKey,JSON.stringify(data));const reloaded=new NotificationHistoryService(s);assert.equal(reloaded.items().length,1);assert.doesNotMatch(s.raw,/secret|mongodb-id/);
});

function context(){
  const auth={token:angular.signal(''),profile:angular.signal(null),sessionVersion:angular.signal(0),isAuthenticated(){return !!this.token();},switch(id){this.sessionVersion.update(n=>n+1);this.token.set(id?'token-'+id:'');this.profile.set(id?{userId:id}:null);}};
  const local=new NotificationHistoryService(storage());const calls=[];
  const account={session:()=>auth.token(),recent:angular.signal([]),history:angular.signal([]),unreadCount:angular.signal(0),nextCursor:()=>null,busy:()=>false,loading:()=>({recent:false,history:false}),error:()=>'',load:async()=>calls.push('load'),refreshCount:async()=>calls.push('count'),markRead:async()=>{calls.push('read');return true;},markAllRead:async()=>{calls.push('read-all');return true;},remove:async()=>{calls.push('delete');return true;}};
  let answer=false;const confirm={open:async()=>answer};
  const {NotificationCenterService}=load('src/app/core/services/notification-center.service.ts');
  const center=new NotificationCenterService(auth,account,local,confirm);
  return {auth,local,account,center,calls,confirm,setAnswer:value=>answer=value};
}
test('invitado usa únicamente localStorage; acciones y badge no llaman API privada',async()=>{
  const h=context();h.local.add(event());await h.center.load('recent');await h.center.load('history');await h.center.refreshCount();
  assert.equal(h.center.unreadCount(),1);assert.equal(h.center.recent()[0].source,'local');
  await h.center.markRead(h.center.recent()[0]);assert.equal(h.center.unreadCount(),0);await h.center.remove(h.center.recent()[0]);assert.deepEqual(h.calls,[]);
  const {UserNotificationsService}=load('src/app/core/services/user-notifications.service.ts');
  const privateService=new UserNotificationsService(h.auth,{}, {events:{pipe:()=>({subscribe(){}})}});
  await privateService.load('recent');await privateService.refreshCount();assert.equal(await privateService.markAllRead(),false);
});
test('login conserva ambas fuentes: dos locales más tres de cuenta suman cinco pendientes',async()=>{
  const h=context();h.local.add(event());h.local.add(event('Cupón preaplicado'));const device=h.local.items();
  h.account.recent.set([{id:'private-A',read:false}]);h.account.history.set(h.account.recent());h.account.unreadCount.set(3);
  h.auth.switch('A');assert.deepEqual(h.center.recent(),device);assert.equal(h.center.localUnreadCount(),2);assert.equal(h.center.accountUnreadCount(),3);assert.equal(h.center.totalUnreadCount(),5);
  assert.equal(h.center.accountRecent()[0].source,'account');assert.deepEqual(h.center.localRecent(),device);
  h.center.selectSource('account');await h.center.load('history');assert.equal(h.center.history()[0].id,'private-A');assert.equal(h.center.sourceUnreadCount(),3);
  h.center.selectSource('local');await h.center.load('history');assert.deepEqual(h.center.history(),device);assert.equal(h.center.sourceUnreadCount(),2);assert.equal(h.center.unreadCount(),5);
  assert.deepEqual(h.calls,['load']);assert.deepEqual(h.local.items(),device);
});

test('acciones locales autenticado y acciones privadas se dirigen únicamente a su origen',async()=>{
  const h=context();h.local.add(event('Uno'));h.local.add(event('Dos'));h.auth.switch('A');h.account.unreadCount.set(3);
  await h.center.markRead(h.local.items()[0]);assert.equal(h.center.unreadCount(),4);assert.equal(h.center.accountUnreadCount(),3);
  await h.center.markAllRead();assert.equal(h.local.unreadCount(),0);assert.equal(h.center.unreadCount(),3);assert.deepEqual(h.calls,[]);
  await h.center.remove(h.local.items()[0]);assert.equal(h.local.items().length,1);
  h.local.add(event('Tres'));h.center.selectSource('account');const privateItem={id:'private-A',read:false,source:'account'};
  await h.center.markRead(privateItem);await h.center.markAllRead();await h.center.remove(privateItem);
  assert.deepEqual(h.calls,['read','read-all','delete']);assert.equal(h.local.unreadCount(),1);
  h.setAnswer(true);await h.center.clearLocal();assert.equal(h.local.items().length,0);assert.equal(h.center.accountUnreadCount(),3);assert.deepEqual(h.calls,['read','read-all','delete']);
});

test('logout conserva dispositivo; A y B solo ven su estado privado, incluso con respuestas tardías',async()=>{
  const h=context(),pending=[],effects=[];
  const actualLoad=loader({
    '@angular/core':{...angular,effect:fn=>effects.push(fn)},
    '../utils/api-client':{ApiRequestError:class extends Error{},requestJson:(url,init)=>new Promise(resolve=>pending.push({url,init,resolve}))}
  });
  const {UserNotificationsService}=actualLoad('src/app/core/services/user-notifications.service.ts');
  const {NotificationCenterService}=actualLoad('src/app/core/services/notification-center.service.ts');
  const account=new UserNotificationsService(h.auth,{}, {events:{pipe:()=>({subscribe(){}})}});
  const center=new NotificationCenterService(h.auth,account,h.local,h.confirm);h.local.add(event());const device=h.local.items();
  h.auth.switch('A');center.selectSource('account');
  const a=center.load('recent');pending.shift().resolve({notifications:[{id:'private-A',read:false}],nextCursor:null});await a;
  const count=center.refreshCount();pending.shift().resolve({unreadCount:3});await count;assert.equal(center.unreadCount(),4);
  const late=center.load('history');const lateRequest=pending.shift();
  h.auth.switch(null);assert.equal(center.source(),'local');assert.deepEqual(center.accountRecent(),[]);assert.equal(center.unreadCount(),1);assert.deepEqual(center.recent(),device);
  effects[0]();assert.deepEqual(account.recentState().notifications,[]);assert.deepEqual(account.historyState().notifications,[]);assert.equal(account.countState(),0);
  center.selectSource('account');await center.load('recent');await center.refreshCount();assert.equal(pending.length,0);assert.equal(center.source(),'local');
  h.auth.switch('B');assert.deepEqual(center.recent(),device);assert.equal(center.accountUnreadCount(),0);center.selectSource('account');
  const b=center.load('recent');const bRequest=pending.shift();assert.equal(bRequest.init.headers.Authorization,'Bearer token-B');bRequest.resolve({notifications:[{id:'private-B',read:false}],nextCursor:null});await b;
  lateRequest.resolve({notifications:[{id:'private-A-secret',read:false}],nextCursor:null});await late;
  assert.deepEqual(center.accountRecent().map(item=>item.id),['private-B']);assert.deepEqual(account.history(),[]);assert.deepEqual(center.localRecent(),device);
});

test('errores y carga de cuenta no bloquean actividad; filtros y vacíos son independientes',async()=>{
  const h=context();h.auth.switch('A');h.account.error=()=> 'Error de cuenta';h.account.loading=()=>({recent:true,history:true});h.account.busy=()=>true;
  h.account.history.set([{id:'private-A',read:false}]);h.account.unreadCount.set(3);
  assert.deepEqual(h.center.history(),[]);assert.equal(h.center.error(),'');assert.equal(h.center.loading().history,false);assert.equal(h.center.busy(),false);assert.equal(h.center.sourceUnreadCount(),0);assert.equal(h.center.unreadCount(),3);
  h.center.selectSource('account');assert.equal(h.center.history()[0].id,'private-A');assert.equal(h.center.error(),'Error de cuenta');assert.equal(h.center.busy(),true);
  h.center.selectSource('local');h.local.add(event());await h.center.load('history',{type:'error'});assert.deepEqual(h.center.history(),[]);
  await h.center.load('history',{});assert.equal(h.center.history().length,1);assert.deepEqual(h.calls,[]);
});
test('limpiar requiere ConfirmDialog y no opera si cambia la sesión durante la confirmación',async()=>{
  const h=context();h.local.add(event());await h.center.clearLocal();assert.equal(h.local.items().length,1);
  h.confirm.open=async()=>{h.auth.switch('A');return true;};await h.center.clearLocal();assert.equal(h.local.items().length,1);
  h.auth.switch(null);h.confirm.open=async()=>true;await h.center.clearLocal();assert.equal(h.local.items().length,0);
});
test('filtros y paginación local reutilizan el historial sin limitar el badge a la página',async()=>{
  const h=context();for(let i=0;i<25;i++)h.local.add(event('Actividad '+i));
  await h.center.load('history');assert.equal(h.center.history().length,20);assert.equal(h.center.unreadCount(),25);
  await h.center.load('history',{},true);assert.equal(h.center.history().length,25);assert.equal(h.center.nextCursor(),null);
  await h.center.markRead(h.center.history()[0]);await h.center.load('history',{read:true});assert.equal(h.center.history().length,1);
});

test('NotificationService guarda opt-in con sesión; solo excluye equivalencia explícita o sesión obsoleta',async()=>{
  const h=context();const {NotificationService}=load('src/app/core/services/notification.service.ts');
  const service=new NotificationService({get:token=>token===NotificationHistoryService?h.local:h.auth});service.dispatch=()=>{};
  service.info('Temporal');service.loading('Cargando',undefined,{saveToHistory:true});
  service.success('Producto añadido','Nombre personal, secret@example.test',{saveToHistory:true});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(h.local.items().length,1);assert.equal(h.local.items()[0].message,'');
  h.auth.switch('A');service.success('Cupón preaplicado',undefined,{saveToHistory:true});await new Promise(resolve=>setImmediate(resolve));assert.equal(h.local.items().length,2);
  service.success('Pedido recibido',undefined,{saveToHistory:true,history:{accountEquivalent:true}});await new Promise(resolve=>setImmediate(resolve));assert.equal(h.local.items().length,2);
  service.success('Pedido recibido',undefined,{saveToHistory:true});await new Promise(resolve=>setImmediate(resolve));assert.equal(h.local.items().length,3);
  const version=service.historySession();h.auth.switch(null);service.error('Operación de A',undefined,{saveToHistory:true,history:{sessionVersion:version}});
  service.success('Otra actividad',undefined,{saveToHistory:true});h.auth.switch('B');await new Promise(resolve=>setImmediate(resolve));assert.equal(h.local.items().length,3);
  h.auth.switch(null);service.success('Pedido invitado',undefined,{saveToHistory:true,history:{accountEquivalent:true}});await new Promise(resolve=>setImmediate(resolve));assert.equal(h.local.items().length,4);
});

test('integraciones seleccionadas: carrito y pedido; campana y ruta también admiten invitados',()=>{
  const read=path=>readFileSync(resolve(root,path),'utf8');
  for(const path of ['home/home-page.component.ts','catalog/catalog-page.component.ts','catalog/product-detail-page.component.ts','cart/cart-page.component.ts'])assert.match(read('src/app/features/'+path),/saveToHistory: true/);
  const app=read('src/app/app.component.ts');assert.match(app,/@defer \(on immediate\) \{ <app-notification-bell \/> \}/);
  assert.doesNotMatch(app,/@if \(customerAuth.isAuthenticated\(\)\)\s*\{\s*@defer/);
  assert.doesNotMatch(read('src/app/app.routes.ts'),/canActivate: \[customerGuard\]/);
  assert.match(read('src/app/features/checkout/checkout-page.component.ts'),/historySession = this.notifications.historySession\(\)/);
});
