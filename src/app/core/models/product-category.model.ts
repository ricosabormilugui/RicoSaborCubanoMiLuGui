export interface ProductCategoryRecord {
  _id: string;
  slug: string;
  label: string;
  order: number;
  productCount?: number;
}

export interface ProductCategoryPayload {
  label: string;
}
