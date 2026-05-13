export type ProductCategory = 'combos' | 'platos' | 'tartas' | 'dulces-gourmet' | 'bebidas' | 'extras' | string;

export interface ProductReview {
  author: string;
  rating: number;
  comment: string;
  date?: string;
}

export interface ProductCustomizationOption {
  name: string;
  price?: number;
}

export interface ProductCustomizationOptions {
  themes?: ProductCustomizationOption[];
  colors?: ProductCustomizationOption[];
  sizes?: ProductCustomizationOption[];
  fillings?: ProductCustomizationOption[];
  toppings?: ProductCustomizationOption[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: ProductCategory;
  imageUrl: string;
  images?: string[];
  ingredients?: string[];
  reviews?: ProductReview[];
  customizationOptions?: ProductCustomizationOptions;
  slug?: string;
  available: boolean;
  published: boolean;
  trackStock: boolean;
  stock: number;
  lowStockAlert: number;
  order?: number;
  isBestSeller?: boolean;
  featured?: boolean;
  salesCount?: number;
  soldCount?: number;
}

export interface ProductApiRecord {
  _id: string;
  name: string;
  description?: string;
  price: number;
  category: ProductCategory;
  imageUrl?: string;
  images?: string[];
  ingredients?: string[] | string;
  reviews?: ProductReview[];
  customizationOptions?: ProductCustomizationOptions;
  slug?: string;
  available?: boolean;
  published?: boolean;
  trackStock?: boolean;
  stock?: number;
  lowStockAlert?: number;
  order?: number;
  isBestSeller?: boolean;
  featured?: boolean;
  salesCount?: number;
  soldCount?: number;
}
