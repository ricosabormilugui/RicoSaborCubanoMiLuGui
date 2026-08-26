export type ProductCategory = 'combos' | 'platos' | 'tartas' | 'dulces-gourmet' | 'bebidas' | 'extras' | string;

export interface ProductReview {
  author: string;
  rating: number;
  comment: string;
  date?: string;
}

export interface ProductCustomizationOption {
  id?: string;
  name: string;
  priceModifier?: number;
  /** Campo legado. Los nuevos datos utilizan priceModifier. */
  price?: number;
}

export type ProductCustomizationGroupKey = 'themes' | 'colors' | 'sizes' | 'flavors' | 'fillings' | 'toppings' | 'decorations';
export type ProductCustomizationSelectionType = 'single' | 'multiple';

export interface ProductCustomizationGroupSettings {
  label?: string;
  selectionType?: ProductCustomizationSelectionType;
  required?: boolean;
}

export interface ProductCustomizationOptions {
  themes?: ProductCustomizationOption[];
  colors?: ProductCustomizationOption[];
  sizes?: ProductCustomizationOption[];
  flavors?: ProductCustomizationOption[];
  fillings?: ProductCustomizationOption[];
  toppings?: ProductCustomizationOption[];
  decorations?: ProductCustomizationOption[];
  groupSettings?: Partial<Record<ProductCustomizationGroupKey, ProductCustomizationGroupSettings>>;
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
  minimumQuantity?: number;
  unitLabel?: string;
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
  minimumQuantity?: number;
  unitLabel?: string;
  order?: number;
  isBestSeller?: boolean;
  featured?: boolean;
  salesCount?: number;
  soldCount?: number;
}

export function isProductOrderable(product: Product | null | undefined): boolean {
  if (!product) return false;
  return product.available !== false && (!product.trackStock || Number(product.stock ?? 0) > 0);
}

export function isProductCustomizable(product: Product | null | undefined): boolean {
  if (!product) return false;
  const customizationOptions = product.customizationOptions;
  const hasCustomizationGroups = Boolean(
    customizationOptions && (
      (customizationOptions.themes?.length ?? 0) > 0
      || (customizationOptions.colors?.length ?? 0) > 0
      || (customizationOptions.sizes?.length ?? 0) > 0
      || (customizationOptions.flavors?.length ?? 0) > 0
      || (customizationOptions.fillings?.length ?? 0) > 0
      || (customizationOptions.toppings?.length ?? 0) > 0
      || (customizationOptions.decorations?.length ?? 0) > 0
    )
  );
  if (hasCustomizationGroups) return true;

  const category = String(product.category ?? '').toLowerCase();
  return category.includes('tarta') || category.includes('personaliz');
}
