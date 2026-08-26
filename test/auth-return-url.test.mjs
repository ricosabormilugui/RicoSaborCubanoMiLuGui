import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));

function load(path) {
  const file = resolve(root, path);
  const js = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  const require = (name) => {
    if (name.startsWith('.')) {
      const candidate = resolve(dirname(file), name);
      return load(candidate.endsWith('.ts') ? candidate : `${candidate}.ts`);
    }
    throw new Error(`Unmocked ${name}`);
  };
  new Function('require', 'module', 'exports', js)(require, module, module.exports);
  return module.exports;
}

const { DEFAULT_AUTH_RETURN_URL, isSafeReturnUrl, returnUrlQueryParams, safeReturnUrl } = load('src/app/core/utils/safe-return-url.ts');

test('returnUrl interno seguro se acepta y el externo se rechaza', () => {
  assert.equal(DEFAULT_AUTH_RETURN_URL, '/checkout');
  assert.equal(safeReturnUrl('/favoritos'), '/favoritos');
  assert.equal(safeReturnUrl('/productos/combo-cubano'), '/productos/combo-cubano');
  assert.equal(safeReturnUrl('/favoritos?tab=1'), '/favoritos?tab=1');
  assert.equal(isSafeReturnUrl('https://externo.com'), false);
  assert.equal(isSafeReturnUrl('//externo.com'), false);
  assert.equal(isSafeReturnUrl('javascript:alert(1)'), false);
  assert.equal(isSafeReturnUrl('/\\externo.com'), false);
  assert.equal(safeReturnUrl('https://externo.com'), '/checkout');
  assert.equal(safeReturnUrl('//externo.com'), '/checkout');
  assert.equal(safeReturnUrl('javascript:alert(1)'), '/checkout');
  assert.equal(safeReturnUrl(null), '/checkout');
  assert.equal(safeReturnUrl(''), '/checkout');
  assert.equal(safeReturnUrl('/login'), '/checkout');
  assert.equal(safeReturnUrl('/registro'), '/checkout');
  assert.deepEqual(returnUrlQueryParams('/favoritos'), { returnUrl: '/favoritos' });
  assert.deepEqual(returnUrlQueryParams('https://externo.com'), {});
});

test('login y registro comparten helper y conservan returnUrl entre sí', () => {
  const login = readFileSync(resolve(root, 'src/app/features/auth/login-page.component.ts'), 'utf8');
  const register = readFileSync(resolve(root, 'src/app/features/auth/register-page.component.ts'), 'utf8');
  const guard = readFileSync(resolve(root, 'src/app/core/guards/customer.guard.ts'), 'utf8');
  const service = readFileSync(resolve(root, 'src/app/core/services/favorites.service.ts'), 'utf8');

  assert.match(login, /from '\.\.\/\.\.\/core\/utils\/safe-return-url'/);
  assert.match(register, /from '\.\.\/\.\.\/core\/utils\/safe-return-url'/);
  assert.match(login, /routerLink="\/registro" \[queryParams\]="returnLinkParams"/);
  assert.match(register, /routerLink="\/login" \[queryParams\]="returnLinkParams"/);
  assert.match(login, /navigateByUrl\(this\.destinationUrl\(\)\)/);
  assert.match(register, /navigateByUrl\(safeReturnUrl\(this\.route\.snapshot\.queryParamMap\.get\('returnUrl'\)\)\)/);
  assert.doesNotMatch(register, /navigateByUrl\('\/checkout'\)/);
  assert.match(guard, /queryParams: \{ returnUrl: state\.url \}/);
  assert.match(service, /queryParams: \{ returnUrl: safeReturnUrl\(current, '\/favoritos'\) \}/);
});
