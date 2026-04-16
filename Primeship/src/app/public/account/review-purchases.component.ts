import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import { OrderService } from '../../core/services/order.service';

type ReviewDraft = { rating: number; comment: string };

interface ReviewablePurchaseItem {
  key: string;
  productId?: string;
  sku?: string;
  name: string;
  image?: string;
  categoryId?: string;
  categorySlug?: string;
  categoryName?: string;
  orderRef?: string;
  orderDate?: Date;
  status?: string;
  price?: number;
  qty?: number;
}

@Component({
  selector: 'app-review-purchases',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './review-purchases.component.html',
  styleUrls: ['./review-purchases.component.scss']
})
export class ReviewPurchasesComponent implements OnInit {
  isLoading = true;
  items: ReviewablePurchaseItem[] = [];
  drafts: Record<string, ReviewDraft> = {};
  saved: Record<string, ReviewDraft & { createdAt: string }> = {};

  private readonly storageKey = 'purchaseItemReviews';

  constructor(
    private orderService: OrderService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.saved = this.loadSaved();
    this.loadReviewables();
  }

  private loadSaved(): Record<string, ReviewDraft & { createdAt: string }> {
    try {
      const raw = localStorage.getItem(this.storageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private persistSaved(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.saved));
    } catch {
      // ignore
    }
  }

  private loadReviewables(): void {
    this.isLoading = true;

    this.orderService.getOrders().subscribe({
      next: (orders: any[]) => {
        const flattened = this.flattenOrders(orders);
        this.items = flattened.length > 0 ? flattened : this.fallbackItems();
        this.initDrafts();
        this.isLoading = false;
      },
      error: () => {
        this.items = this.fallbackItems();
        this.initDrafts();
        this.isLoading = false;
      }
    });
  }

  private flattenOrders(orders: any[]): ReviewablePurchaseItem[] {
    const list = Array.isArray(orders) ? orders : [];
    const all: ReviewablePurchaseItem[] = [];

    for (const o of list) {
      const status = String(o?.status || '').toLowerCase();
      const isDelivered = status === 'delivered';
      if (!isDelivered) continue;

      const orderRef = o?.referenceCode || o?.orderNo || o?.orderNumber;
      const orderDate = o?.creationTime ? new Date(o.creationTime) : (o?.orderDate ? new Date(o.orderDate) : undefined);
      const items = Array.isArray(o?.items) ? o.items : [];

      for (const it of items) {
        const name = it?.product?.name || it?.productName || it?.name || 'Item';
        const productId = it?.product?.id || it?.productId || it?.storeProductId;
        const sku = it?.sku || it?.product?.sku;
        const image = it?.product?.image || it?.imageUrl || it?.image;
        const categoryId = it?.product?.categoryId || it?.categoryId;
        const categoryName = it?.product?.categoryName || it?.categoryName || it?.product?.category || it?.category;
        const categorySlug = categoryName ? String(categoryName).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '';
        const price = Number(it?.price ?? it?.product?.price);
        const qty = Number(it?.qty ?? it?.quantity ?? 1);
        const key = String(productId || sku || `${orderRef || ''}-${name}`).trim();

        all.push({
          key,
          productId: productId ? String(productId) : undefined,
          sku: sku ? String(sku) : undefined,
          name: String(name),
          image: image ? String(image) : undefined,
          categoryId: categoryId ? String(categoryId) : undefined,
          categorySlug: categorySlug || undefined,
          categoryName: categoryName ? String(categoryName) : undefined,
          orderRef: orderRef ? String(orderRef) : undefined,
          orderDate,
          status,
          price: Number.isFinite(price) ? price : undefined,
          qty: Number.isFinite(qty) ? qty : 1
        });
      }
    }

    return all;
  }

  private fallbackItems(): ReviewablePurchaseItem[] {
    return [
      {
        key: 'demo-prod-1',
        productId: 'demo-prod-1',
        name: 'Premium Wireless Headphones',
        image: 'https://via.placeholder.com/100',
        orderRef: 'ORD-001',
        orderDate: new Date('2024-01-15'),
        status: 'delivered',
        price: 299,
        qty: 1
      },
      {
        key: 'demo-prod-2',
        productId: 'demo-prod-2',
        name: 'Smart Watch',
        image: 'https://via.placeholder.com/100',
        orderRef: 'ORD-001',
        orderDate: new Date('2024-01-15'),
        status: 'delivered',
        price: 199,
        qty: 1
      }
    ];
  }

  private initDrafts(): void {
    for (const item of this.items) {
      if (!item?.key) continue;
      if (this.drafts[item.key]) continue;
      const saved = this.saved[item.key];
      this.drafts[item.key] = { rating: saved?.rating || 0, comment: saved?.comment || '' };
    }
  }

  setRating(item: ReviewablePurchaseItem, rating: number): void {
    const draft = this.drafts[item.key] || { rating: 0, comment: '' };
    this.drafts[item.key] = draft;
    draft.rating = rating;
  }

  async save(item: ReviewablePurchaseItem): Promise<void> {
    const draft = this.drafts[item.key] || { rating: 0, comment: '' };
    this.drafts[item.key] = draft;
    if (!draft.rating) {
      await Swal.fire({ title: 'Select rating', text: 'Please select a rating first.', icon: 'info' });
      return;
    }
    this.saved[item.key] = { rating: draft.rating, comment: (draft.comment || '').trim(), createdAt: new Date().toISOString() };
    this.persistSaved();
    await Swal.fire({ title: 'Saved', text: 'Your review was saved.', icon: 'success' });
  }

  async remove(item: ReviewablePurchaseItem): Promise<void> {
    const res = await Swal.fire({ title: 'Remove review?', text: 'This will delete your saved review.', icon: 'warning', showCancelButton: true, confirmButtonText: 'Delete' });
    if (!res.isConfirmed) return;
    delete this.saved[item.key];
    this.persistSaved();
    await Swal.fire({ title: 'Deleted', text: 'Review removed.', icon: 'success' });
  }

  openProduct(item: ReviewablePurchaseItem): void {
    const routeSlug = this.getProductRoute(item);
    const queryParams: Record<string, string> = {};

    if (item.productId) {
      queryParams['id'] = String(item.productId);
    }
    if (item.sku) {
      queryParams['sku'] = String(item.sku);
    }

    if (routeSlug) {
      this.router.navigate(['/product', routeSlug], { queryParams });
      return;
    }

    this.router.navigate(['/shop']);
  }

  private getProductRoute(item: ReviewablePurchaseItem): string {
    const raw = (item.name || item.sku || item.productId || '').toString().trim();
    if (!raw) {
      return '';
    }

    return raw
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
