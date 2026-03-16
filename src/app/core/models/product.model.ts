export type ProductCategory = 'combos' | 'platos' | 'bebidas' | 'extras' | string;

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: ProductCategory;
  imageUrl: string;
  available: boolean;
  published: boolean;
  trackStock: boolean;
  stock: number;
  lowStockAlert: number;
  order?: number;
}

export interface ProductApiRecord {
  _id: string;
  name: string;
  description?: string;
  price: number;
  category: ProductCategory;
  imageUrl?: string;
  available?: boolean;
  published?: boolean;
  trackStock?: boolean;
  stock?: number;
  lowStockAlert?: number;
  order?: number;
}
