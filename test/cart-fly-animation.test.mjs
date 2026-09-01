import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import '@angular/compiler';
import * as angular from '@angular/core';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFileSync(resolve(root, path), 'utf8');

function loadCartAnimationService() {
  const path = resolve(root, 'src/app/core/services/cart-animation.service.ts');
  const js = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true }
  }).outputText;
  const module = { exports: {} };
  const require = (name) => {
    if (name === '@angular/core') return angular;
    if (name.endsWith('responsive-image')) return { optimizedImageUrl: (url) => url };
    if (name.startsWith('.')) {
      throw new Error('Unexpected relative import ' + name);
    }
    throw new Error('Unmocked ' + name + ' from ' + path);
  };
  new Function('require', 'module', 'exports', js)(require, module, module.exports);
  return module.exports;
}

function rect(left, top, width, height) {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

function installDom({ reducedMotion = false, innerWidth = 1280 } = {}) {
  const body = {
    children: [],
    appendChild(node) {
      this.children.push(node);
      node.parentNode = this;
      return node;
    }
  };

  globalThis.innerWidth = innerWidth;
  globalThis.matchMedia = (query) => ({
    matches: reducedMotion && String(query).includes('prefers-reduced-motion')
  });
  globalThis.getComputedStyle = (element) => element.styleState || { display: 'block', visibility: 'visible', opacity: '1' };

  globalThis.document = {
    body,
    createElement(tag) {
      const node = {
        tagName: String(tag).toLowerCase(),
        src: '',
        alt: '',
        decoding: '',
        style: { cssText: '' },
        parentNode: null,
        setAttribute() {},
        removeAttribute() {},
        remove() {
          body.children = body.children.filter((child) => child !== node);
          node.parentNode = null;
        },
        animate(keyframes, options) {
          node.animation = { keyframes, options };
          return { finished: Promise.resolve() };
        }
      };
      return node;
    }
  };

  return body;
}

function visibleTarget(overrides = {}) {
  return {
    getBoundingClientRect: () => rect(400, 6, 34, 34),
    getClientRects: () => [rect(400, 6, 34, 34)],
    styleState: { display: 'block', visibility: 'visible', opacity: '1' },
    animate(keyframes, options) {
      this.pulses = this.pulses || [];
      this.pulses.push({ keyframes, options });
      return { finished: Promise.resolve() };
    },
    ...overrides
  };
}

const app = () => read('src/app/app.component.ts');
const card = () => read('src/app/shared/ui/product-card.component.ts');
const detail = () => read('src/app/features/catalog/product-detail-page.component.ts');
const detailHtml = () => read('src/app/features/catalog/product-detail-page.component.html');
const cartService = () => read('src/app/core/services/cart.service.ts');
const liveAdd = () => read('src/app/core/utils/live-add-to-cart.ts');
const animation = () => read('src/app/core/services/cart-animation.service.ts');
const home = () => read('src/app/features/home/home-page.component.html');
const pkg = () => read('package.json');

test('A: un add válido dispara la animación de vuelo', () => {
  assert.match(card(), /added !== true/);
  assert.match(card(), /cartAnimation\.animateAddToCart/);
  assert.match(card(), /productImage\(\)/);
  assert.match(liveAdd(), /return true;/);
  assert.match(detail(), /if \(added && this\.product\(\)\?\.id === live\.id\) this\.playAddToCartAnimation/);
});

test('B: un add rechazado no anima', () => {
  assert.match(card(), /const added = await this\.addAction\(\)\?\.\(\);/);
  assert.match(card(), /if \(added !== true\) return;/);
  assert.match(liveAdd(), /return false;/);
  assert.match(detail(), /if \(!evaluation\.allowed\) \{[\s\S]*return false;/);
});

test('C: stock máximo no anima', () => {
  assert.match(liveAdd(), /evaluateLiveAddToCart\(live, minimumQuantity\(live\), deps\.cart\.items\(\)\)/);
  assert.match(liveAdd(), /if \(!evaluation\.allowed\) \{[\s\S]*return false;/);
  assert.match(detail(), /if \(!evaluation\.allowed\) \{[\s\S]*return false;/);
});

test('D: personalizable sin configurar no anima un falso add', () => {
  const source = card();
  assert.match(source, /@else if \(customizable\(\)\) \{[\s\S]*<a class="cta" \[routerLink\]="route\(\)"/);
  assert.match(source, /if \(this\.customizable\(\)\) \{[\s\S]*this\.router\.navigate\(this\.route\(\)\);[\s\S]*return;/);
  assert.match(liveAdd(), /if \(isProductCustomizable\(product\)\) \{[\s\S]*return false;/);
  assert.match(detail(), /hasAllRequiredCustomizations[\s\S]*return false;/);
});

test('E: target ausente no rompe el add', async () => {
  installDom();
  const { CartAnimationService } = loadCartAnimationService();
  const service = new CartAnimationService();
  const source = { tagName: 'IMG', currentSrc: 'https://img.test/cake.webp', getBoundingClientRect: () => rect(10, 80, 40, 40) };
  assert.doesNotThrow(() => service.animateAddToCart({ sourceElement: source, imageUrl: 'https://img.test/cake.webp' }));
  assert.equal(globalThis.document.body.children.length, 0);
});

test('F: la card compact usa la misma animación', () => {
  assert.match(card(), /density = input<'default' \| 'compact'>/);
  assert.match(card(), /async add\(event\?: Event\)/);
  assert.match(home(), /density="compact"/);
  assert.match(detailHtml(), /density="compact"/);
});

test('G: Product Detail anima desde el hero', () => {
  assert.match(detailHtml(), /#heroImage/);
  assert.match(detail(), /playAddToCartAnimation/);
  assert.match(detail(), /heroImage\(\)\?\.nativeElement/);
  assert.match(detail(), /hero\?\.currentSrc \|\| hero\?\.src/);
});

test('H / J: prefers-reduced-motion evita el vuelo', () => {
  const body = installDom({ reducedMotion: true });
  const { CartAnimationService } = loadCartAnimationService();
  const service = new CartAnimationService();
  service.registerTarget(visibleTarget({
    animate() { throw new Error('pulse should not run'); }
  }));
  service.animateAddToCart({
    sourceElement: { tagName: 'IMG', currentSrc: 'https://img.test/beer.webp', getBoundingClientRect: () => rect(12, 140, 180, 180) },
    imageUrl: 'https://img.test/beer.webp'
  });
  assert.equal(body.children.length, 0);
  assert.match(animation(), /prefers-reduced-motion: reduce/);
});

test('A: target visible elegido', () => {
  installDom();
  const { CartAnimationService, isVisibleCartTarget } = loadCartAnimationService();
  const service = new CartAnimationService();
  const hidden = visibleTarget({
    getBoundingClientRect: () => rect(0, 0, 0, 0),
    getClientRects: () => []
  });
  const shown = visibleTarget();
  service.registerTarget(hidden);
  service.registerTarget(shown);
  assert.equal(isVisibleCartTarget(hidden), false);
  assert.equal(isVisibleCartTarget(shown), true);
  assert.equal(service.visibleTarget(), shown);
});

test('B: target hidden ignorado', () => {
  installDom();
  const { CartAnimationService } = loadCartAnimationService();
  const service = new CartAnimationService();
  service.registerTarget(visibleTarget({
    getBoundingClientRect: () => rect(0, 0, 0, 0),
    getClientRects: () => [],
    styleState: { display: 'none', visibility: 'hidden', opacity: '0' }
  }));
  assert.equal(service.visibleTarget(), null);
  service.animateAddToCart({
    sourceElement: { tagName: 'IMG', currentSrc: 'https://img.test/cake.webp', getBoundingClientRect: () => rect(20, 80, 160, 160) },
    imageUrl: 'https://img.test/cake.webp'
  });
  assert.equal(globalThis.document.body.children.length, 0);
});

test('C: clone usa currentSrc', () => {
  const body = installDom();
  const { CartAnimationService, resolveFlyImageUrl } = loadCartAnimationService();
  const service = new CartAnimationService();
  service.registerTarget(visibleTarget());
  const source = {
    tagName: 'IMG',
    currentSrc: 'https://res.cloudinary.com/demo/image/upload/v1/cached.webp',
    src: 'https://fallback.test/original.webp',
    getBoundingClientRect: () => rect(80, 220, 200, 180)
  };
  assert.equal(resolveFlyImageUrl(source, 'https://other.test/x.webp'), source.currentSrc);
  service.animateAddToCart({ sourceElement: source, imageUrl: 'https://other.test/x.webp' });
  assert.equal(body.children[0].src, source.currentSrc);
  assert.doesNotMatch(animation(), /optimizedImageUrl/);
});

test('D: clone se añade al body', () => {
  const body = installDom();
  const { CartAnimationService } = loadCartAnimationService();
  const service = new CartAnimationService();
  service.registerTarget(visibleTarget());
  service.animateAddToCart({
    sourceElement: { tagName: 'IMG', currentSrc: 'https://img.test/tarta.webp', getBoundingClientRect: () => rect(80, 220, 200, 180) },
    imageUrl: 'https://img.test/tarta.webp'
  });
  assert.equal(body.children.length, 1);
  assert.equal(body.children[0].parentNode, body);
  assert.match(body.children[0].style.cssText, /position:fixed/);
  assert.match(body.children[0].style.cssText, /display:block/);
  assert.match(body.children[0].style.cssText, /visibility:visible/);
  assert.match(body.children[0].style.cssText, /pointer-events:none/);
});

test('E: cleanup después de finished', async () => {
  const body = installDom();
  const { CartAnimationService } = loadCartAnimationService();
  const service = new CartAnimationService();
  const target = visibleTarget();
  service.registerTarget(target);
  service.animateAddToCart({
    sourceElement: { tagName: 'IMG', currentSrc: 'https://img.test/tarta.webp', getBoundingClientRect: () => rect(80, 220, 200, 180) },
    imageUrl: 'https://img.test/tarta.webp'
  });
  assert.equal(body.children.length, 1);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(body.children.length, 0);
  assert.equal(target.pulses.length, 1);
  assert.equal(target.pulses[0].options.duration, 240);
});

test('F: duration >= 700ms', () => {
  const body = installDom();
  const { CartAnimationService, FLY_DURATION_MS } = loadCartAnimationService();
  const service = new CartAnimationService();
  service.registerTarget(visibleTarget());
  service.animateAddToCart({
    sourceElement: { tagName: 'IMG', currentSrc: 'https://img.test/tarta.webp', getBoundingClientRect: () => rect(80, 220, 200, 180) },
    imageUrl: 'https://img.test/tarta.webp'
  });
  assert.ok(FLY_DURATION_MS >= 700);
  assert.equal(body.children[0].animation.options.duration, 740);
});

test('G: opacity no cae antes de ~70%', () => {
  const body = installDom();
  const { CartAnimationService } = loadCartAnimationService();
  const service = new CartAnimationService();
  service.registerTarget(visibleTarget());
  service.animateAddToCart({
    sourceElement: { tagName: 'IMG', currentSrc: 'https://img.test/tarta.webp', getBoundingClientRect: () => rect(80, 220, 200, 180) },
    imageUrl: 'https://img.test/tarta.webp'
  });
  const frames = body.children[0].animation.keyframes;
  const early = frames.filter((frame) => (frame.offset ?? 0) <= 0.7);
  assert.ok(early.length >= 1);
  assert.ok(early.every((frame) => frame.opacity === 1));
  assert.equal(frames.find((frame) => frame.offset === 0.9).opacity, 0.85);
});

test('H: z-index visible', () => {
  const body = installDom();
  const { CartAnimationService, FLY_Z_INDEX } = loadCartAnimationService();
  const service = new CartAnimationService();
  service.registerTarget(visibleTarget());
  service.animateAddToCart({
    sourceElement: { tagName: 'IMG', currentSrc: 'https://img.test/tarta.webp', getBoundingClientRect: () => rect(80, 220, 200, 180) },
    imageUrl: 'https://img.test/tarta.webp'
  });
  assert.equal(FLY_Z_INDEX, 9999);
  assert.match(body.children[0].style.cssText, /z-index:9999/);
  assert.doesNotMatch(animation(), /z-index:60/);
});

test('I: scroll no altera coordenadas', () => {
  assert.doesNotMatch(animation(), /scrollX|scrollY|pageXOffset|pageYOffset/);
  assert.match(animation(), /getBoundingClientRect\(\)/);
  assert.match(animation(), /left:0/);
  assert.match(animation(), /top:0/);
  assert.match(animation(), /transform:translate\(\$\{startX\}px, \$\{startY\}px\)/);
});

test('J: CartService no contiene lógica visual', () => {
  const source = cartService();
  assert.doesNotMatch(source, /CartAnimationService/);
  assert.doesNotMatch(source, /animateAddToCart/);
  assert.doesNotMatch(source, /getBoundingClientRect/);
  assert.doesNotMatch(source, /createElement\(/);
});

test('mobile usa 68px y desktop 76px', () => {
  installDom({ innerWidth: 390 });
  const { flyCloneSize } = loadCartAnimationService();
  assert.equal(flyCloneSize(), 68);
  installDom({ innerWidth: 1280 });
  assert.equal(flyCloneSize(), 76);
});

test('la navbar registra el destino real del carrito sin selectores frágiles', () => {
  assert.match(app(), /appCartFlyTarget/);
  assert.match(app(), /data-cart-target/);
  assert.match(animation(), /FLY_DURATION_MS = 740/);
  assert.match(animation(), /scale\(0\.28\)/);
  assert.match(animation(), /isDevMode\(\)/);
  assert.doesNotMatch(animation(), /border:2px solid red|outline:2px dashed/);
  assert.doesNotMatch(pkg(), /gsap|framer-motion|anime\.js/i);
});
