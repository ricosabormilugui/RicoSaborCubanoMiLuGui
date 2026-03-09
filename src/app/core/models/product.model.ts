export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'combos' | 'platos' | 'bebidas' | 'extras';
  imageUrl: string;
  available: boolean;
}
