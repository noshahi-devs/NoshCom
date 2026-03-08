export interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  rating: number;
  reviewCount: number;
  image: string;
  images?: string[];
  inStock: boolean;
  category?: string;
  description?: string;
  fullDescription?: string;
  specifications?: { key: string; value: string }[];
  isFeatured?: boolean;
  isNew?: boolean;
  brand?: string;
  sku?: string;
}
