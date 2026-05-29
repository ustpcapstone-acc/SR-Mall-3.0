export interface StoreProduct {
  id: string;
  name: string;
  description: string;
  price: string;
  image_url: string;
}

export interface DigitalStorefront {
  id: string; // UUID
  shop_name: string; // Official business name
  unit_id: string; // Physical slot (e.g., "L1-105")
  is_open: boolean; // Real-time toggle
  description: string | null; // Rich text "About Us"
  logo_url: string | null; // URL from Supabase Storage
  gallery_urls: string[]; // Array of gallery image URLs
  category?: string; // Store category (e.g., Fashion, Food & Dining)
  products?: StoreProduct[]; // JSON array of products for the storefront
  post_sales?: {id: string; title: string; image_url: string; date: string}[]; // JSON array for Shop Sales posts
  rent_cost?: number; // Monthly rent cost
  avgRating?: number; // Average reputation score
  reviewCount?: number; // Total number of approved reviews
  createdAt?: Date;
  updatedAt?: Date;
}
