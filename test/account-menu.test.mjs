import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('el menú de cuenta es único y se reutiliza en desktop y mobile', async () => {
  const [app, menu] = await Promise.all([
    read('src/app/app.component.ts'),
    read('src/app/shared/ui/account-menu.component.ts')
  ]);

  assert.match(app, /<app-account-menu/);
  assert.equal([...app.matchAll(/<app-account-menu/g)].length, 1);
  assert.doesNotMatch(app, /class="icon-btn mobile-only"[\s\S]{0,180}openAccount/);
  assert.doesNotMatch(app, /mobile-only[\s\S]{0,220}name="user"/);
  assert.doesNotMatch(menu, /navigateByUrl\('\/login'\)[\s\S]*navigateByUrl\('\/login'\)/);

  assert.match(menu, /name="user"/);
  assert.match(menu, /Acceder a tu cuenta/);
  assert.match(menu, /Abrir menú de cuenta/);
  assert.match(menu, /aria-haspopup="menu"/);
  assert.match(menu, /aria-expanded/);
  assert.match(menu, /Iniciar sesión/);
  assert.match(menu, /Registro/);
  assert.match(menu, /Mis favoritos/);
  assert.match(menu, /\*ngIf="!auth\.isAdminAccount\(\)"/);
  assert.match(menu, /Mis notificaciones/);
  assert.match(menu, /Mis pedidos/);
  assert.match(menu, />Salir</);
  assert.match(menu, /auth\.logout\(\)/);
  assert.match(menu, /CustomerAuthService/);
  assert.match(menu, /flex: 0 0 44px/);
  assert.match(menu, /width: 44px/);
  assert.match(menu, /height: 44px/);
  assert.doesNotMatch(menu, /openAccount/);
  assert.doesNotMatch(app, /Salir cliente/);
  assert.doesNotMatch(app, /routerLink="\/registro"/);
});
