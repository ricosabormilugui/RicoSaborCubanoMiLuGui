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
  {
    id: 'tarta',
    src: '/assets/auth/products/tarta.webp',
    alt: '',
    depth: 'front',
    size: 126,
    cycle: VORTEX_CYCLE,
    delay: -1,
    rotate: 8,
    staticX: 74,
    staticY: 80,
    parked: true,
  },

  {
    id: 'tarta_2',
    src: '/assets/auth/products/tarta_2.webp',
    alt: '',
    depth: 'middle',
    size: 112,
    cycle: VORTEX_CYCLE,
    delay: -5,
    rotate: -6,
    staticX: 63,
    staticY: 72,
    parked: false,
  },

  {
    id: 'tarta_3',
    src: '/assets/auth/products/tarta_3.webp',
    alt: '',
    depth: 'back',
    size: 96,
    cycle: VORTEX_CYCLE,
    delay: -9,
    rotate: 5,
    staticX: 82,
    staticY: 58,
    parked: false,
  },

  {
    id: 'tarta_4',
    src: '/assets/auth/products/tarta_4.webp',
    alt: '',
    depth: 'front',
    size: 118,
    cycle: VORTEX_CYCLE,
    delay: -13,
    rotate: -8,
    staticX: 69,
    staticY: 45,
    parked: false,
  },

  {
    id: 'tarta_3_leches',
    src: '/assets/auth/products/tarta_3_leches.webp',
    alt: '',
    depth: 'middle',
    size: 106,
    cycle: VORTEX_CYCLE,
    delay: -17,
    rotate: 6,
    staticX: 78,
    staticY: 30,
    parked: false,
  },

  {
    id: 'tarta_zanahoria',
    src: '/assets/auth/products/tarta_zanahoria.webp',
    alt: '',
    depth: 'back',
    size: 92,
    cycle: VORTEX_CYCLE,
    delay: -21,
    rotate: -7,
    staticX: 66,
    staticY: 18,
    parked: false,
  },

  {
    id: 'tamal',
    src: '/assets/auth/products/tamal.webp',
    alt: '',
    depth: 'front',
    size: 154,
    cycle: VORTEX_CYCLE,
    delay: -25,
    rotate: 7,
    staticX: 28,
    staticY: 38,
    parked: true,
  },

  {
    id: 'croquetas',
    src: '/assets/auth/products/croquetas.webp',
    alt: '',
    depth: 'middle',
    size: 94,
    cycle: VORTEX_CYCLE,
    delay: -29,
    rotate: -9,
    staticX: 43,
    staticY: 28,
    parked: true,
  },

  {
    id: 'ensalada_fria',
    src: '/assets/auth/products/ensalada_fria.webp',
    alt: '',
    depth: 'front',
    size: 140,
    cycle: VORTEX_CYCLE,
    delay: -33,
    rotate: 10,
    staticX: 32,
    staticY: 70,
    parked: false,
  },

  {
    id: 'tartaleta_guayaba',
    src: '/assets/auth/products/tartaleta_guayaba.webp',
    alt: '',
    depth: 'middle',
    size: 132,
    cycle: VORTEX_CYCLE,
    delay: -37,
    rotate: -10,
    staticX: 48,
    staticY: 82,
    parked: false,
  },

  {
    id: 'tartaleta_coco',
    src: '/assets/auth/products/tartaleta_coco.webp',
    alt: '',
    depth: 'back',
    size: 82,
    cycle: VORTEX_CYCLE,
    delay: -41,
    rotate: 8,
    staticX: 22,
    staticY: 54,
    parked: false,
  },

  {
    id: 'pie_guayaba',
    src: '/assets/auth/products/pie_guayaba.webp',
    alt: '',
    depth: 'back',
    size: 96,
    cycle: VORTEX_CYCLE,
    delay: -45,
    rotate: -6,
    staticX: 37,
    staticY: 15,
    parked: false,
  },

  {
    id: 'pie_coco',
    src: '/assets/auth/products/pie_coco.webp',
    alt: '',
    depth: 'middle',
    size: 102,
    cycle: VORTEX_CYCLE,
    delay: -49,
    rotate: 7,
    staticX: 56,
    staticY: 12,
    parked: false,
  },
];

export const AUTH_VISUAL_SUCCESS_MS = 1550;
export const AUTH_VISUAL_SUCCESS_REDUCED_MS = 400;
export const AUTH_VISUAL_LOGO_PX = 186;
