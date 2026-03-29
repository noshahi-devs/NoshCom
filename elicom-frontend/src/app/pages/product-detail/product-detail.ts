import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Breadcrumb } from '../../shared/breadcrumb/breadcrumb';
import { ProductGallery } from '../../shared/components/product-gallery/product-gallery';
import { ProductInfo } from '../../shared/components/product-info/product-info';
import { ProductService, ProductDetailDto, ProductCardDto } from '../../services/product';
import { environment } from '../../../environments/environment';
import { SmartPricePipe } from '../../shared/pipes/smart-price.pipe';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    Breadcrumb,
    SmartPricePipe,
    ProductGallery,
    ProductInfo
  ],
  templateUrl: './product-detail.html',
  styleUrls: ['./product-detail.scss']
})
export class ProductDetail implements OnInit {

  productData?: ProductDetailDto | null;
  breadcrumbItems: string[] = ['Home'];
  isLoading = true;
  errorHappened = false;
  relatedProductsLoading = false;
  relatedProducts: ProductCardDto[] = [];
  relatedVisibleCount = 20;
  relatedSkeletonCards = Array.from({ length: 10 });
  favoriteKeys = new Set<string>();
  burstingFavoriteKeys = new Set<string>();

  constructor(
    private route: ActivatedRoute,
    private productService: ProductService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    console.log('ProductDetail: Component Initialized');
    this.route.params.subscribe(params => {
      const productId = params['productId'];
      const storeProductId = params['storeProductId'];
      console.log('ProductDetail Route Params:', params);
      if (productId && storeProductId) {
        this.loadProductDetail(productId, storeProductId);
      } else {
        this.isLoading = false;
        this.errorHappened = true;
      }
    });
  }

