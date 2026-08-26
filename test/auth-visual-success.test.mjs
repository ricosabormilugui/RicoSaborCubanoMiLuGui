import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(resolve(root, path), 'utf8');

function load(path) {
  const file = resolve(root, path);
  const js = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(() => {
    throw new Error(`Unmocked ${path}`);
  }, module, module.exports);
  return module.exports;
}

const successSlice = (source) => source.slice(source.indexOf('try {'), source.indexOf('} catch'));
const catchSlice = (source) => source.slice(source.indexOf('} catch'));

test('la escena auth usa productos locales configurables y un success acotado', () => {
  const { AUTH_FLOATING_PRODUCTS, AUTH_VISUAL_SUCCESS_MS, AUTH_VISUAL_SUCCESS_REDUCED_MS } = load('src/app/features/auth/auth-visual.model.ts');

  assert.equal(AUTH_VISUAL_SUCCESS_MS, 650);
  assert.equal(AUTH_VISUAL_SUCCESS_REDUCED_MS, 280);
  assert.ok(AUTH_VISUAL_SUCCESS_MS >= 550 && AUTH_VISUAL_SUCCESS_MS <= 750);
  assert.ok(AUTH_FLOATING_PRODUCTS.length >= 5 && AUTH_FLOATING_PRODUCTS.length <= 7);
  assert.deepEqual(new Set(AUTH_FLOATING_PRODUCTS.map((item) => item.depth)), new Set(['back', 'middle', 'front']));
  assert.ok(AUTH_FLOATING_PRODUCTS.every((item) => !('path' in item)));
  assert.ok(AUTH_FLOATING_PRODUCTS.every((item) => item.cycle >= 48 && item.cycle <= 56));
  assert.equal(new Set(AUTH_FLOATING_PRODUCTS.map((item) => item.cycle)).size, 1);
  assert.ok(AUTH_FLOATING_PRODUCTS.filter((item) => item.parked).length === 3);

  for (const item of AUTH_FLOATING_PRODUCTS) {
    assert.match(item.src, /^\/assets\/auth\/products\//);
    assert.equal(item.alt, '');
    assert.ok(existsSync(resolve(root, 'public' + item.src)));
  }
});

test('el panel visual desktop monta la escena y no carga fotos CMS', () => {
  const layout = read('src/app/features/auth/auth-layout.component.ts');
  const html = read('src/app/features/auth/auth-layout.component.html');
  const stage = read('src/app/features/auth/auth-visual-stage.component.ts');
  const renderer = read('src/app/features/auth/auth-particle-vortex.renderer.ts');
  const pkg = read('package.json');
  const main = read('src/main.ts');
  const app = read('src/app/app.component.ts');

  assert.match(html, /\*ngIf="showVisual\(\)"/);
  assert.match(html, /<app-auth-visual-stage/);
  assert.match(read('src/app/features/auth/auth-visual-stage.component.html'), /class="vortex-canvas"/);
  assert.match(read('src/app/features/auth/auth-visual-stage.component.html'), /class="vortex-fallback"/);
  assert.match(read('src/app/features/auth/auth-visual-stage.component.html'), /vortex-eye/);
  assert.doesNotMatch(read('src/app/features/auth/auth-visual-stage.component.html'), /vortex-svg|auth-vortex-motion|feTurbulence|swoosh-navy-top|flow-navy-top|path-coral-left/);
  assert.doesNotMatch(read('src/app/features/auth/auth-visual-stage.component.html'), /Todo el sabor|Sabores que se encuentran|stage-copy|stage-blob|stage-bg/);
  assert.match(read('src/app/features/auth/auth-visual-stage.component.css'), /@keyframes flow-vortex/);
  assert.match(read('src/app/features/auth/auth-visual-stage.component.css'), /vortex-haze/);
  assert.match(read('src/app/features/auth/auth-visual-stage.component.css'), /vortex-compose/);
  assert.match(read('src/app/features/auth/auth-visual-stage.component.css'), /vortex-ambient/);
  assert.doesNotMatch(read('src/app/features/auth/auth-visual-stage.component.css'), /flow-navy-top|flow-coral-left|flow-navy-bottom/);
  assert.match(read('src/app/features/auth/auth-visual-stage.component.css'), /prefers-reduced-motion: reduce/);
  assert.match(layout, /min-width: 1024px/);
  assert.match(layout, /async playSuccess\(kind: AuthVisualSuccessKind\)/);
  assert.match(layout, /AUTH_VISUAL_SUCCESS_MS/);
  assert.match(layout, /waitForSuccess/);
  assert.doesNotMatch(layout, /HomeContentService/);
  assert.doesNotMatch(layout, /visualPhoto/);
  assert.doesNotMatch(html, /auth-visual-photo/);
  assert.match(stage, /selector: 'app-auth-visual-stage'/);
  assert.match(stage, /import\('\.\/auth-particle-vortex\.renderer'\)/);
  assert.doesNotMatch(stage, /from ['"]three['"]/);
  assert.doesNotMatch(main, /three/);
  assert.doesNotMatch(app, /from ['"]three['"]/);
  assert.match(pkg, /"three"/);
  assert.doesNotMatch(pkg, /animejs|simplex-noise|dat\.gui|lil-gui|gsap/i);
  assert.match(renderer, /generateVortex/);
  assert.match(renderer, /ShaderMaterial/);
  assert.match(renderer, /new Points\(/);
  assert.match(renderer, /particleBudget/);
  assert.match(renderer, /visibilitychange/);
  assert.match(renderer, /ResizeObserver/);
  assert.match(renderer, /dispose\(/);
  assert.doesNotMatch(renderer, /OrbitControls|anime|dat\.gui|lil-gui|UnrealBloomPass|EffectComposer|simplex-noise/i);
  assert.doesNotMatch(read('src/app/features/auth/auth-visual-stage.component.css'), /three\.js|gsap|anime\.js/i);
});

test('success solo corre tras backend OK y conserva returnUrl', () => {
  const login = read('src/app/features/auth/login-page.component.ts');
  const register = read('src/app/features/auth/register-page.component.ts');
  const reset = read('src/app/features/auth/reset-password-page.component.ts');
  const forgot = read('src/app/features/auth/forgot-password-page.component.ts');

  const loginOk = successSlice(login);
  const registerOk = successSlice(register);
  const resetOk = successSlice(reset);

  assert.match(loginOk, /await this\.auth\.login\(email, this\.password\)/);
  assert.match(loginOk, /playSuccess\('welcome'\)/);
  assert.match(loginOk, /navigateByUrl\(this\.destinationUrl\(\)\)/);
  assert.ok(loginOk.indexOf('auth.login') < loginOk.indexOf("playSuccess('welcome')"));
  assert.ok(loginOk.indexOf("playSuccess('welcome')") < loginOk.indexOf('navigateByUrl'));
  assert.doesNotMatch(catchSlice(login), /playSuccess/);

  assert.match(registerOk, /await this\.auth\.register/);
  assert.match(registerOk, /playSuccess\('welcome'\)/);
  assert.match(registerOk, /navigateByUrl\(safeReturnUrl\(this\.route\.snapshot\.queryParamMap\.get\('returnUrl'\)\)\)/);
  assert.ok(registerOk.indexOf('auth.register') < registerOk.indexOf("playSuccess('welcome')"));
  assert.doesNotMatch(catchSlice(register), /playSuccess/);

  assert.match(resetOk, /await this\.recovery\.resetPassword/);
  assert.match(resetOk, /playSuccess\('reset'\)/);
  assert.ok(resetOk.indexOf('resetPassword') < resetOk.indexOf("playSuccess('reset')"));
  assert.doesNotMatch(catchSlice(reset), /playSuccess/);

  assert.doesNotMatch(forgot, /playSuccess/);
  assert.match(login, /navigateByUrl\(this\.destinationUrl\(\)\)/);
});
