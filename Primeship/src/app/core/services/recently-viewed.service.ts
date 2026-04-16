import { Injectable } from '@angular/core';

export interface RecentlyViewedItem {
  id: string;
  name: string;
  slug?: string;
  sku?: string;
  image?: string;
  price?: number;
  categoryId?: string;
  categorySlug?: string;
  categoryName?: string;
  viewedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class RecentlyViewedService {
  private readonly storageKey = 'recentlyViewedProducts';
  private readonly maxItems = 20;

  list(): RecentlyViewedItem[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(Boolean) as RecentlyViewedItem[];
    } catch {
      return [];
    }
  }

  add(item: Omit<RecentlyViewedItem, 'viewedAt'>): void {
    if (!item?.id || !item?.name) return;

    const now = new Date().toISOString();
    const nextItem: RecentlyViewedItem = { ...item, viewedAt: now };

    const existing = this.list();
    const deduped = existing.filter(x => x?.id !== item.id);
    const next = [nextItem, ...deduped].slice(0, this.maxItems);

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(next));
    } catch {
      // ignore quota errors
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // ignore
    }
  }
}

