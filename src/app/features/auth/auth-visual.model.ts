export type AuthVisualState = 'idle' | 'interacting' | 'success';
export type AuthVisualSuccessKind = 'welcome' | 'reset';
export type AuthVisualDepth = 'back' | 'middle' | 'front';

export interface FloatingProduct {
  id: string;
  src: string;
  alt: string;
  depth: AuthVisualDepth;
  size: number;
  cycle: number;
  delay: number;
  rotate: number;
  staticX: number;
  staticY: number;
  parked: boolean;
}

const VORTEX_CYCLE = 52;

export const AUTH_FLOATING_PRODUCTS: FloatingProduct[] = [
  { id: 'tarta', src: '/assets/auth/products/tarta.webp', alt: '', depth: 'front', size: 132, cycle: VORTEX_CYCLE, delay: -0.8, rotate: 8, staticX: 74, staticY: 80, parked: true },
  { id: 'plato', src: '/assets/auth/products/plato.webp', alt: '', depth: 'front', size: 158, cycle: VORTEX_CYCLE, delay: -7, rotate: 7, staticX: 28, staticY: 38, parked: true },
  { id: 'croquetas', src: '/assets/auth/products/croquetas.webp', alt: '', depth: 'middle', size: 108, cycle: VORTEX_CYCLE, delay: -12.5, rotate: 9, staticX: 49, staticY: 38, parked: true },
  { id: 'pastelito', src: '/assets/auth/products/pastelito.webp', alt: '', depth: 'middle', size: 146, cycle: VORTEX_CYCLE, delay: 5.5, rotate: 10, staticX: 69, staticY: 67, parked: false },
  { id: 'cupcake', src: '/assets/auth/products/cupcake.webp', alt: '', depth: 'front', size: 118, cycle: VORTEX_CYCLE, delay: 12, rotate: 10, staticX: 62, staticY: 33, parked: false },
  { id: 'tartaleta', src: '/assets/auth/products/tartaleta.webp', alt: '', depth: 'back', size: 92, cycle: VORTEX_CYCLE, delay: 18.5, rotate: 8, staticX: 51, staticY: 12, parked: false },
  { id: 'pie', src: '/assets/auth/products/pie.webp', alt: '', depth: 'back', size: 112, cycle: VORTEX_CYCLE, delay: 25, rotate: 8, staticX: 48, staticY: 76, parked: false }
];

export const AUTH_VISUAL_SUCCESS_MS = 650;
export const AUTH_VISUAL_SUCCESS_REDUCED_MS = 280;
