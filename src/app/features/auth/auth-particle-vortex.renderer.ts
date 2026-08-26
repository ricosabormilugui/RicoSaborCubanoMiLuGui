import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  GLSL1,
  NormalBlending,
  PerspectiveCamera,
  Points,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer
} from 'three';
import { AUTH_VISUAL_SUCCESS_MS, AuthVisualState } from './auth-visual.model';

const NAVY = [0.0, 0.36, 0.58];
const CREAM = [0.74, 0.68, 0.52];
const CORAL = [0.86, 0.18, 0.26];
const ARMS = 5;
const TURNS = 2.35;
const R_MAX = 2.32;
const R_EYE = 0.32;
const R_WALL = 0.54;

const VERT = /* glsl */ `
attribute float aSize;
attribute float aMorph;
attribute vec3 aColor;
attribute vec3 aSeed;
attribute vec3 aTarget;
uniform float uTime;
uniform float uEnergy;
uniform float uSuccess;
uniform float uReduced;
uniform float uSize;
uniform vec2 uPointer;
uniform vec3 uPerturb;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec3 p = position;
  float r = length(p.xy);
  float spin = mix(0.038, 0.26, smoothstep(R_MAX, R_EYE, r)) * uEnergy * (1.0 - uReduced);
  float ang = uTime * spin;
  float ca = cos(ang);
  float sa = sin(ang);
  vec2 xy = vec2(p.x * ca - p.y * sa, p.x * sa + p.y * ca);
  float nR = sin(uTime * 0.21 + aSeed.x * 6.28318) * 0.022 * uEnergy * (1.0 - uReduced);
  float nA = sin(uTime * 0.17 + aSeed.y * 6.28318) * 0.018 * uEnergy * (1.0 - uReduced);
  xy += vec2(nR * xy.x - nA * xy.y, nR * xy.y + nA * xy.x);

  float absorb = smoothstep(0.0, 0.192, uSuccess);
  float concentrate = smoothstep(0.154, 0.346, uSuccess);
  float morph = smoothstep(0.269, 0.5, uSuccess);
  float logoFade = smoothstep(0.423, 0.654, uSuccess);
  xy *= mix(1.0, 0.56, absorb);
  float dP = length(xy - uPerturb.xy);
  xy += normalize(xy - uPerturb.xy + 0.0008) * uPerturb.z * smoothstep(0.62, 0.0, dP) * (1.0 - uSuccess);

  vec3 live = vec3(xy + uPointer * 0.05 * (0.35 + r * 0.18), p.z * mix(1.0, 0.18, uSuccess));
  vec3 pos = mix(live, aTarget, morph * aMorph);

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.1, aSize * uSize / max(0.8, -mv.z));
  vColor = aColor;
  float inner = smoothstep(R_MAX, R_WALL, r);
  float idleAlpha = mix(0.26, 0.58, inner);
  idleAlpha *= mix(1.0, 0.06, step(r, R_EYE * 0.92));
  float successAlpha = mix(idleAlpha, mix(0.12, 0.78, smoothstep(1.15, 0.32, r)), concentrate);
  vAlpha = mix(idleAlpha, successAlpha, uSuccess);
  vAlpha *= mix(1.0, 0.35, logoFade * aMorph);
  vAlpha *= mix(1.0, 0.22, logoFade * (1.0 - aMorph) * smoothstep(0.55, 1.6, r));
}
`.replaceAll('R_MAX', R_MAX.toFixed(2)).replaceAll('R_EYE', R_EYE.toFixed(2)).replaceAll('R_WALL', R_WALL.toFixed(2));

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float alpha = smoothstep(0.5, 0.12, d) * vAlpha;
  if (alpha < 0.012) discard;
  gl_FragColor = vec4(vColor, alpha);
}
`;

function hash(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function particleBudget(): number {
  const cores = globalThis.navigator?.hardwareConcurrency || 4;
  const dpr = Math.min(globalThis.devicePixelRatio || 1, 1.5);
  const area = (globalThis.innerWidth || 1280) * (globalThis.innerHeight || 800);
  if (cores <= 4 || area < 1280 * 800) return 4200;
  if (cores >= 8 && dpr <= 1.25 && area >= 1440 * 900) return 7200;
  return 5600;
}

export function generateVortex(count: number): {
  positions: Float32Array;
  colors: Float32Array;
  seeds: Float32Array;
  sizes: Float32Array;
  targets: Float32Array;
  morphs: Float32Array;
} {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const targets = new Float32Array(count * 3);
  const morphs = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const arm = i % ARMS;
    let t = Math.pow(hash(i, 1.7), 0.62);
    if (hash(i, 4.2) < 0.16) t = 0.72 + hash(i, 8.1) * 0.22;
    let r = R_MAX * Math.pow(R_EYE / R_MAX, t);
    if (r < R_EYE * 0.9) r = R_EYE + hash(i, 9.4) * 0.1;
    const theta = t * TURNS * Math.PI * 2 + (arm * Math.PI * 2) / ARMS;
    const width = (0.2 - t * 0.15) * (0.55 + hash(i, 2.2));
    const a = theta + (hash(i, 3.3) - 0.5) * width + Math.sin(theta * 3.05 + arm) * 0.05;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r * 0.93;
    const z = (hash(i, 5.5) - 0.5) * 0.2 * (1.05 - t);
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    targets[i * 3] = x * 0.12;
    targets[i * 3 + 1] = y * 0.12;
    targets[i * 3 + 2] = 0;

    const roll = hash(i, 6.6);
    const inner = r < R_WALL;
    let col = NAVY;
    if (inner) {
      if (roll < 0.16) col = CREAM;
      else if (roll < 0.24) col = CORAL;
    } else if (roll > 0.82 && roll < 0.94) col = CREAM;
    else if (roll >= 0.94) col = CORAL;
    const jitter = 0.9 + hash(i, 7.7) * 0.14;
    colors[i * 3] = col[0] * jitter;
    colors[i * 3 + 1] = col[1] * jitter;
    colors[i * 3 + 2] = col[2] * jitter;
    sizes[i] = (inner ? 1.12 : 0.88) * (0.7 + hash(i, 1.1) * 0.55);
    seeds[i * 3] = hash(i, 0.3);
    seeds[i * 3 + 1] = hash(i, 1.3);
    seeds[i * 3 + 2] = hash(i, 2.3);
  }

  return { positions, colors, seeds, sizes, targets, morphs };
}

export interface VortexMountOptions {
  logoSrc: string;
  reducedMotion: boolean;
  host: HTMLElement;
  dark: boolean;
}

export class AuthParticleVortexRenderer {
  private renderer: WebGLRenderer | null = null;
  private scene: Scene | null = null;
  private camera: PerspectiveCamera | null = null;
  private points: Points | null = null;
  private geometry: BufferGeometry | null = null;
  private material: ShaderMaterial | null = null;
  private observer: ResizeObserver | null = null;
  private raf = 0;
  private last = 0;
  private time = 0;
  private host: HTMLElement | null = null;
  private reduced = false;
  private hidden = false;
  private disposed = false;
  private successAt = 0;
  private state: AuthVisualState = 'idle';
  private pointer = new Vector2();
  private pointerTarget = new Vector2();
  private energy = 1;
  private energyTarget = 1;
  private count = 5600;
  private readonly onVis = () => this.onVisibility();

  async mount(canvas: HTMLCanvasElement, options: VortexMountOptions): Promise<void> {
    this.host = options.host;
    this.reduced = options.reducedMotion;
    this.count = particleBudget();

    const renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
      depth: false,
      failIfMajorPerformanceCaveat: false
    });
    if (!renderer.getContext()) throw new Error('webgl-unavailable');
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = SRGBColorSpace;

    const scene = new Scene();
    const camera = new PerspectiveCamera(32, 1, 0.1, 20);
    camera.position.set(0, 0, 6.15);
    camera.lookAt(0, 0, 0);

    const { positions, colors, seeds, sizes, targets, morphs } = generateVortex(this.count);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new BufferAttribute(colors, 3));
    geometry.setAttribute('aSeed', new BufferAttribute(seeds, 3));
    geometry.setAttribute('aSize', new BufferAttribute(sizes, 1));
    geometry.setAttribute('aTarget', new BufferAttribute(targets, 3));
    geometry.setAttribute('aMorph', new BufferAttribute(morphs, 1));

    const material = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uEnergy: { value: 1 },
        uSuccess: { value: 0 },
        uReduced: { value: this.reduced ? 1 : 0 },
        uSize: { value: 34 },
        uPointer: { value: this.pointer },
        uPerturb: { value: new Vector3() }
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: options.dark ? AdditiveBlending : NormalBlending,
      toneMapped: false,
      glslVersion: GLSL1
    });

    const points = new Points(geometry, material);
    scene.add(points);

    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.geometry = geometry;
    this.material = material;
    this.points = points;

    this.resize();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(options.host);
    document.addEventListener('visibilitychange', this.onVis);

    void this.sampleLogo(options.logoSrc);
    this.last = performance.now();
    this.renderFrame(0);
    if (!this.reduced) this.raf = requestAnimationFrame(this.tick);
  }

  setState(state: AuthVisualState): void {
    this.state = state;
    this.energyTarget = state === 'interacting' ? 0.91 : state === 'success' ? 1.08 : 1;
    if (state === 'success' && this.successAt === 0) this.successAt = performance.now();
    if (state !== 'success') this.successAt = 0;
    if (this.reduced && this.material) {
      this.material.uniforms['uSuccess'].value = state === 'success' ? 1 : 0;
      this.renderFrame(0);
    } else if (state === 'success' && !this.raf && !this.disposed) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  setLogo(src: string): void {
    void this.sampleLogo(src);
  }

  setDark(dark: boolean): void {
    if (!this.material) return;
    this.material.blending = dark ? AdditiveBlending : NormalBlending;
    this.material.needsUpdate = true;
  }

  dispose(): void {
    this.disposed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.observer?.disconnect();
    this.observer = null;
    document.removeEventListener('visibilitychange', this.onVis);
    this.geometry?.dispose();
    this.material?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.points = null;
    this.geometry = null;
    this.material = null;
    this.host = null;
  }

  private tick = (now: number): void => {
    this.raf = 0;
    if (this.disposed || this.hidden) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.renderFrame(dt);
    const keep = !this.reduced || (this.state === 'success' && this.successProgress() < 1);
    if (keep && !this.disposed && !this.hidden) this.raf = requestAnimationFrame(this.tick);
  };

  private renderFrame(dt: number): void {
    const renderer = this.renderer;
    const scene = this.scene;
    const camera = this.camera;
    const material = this.material;
    if (!renderer || !scene || !camera || !material) return;

    this.time += dt * (this.reduced ? 0 : 1);
    this.energy += (this.energyTarget - this.energy) * Math.min(1, dt * 3);
    this.readPointer();
    this.pointer.lerp(this.pointerTarget, 1 - Math.exp(-dt * 5));

    const t = this.time;
    const orbit = (t % 16) / 16;
    const pr = R_MAX * Math.pow(R_EYE / R_MAX, orbit);
    const pa = orbit * TURNS * Math.PI * 2 - 0.55;
    const perturb = material.uniforms['uPerturb'].value as Vector3;
    perturb.set(Math.cos(pa) * pr, Math.sin(pa) * pr * 0.93, this.state === 'success' ? 0 : 0.09);

    material.uniforms['uTime'].value = this.time;
    material.uniforms['uEnergy'].value = this.energy;
    material.uniforms['uSuccess'].value = this.successProgress();
    material.uniforms['uSize'].value = 30 * Math.min(globalThis.devicePixelRatio || 1, 1.5);

    camera.position.x = this.pointer.x * 0.1;
    camera.position.y = this.pointer.y * 0.08;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }

  private successProgress(): number {
    if (!this.successAt) return 0;
    return Math.min(1, (performance.now() - this.successAt) / AUTH_VISUAL_SUCCESS_MS);
  }

  private readPointer(): void {
    if (!this.host || this.reduced) {
      this.pointerTarget.set(0, 0);
      return;
    }
    const style = getComputedStyle(this.host);
    const x = parseFloat(style.getPropertyValue('--visual-x')) || 0;
    const y = parseFloat(style.getPropertyValue('--visual-y')) || 0;
    this.pointerTarget.set(x / 4, -y / 4);
  }

  private resize(): void {
    if (!this.renderer || !this.camera || !this.host) return;
    const rect = this.host.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.reduced) this.renderFrame(0);
  }

  private onVisibility(): void {
    this.hidden = document.hidden;
    if (this.hidden) {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      return;
    }
    this.last = performance.now();
    if (!this.disposed && !this.raf && !this.reduced) this.raf = requestAnimationFrame(this.tick);
  }

  private async sampleLogo(src: string): Promise<void> {
    if (!src || this.disposed) return;
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
      await img.decode();
      if (this.disposed || !this.geometry) return;
      const size = 96;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      const data = ctx.getImageData(0, 0, size, size).data;
      const hits: number[] = [];
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          if (data[(y * size + x) * 4 + 3] > 88) hits.push(x, y);
        }
      }
      if (hits.length < 8) return;
      const attr = this.geometry.getAttribute('aTarget') as BufferAttribute;
      const morphAttr = this.geometry.getAttribute('aMorph') as BufferAttribute;
      const pos = this.geometry.getAttribute('position') as BufferAttribute;
      const morphCount = Math.min(this.count, Math.floor(this.count * 0.38));
      const span = 1.18;
      for (let i = 0; i < this.count; i++) {
        if (i < morphCount) {
          const point = i % Math.floor(hits.length / 2);
          const hx = hits[point * 2];
          const hy = hits[point * 2 + 1];
          attr.setXYZ(i, ((hx / size) - 0.5) * span, (0.5 - hy / size) * span, 0.02);
          morphAttr.setX(i, 1);
        } else {
          attr.setXYZ(i, pos.getX(i) * 0.08, pos.getY(i) * 0.08, 0);
          morphAttr.setX(i, 0);
        }
      }
      attr.needsUpdate = true;
      morphAttr.needsUpdate = true;
      if (this.reduced) this.renderFrame(0);
    } catch {
      /* morph is optional; the real PNG logo still appears on success */
    }
  }
}