  loadProductDetail(productId: string, storeProductId: string) {
    this.isLoading = true;
    this.errorHappened = false;
    this.productService.getProductDetail(productId, storeProductId).subscribe({
      next: (res) => {
        console.log('ProductDetail Receive Result:', res);
        this.productData = res;
        if (this.productData) {
          this.productData.storeProductId = storeProductId;
          this.loadRelatedProducts();
        }
        this.isLoading = false;
        if (res) {
          this.breadcrumbItems = ['Home', res.category?.name || 'Category', res.title];
        } else {
          this.errorHappened = true;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching product details', err);
        this.isLoading = false;
        this.errorHappened = true;
        this.cdr.detectChanges();
      }
    });
  }

  loadRelatedProducts() {
    if (!this.productData) return;

    this.relatedProductsLoading = true;
    const categoryId = this.productData.category?.categoryId;
    const categoryName = (this.productData.category?.name || '').toLowerCase();
    const currentStoreProductId = this.productData.storeProductId;
    const currentProductId = this.productData.productId;

    this.productService.getProductsForCards(0, 200).subscribe({
      next: (res) => {
        if (!this.productData) return;
        const currentTitle = (this.productData.title || '').trim().toLowerCase();
        const seenTitles = new Set<string>();
        seenTitles.add(currentTitle);
        const items = Array.isArray(res?.items) ? res.items : [];

        this.relatedProducts = [];
        const filtered = items.filter((item) => {
          const itemTitle = (item.title || item.productName || '').trim().toLowerCase();

          // 1. Same category constraint
          const sameCategory =
            (!!categoryId && item.categoryId === categoryId) ||
            (!!categoryName && (item.categoryName || '').toLowerCase() === categoryName);

          // 2. Identity constraint
          const notCurrent =
            item.storeProductId !== currentStoreProductId &&
            item.productId !== currentProductId &&
            itemTitle !== currentTitle;

          // 3. Uniqueness constraint
          const isUnique = !seenTitles.has(itemTitle);

          if (sameCategory && notCurrent && isUnique) {
            seenTitles.add(itemTitle);
            return true;
          }
          return false;
        });
        
        this.relatedProducts = filtered;
        this.relatedProductsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.relatedProducts = [];
        this.relatedProductsLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  showMoreRelatedProducts() {
    this.relatedVisibleCount += 10;
  }

  get visibleRelatedProducts(): ProductCardDto[] {
    return this.relatedProducts.slice(0, this.relatedVisibleCount);
  }

  get hasMoreRelatedProducts(): boolean {
    return this.relatedProducts.length > this.relatedVisibleCount;
  }

  getRelatedCardsPerRow(): number {
    if (typeof window === 'undefined') {
      return 5;
    }

    const width = window.innerWidth;
    if (width <= 768) {
      return 2;
    }

    if (width <= 1200) {
      return 3;
    }

    return 5;
  }

  getRelatedRowIndex(index: number): number {
    return Math.floor(index / this.getRelatedCardsPerRow());
  }

  isRelatedRowFromLeft(index: number): boolean {
    return this.getRelatedRowIndex(index) % 2 === 0;
  }

  getRelatedAnimationDelay(index: number): string {
    const perRow = this.getRelatedCardsPerRow();
    const rowIndex = this.getRelatedRowIndex(index);
    const columnIndex = index % perRow;
    const inRowOrder = this.isRelatedRowFromLeft(index)
      ? columnIndex
      : Math.max(0, perRow - columnIndex - 1);

    const delayMs = rowIndex * 160 + inRowOrder * 140;
    return `${delayMs}ms`;
  }

  isFavorite(product: any): boolean {
    return this.favoriteKeys.has(this.getProductKey(product));
  }

  isHeartBursting(product: any): boolean {
    return this.burstingFavoriteKeys.has(this.getProductKey(product));
  }

  toggleFavorite(event: Event, product: any): void {
    event.preventDefault();
    event.stopPropagation();

    const key = this.getProductKey(product);
    const willBeFavorite = !this.favoriteKeys.has(key);

    if (willBeFavorite) {
      this.favoriteKeys.add(key);
      this.burstingFavoriteKeys.add(key);
      window.setTimeout(() => {
        this.burstingFavoriteKeys.delete(key);
        this.cdr.detectChanges();
      }, 900);
    } else {
      this.favoriteKeys.delete(key);
      this.burstingFavoriteKeys.delete(key);
    }

    this.cdr.detectChanges();
  }

  getHeartBurstPieces(): number[] {
    return [1, 2, 3, 4, 5, 6];
  }

  getTitle(product: any): string {
    return (product.title || product.productName || product.name || 'Untitled Product').toString().trim();
  }

  getImage(product: any): string {
    let val = product.image1 || product.productImage || product.imageUrl || product.image2;

    if (!val || val === 'string' || val.trim() === '') {
      const seed = product.id || product.productId || 'p';
      return `https://picsum.photos/seed/${seed}/400/520`;
    }

    if (typeof val === 'string') {
      const urls = val.match(/https?:\/\/[^\s"'\\]+/g);
      if (urls && urls.length) {
        val = urls[0];
      }
      val = val.replace(/^\["/, '').replace(/"\]$/, '').replace(/^"/, '').replace(/"$/, '').replace(/\\"/g, '');
      if (val.includes('","')) {
        val = val.split('","')[0];
      } else if (val.includes(',')) {
        val = val.split(',')[0];
      }
    }

    val = val ? val.trim() : '';
    if (!val) {
      const seed = product.id || product.productId || 'p';
      return `https://picsum.photos/seed/${seed}/400/520`;
    }

    if (val.startsWith('http')) return val;
    return `${(environment as any).apiUrl}/${val.startsWith('/') ? val.substring(1) : val}`;
  }

  onImgError(event: Event, product: any) {
    const target = event.target as HTMLImageElement;
    if (!target) return;
    const seed = product?.id || product?.productId || 'fallback';
    target.src = `https://picsum.photos/seed/${seed}/400/520`;
  }

  getDiscountPercent(product: any): number {
    const direct = Number(product.resellerDiscountPercentage || 0);
    if (direct > 0) return Math.round(direct);
    const original = Number(product.originalPrice || 0);
    const price = Number(product.price || 0);
    if (original > price && original > 0) {
      return Math.round(((original - price) / original) * 100);
    }
    return 0;
  }

  getRating(product: any): number {
    const seed = this.hashSeed((product.storeProductId || product.productId || this.getTitle(product)).toString());
    return 3.8 + (seed % 12) / 10;
  }

  getReviewCount(product: any): number {
    const seed = this.hashSeed((product.storeProductId || product.productId || this.getTitle(product)).toString());
    return 120 + (seed % 4800);
  }

  getPromoLabel(product: any): string | null {
    const seed = this.hashSeed((product.storeProductId || product.productId || this.getTitle(product)).toString());
    const promoIndex = seed % 5;
    if (promoIndex === 0) return null;
    if (promoIndex === 1) return 'New';
    if (promoIndex === 2) return 'Limited';
    if (promoIndex === 3) return 'Almost Sold Out';
    return this.getDiscountPercent(product) > 0 ? `Sale -${this.getDiscountPercent(product)}%` : 'Best Pick';
  }

  private getProductKey(product: any): string {
    return ((product.storeProductId || product.id || product.productId || this.getTitle(product)) as string).toString();
  }

  private hashSeed(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

}
