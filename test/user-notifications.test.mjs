import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import '@angular/compiler';
import * as angular from '@angular/core';

const root = new URL('../', import.meta.url);
class ApiRequestError extends Error { constructor(message,status) { super(message); this.status=status; } }
function compile(path, imports) {
  const js=ts.transpileModule(readFileSync(new URL(path,root),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;
  const module={exports:{}};
  new Function('require','module','exports',js)(name=>imports(name),module,module.exports);
  return module.exports;
}
const types=compile('src/app/core/notifications/user-notification.types.ts',()=>({}));
const item=(id='a',read=false)=>({id,read,type:'order',title:'Pedido',message:'Recibido',createdAt:'2026-08-26T10:00:00Z',readAt:null,action:{label:'Ver pedidos',url:'/mis-pedidos'},entity:null});
const page=(items=[],nextCursor=null)=>({notifications:items,nextCursor});
function harness() {
  const pending=[]; const effects=[]; const warnings=[];
  const auth={token:angular.signal('token-A'),profile:angular.signal({userId:'A'}),sessionVersion:angular.signal(0),logout(){this.sessionVersion.update(n=>n+1);this.token.set('');this.profile.set(null);}};
  const {UserNotificationsService}=compile('src/app/core/services/user-notifications.service.ts',name=>{
    if(name==='@angular/core')return {...angular,effect:fn=>effects.push(fn)};
    if(name==='@angular/core/rxjs-interop')return {takeUntilDestroyed:()=>x=>x};
    if(name==='@angular/router')return {NavigationEnd:class {}};
    if(name.endsWith('api.config'))return {resolveApiBaseUrl:()=>'/api'};
    if(name.endsWith('api-client'))return {ApiRequestError,requestJson:(url,init)=>new Promise((resolve,reject)=>pending.push({url,init,resolve,reject}))};
    if(name.endsWith('user-friendly-error'))return {getUserFriendlyError:(_e,fallback)=>fallback};
    return {};
  });
  const service=new UserNotificationsService(auth,{warning:(...args)=>warnings.push(args),error:(...args)=>warnings.push(args)},{events:{pipe:()=>({subscribe:()=>{}})}});
  const switchTo=(id)=>{auth.logout();if(id){auth.token.set('token-'+id);auth.profile.set({userId:id});}};
  return {service,auth,pending,effects,warnings,switchTo};
}

test('contador de campana: cero oculto, 1–99 y 99+',()=>{
  assert.deepEqual([0,1,99,100,1234].map(types.notificationBadge),['','1','99','99+','99+']);
});
test('acciones solo hacia rutas locales conocidas',()=>{
  assert.equal(types.notificationDestination(item()),'/mis-pedidos');
  for(const url of ['https://evil.test','//evil.test','javascript:alert(1)','/admin'])assert.equal(types.notificationDestination({...item(),action:{url}}),null);
});
test('inicio y cierre de sesión: datos ocultos inmediatamente, sin esperar al effect',async()=>{
  const h=harness();
  const load=h.service.load('recent'); h.pending.shift().resolve(page([item()])); await load;
  const count=h.service.refreshCount(); h.pending.shift().resolve({unreadCount:5}); await count;
  assert.equal(h.service.recent().length,1); assert.equal(h.service.unreadCount(),5);
  h.auth.logout();
  assert.deepEqual(h.service.recent(),[]); assert.equal(h.service.unreadCount(),0);assert.equal(h.service.error(),'');
  h.effects[0]();
  assert.deepEqual(h.service.recentState().notifications,[]);
});
test('respuestas tardías de A no aparecen en B ni tras volver a A',async()=>{
  const h=harness();const old=h.service.load('history');const oldRequest=h.pending.shift();
  h.switchTo('B');const current=h.service.load('history');h.pending.shift().resolve(page([item('b')]));await current;
  oldRequest.resolve(page([item('secret-A')]));await old;
  assert.deepEqual(h.service.history().map(x=>x.id),['b']);
  const oldCount=h.service.refreshCount();const oldCountRequest=h.pending.shift();
  h.switchTo('A');const count=h.service.refreshCount();h.pending.shift().resolve({unreadCount:0});await count;
  oldCountRequest.resolve({unreadCount:99});await oldCount;
  assert.equal(h.service.unreadCount(),0);
});
test('filtros/paginación: gana la petición más reciente y no duplica IDs',async()=>{
  const h=harness();const old=h.service.load('history',{});const req=h.pending.shift();
  const fresh=h.service.load('history',{read:false,type:'order'});const current=h.pending.shift();
  assert.match(current.url,/read=false/);assert.match(current.url,/type=order/);assert.equal(current.init.headers.Authorization,'Bearer token-A');
  current.resolve(page([item('new')],'cursor-next'));await fresh;req.resolve(page([item('old')]));await old;
  const more=h.service.load('history',{read:false,type:'order'},true);const moreRequest=h.pending.shift();assert.match(moreRequest.url,/cursor=cursor-next/);
  moreRequest.resolve(page([item('new'),item('next')]));await more;
  assert.deepEqual(h.service.history().map(x=>x.id),['new','next']);
});
test('fallo al marcar o borrar conserva el estado, permite reintentar y no navega',async()=>{
  const h=harness();const load=h.service.load('recent');h.pending.shift().resolve(page([item()]));await load;
  for(const action of [()=>h.service.markRead(item()),()=>h.service.remove(item()),()=>h.service.markAllRead()]){
    const operation=action();h.pending.shift().reject(new Error('offline'));assert.equal(await operation,false);
    assert.equal(h.service.recent()[0].read,false);assert.equal(h.service.busy(),false);assert.ok(h.service.error());
  }
});
test('mutación exitosa refresca lista y contador y descarta el contador anterior',async()=>{
  const h=harness();const old=h.service.refreshCount();const oldRequest=h.pending.shift();
  const action=h.service.markRead(item());assert.equal(h.service.busy(),true);assert.equal(await h.service.remove(item()),false);
  const mutation=h.pending.shift();assert.match(mutation.url,/\/a\/read$/);assert.equal(mutation.init.method,'PATCH');mutation.resolve({notification:item('a',true)});
  await new Promise(resolve=>setImmediate(resolve));
  for(const req of h.pending.splice(0))req.resolve(req.url.endsWith('unread-count')?{unreadCount:0}:page([item('a',true)]));
  assert.equal(await action,true);oldRequest.resolve({unreadCount:7});await old;
  assert.equal(h.service.unreadCount(),0);assert.equal(h.service.recent()[0].read,true);
});
test('mutación y error 401 de A no afectan a la sesión B',async()=>{
  const h=harness();const action=h.service.remove(item());const old=h.pending.shift();h.switchTo('B');h.service.synchronize();
  old.reject(new ApiRequestError('expired',401));assert.equal(await action,false);assert.equal(h.auth.profile().userId,'B');assert.equal(h.warnings.length,0);
});
test('401 vigente limpia sesión, pero un fallo de red no la destruye',async()=>{
  const h=harness();let operation=h.service.load('recent');h.pending.shift().reject(new Error('network'));await operation;
  assert.equal(h.auth.profile().userId,'A');assert.ok(h.service.error());
  operation=h.service.refreshCount();h.pending.shift().reject(new ApiRequestError('expired',401));await operation;
  assert.equal(h.auth.token(),'');assert.equal(h.service.unreadCount(),0);assert.equal(h.warnings.length,1);
});

test('borrado y lectura masiva usan sus endpoints y reconcilian el contador con el servidor',async()=>{
  for(const [path,method,action] of [['/a','DELETE',s=>s.remove(item())],['/read-all','PATCH',s=>s.markAllRead()]]){
    const h=harness();const operation=action(h.service);const mutation=h.pending.shift();
    assert.ok(mutation.url.endsWith(path));assert.equal(mutation.init.method,method);mutation.resolve({});
    await new Promise(resolve=>setImmediate(resolve));
    for(const req of h.pending.splice(0))req.resolve(req.url.endsWith('unread-count')?{unreadCount:0}:page());
    assert.equal(await operation,true);assert.equal(h.service.unreadCount(),0);assert.deepEqual(h.service.recent(),[]);
  }
});

test('una mutación previa no desbloquea otra mientras sus refrescos terminan',async()=>{
  const h=harness();const first=h.service.markRead(item());h.pending.shift().resolve({});
  await new Promise(resolve=>setImmediate(resolve));const firstRefresh=h.pending.splice(0);
  const second=h.service.remove(item());const secondRequest=h.pending.shift();
  firstRefresh.forEach(req=>req.resolve(req.url.endsWith('unread-count')?{unreadCount:0}:page()));
  await first;assert.equal(h.service.busy(),true);
  secondRequest.reject(new Error('offline'));await second;assert.equal(h.service.busy(),false);
});

for(const outcome of ['success','401'])test(`restauración de sesión tardía (${outcome}) no restaura ni cierra otra cuenta`,async()=>{
  let pending;
  const {CustomerAuthService}=compile('src/app/core/services/customer-auth.service.ts',name=>{
    if(name==='@angular/core')return {...angular,inject:()=>({warning:()=>{throw new Error('stale warning');},dismissAll(){},close(){},adoptGuestCart:()=>true,adoptGuestShipping:()=>true,bindSession(){},syncAuthenticatedFavorites:async()=>true})};
    if(name.endsWith('api.config'))return {resolveApiBaseUrl:()=>'/api'};
    if(name.endsWith('api-client'))return {ApiRequestError,requestJson:()=>new Promise((resolve,reject)=>{pending={resolve,reject};})};
    return {};
  });
  const identity={version:angular.signal(0),activate(){this.version.update(n=>n+1);},beginTransition(){this.version.update(n=>n+1);},key:()=>'guest'};
  const auth=new CustomerAuthService({logout(){},setToken(){}},identity);
  auth.token.set('A');auth.profile.set({userId:'A',email:'a@example.test',role:'customer'});
  const restore=auth.restoreSession();auth.logout();auth.token.set('B');auth.profile.set({userId:'B',email:'b@example.test',role:'customer'});
  if(outcome==='success')pending.resolve({userId:'A',email:'a@example.test',role:'customer'});else pending.reject(new ApiRequestError('expired',401));
  await restore;assert.equal(auth.token(),'B');assert.equal(auth.profile().userId,'B');
});
