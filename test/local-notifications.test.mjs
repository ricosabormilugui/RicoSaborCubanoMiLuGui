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
test('login usa backend, logout recupera actividad local y nunca migra ni combina listas',async()=>{
  const h=context();h.local.add(event());const guest=h.center.recent()[0];h.account.recent.set([{id:'private-A',read:false}]);h.account.unreadCount.set(7);
  h.auth.switch('A');assert.equal(h.center.recent()[0].source,'account');assert.equal(h.center.unreadCount(),7);assert.equal(await h.center.remove(guest),false);
  await h.center.markAllRead();assert.deepEqual(h.calls,['read-all']);assert.equal(h.local.unreadCount(),1);
  const privateItem=h.center.recent()[0];h.auth.switch(null);assert.equal(h.center.recent()[0].source,'local');assert.equal(h.center.unreadCount(),1);assert.equal(await h.center.remove(privateItem),false);
  h.account.recent.set([{id:'private-B',read:true}]);h.auth.switch('B');assert.equal(h.center.recent()[0].id,'private-B');assert.equal(h.local.items().length,1);
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

test('NotificationService opt-in, copy segura, dedupe y supresión autenticada/entre sesiones',async()=>{
  const h=context();const {NotificationService}=load('src/app/core/services/notification.service.ts');
  const service=new NotificationService({get:token=>token===NotificationHistoryService?h.local:h.auth});service.dispatch=()=>{};
  service.info('Temporal');service.loading('Cargando',undefined,{saveToHistory:true});
  service.success('Producto añadido','Nombre personal, secret@example.test',{saveToHistory:true});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(h.local.items().length,1);assert.equal(h.local.items()[0].message,'');
  h.auth.switch('A');service.success('Pedido recibido',undefined,{saveToHistory:true});await new Promise(resolve=>setImmediate(resolve));assert.equal(h.local.items().length,1);
  const version=service.historySession();h.auth.switch(null);service.error('Operación de A',undefined,{saveToHistory:true,history:{sessionVersion:version}});
  service.success('Otra actividad',undefined,{saveToHistory:true});h.auth.switch('B');await new Promise(resolve=>setImmediate(resolve));assert.equal(h.local.items().length,1);
});

test('integraciones seleccionadas: carrito y pedido; campana y ruta también admiten invitados',()=>{
  const read=path=>readFileSync(resolve(root,path),'utf8');
  for(const path of ['home/home-page.component.ts','catalog/catalog-page.component.ts','catalog/product-detail-page.component.ts','cart/cart-page.component.ts'])assert.match(read('src/app/features/'+path),/saveToHistory: true/);
  const app=read('src/app/app.component.ts');assert.match(app,/@defer \(on immediate\) \{ <app-notification-bell \/> \}/);
  assert.doesNotMatch(app,/@if \(customerAuth.isAuthenticated\(\)\)\s*\{\s*@defer/);
  assert.doesNotMatch(read('src/app/app.routes.ts'),/canActivate: \[customerGuard\]/);
  assert.match(read('src/app/features/checkout/checkout-page.component.ts'),/historySession = this.notifications.historySession\(\)/);
});
