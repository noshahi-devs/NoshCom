import { Component, Input, OnChanges, SimpleChanges, OnInit, ChangeDetectorRef, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ProductService, ProductCardDto } from '../../../services/product';
import { CartService } from '../../../services/cart.service';
import Swal from 'sweetalert2';
import { environment } from '../../../../environments/environment';
import { SmartPricePipe } from '../../pipes/smart-price.pipe';

@Component({
  selector: 'app-product-grid-new',
  standalone: true,
  imports: [CommonModule, RouterModule, SmartPricePipe],
  templateUrl: './product-grid.html',
  styleUrls: ['./product-grid.scss']
})
export class ProductGridComponent implements OnInit, OnChanges {
  @Input() filterData: any = {};
  @Input() products: any[] | null = null;
  @Input() visibleCountOverride: number | null = null;
  @Output() productsLoaded = new EventEmitter<any[]>();

  allProducts: ProductCardDto[] = [];
  visibleProducts: ProductCardDto[] = [];
  filteredProductsCount = 0;
  isLoading = false;
  isLoadingMore = false;
  skeletonItems = Array.from({ length: 10 });
  favoriteKeys = new Set<string>();
  burstingFavoriteKeys = new Set<string>();

  private readonly initialVisibleCount = 15; // 3 rows x 5 columns
  private readonly viewMoreStep = 10; // 2 rows x 5 columns
  private readonly pageSize = 20;
  private skipCount = 0;
  private totalCount = 0;
  visibleCount = this.initialVisibleCount;

  constructor(
    private productService: ProductService,
    private cdr: ChangeDetectorRef,
    private cartService: CartService // Inject
  ) { }

  ngOnInit() {
    if (this.visibleCountOverride) this.visibleCount = this.visibleCountOverride;

    if (this.products && this.products.length > 0) {
      this.allProducts = this.products;
      this.totalCount = this.products.length;
      this.applyFilters();
      this.isLoading = false;
    } else {
      this.loadProducts();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['products'] && this.products) {
      this.allProducts = this.products;
      this.totalCount = this.products.length;
      this.applyFilters();
    }
    if (changes['filterData']) {
      if (!this.visibleCountOverride) {
        this.visibleCount = this.initialVisibleCount;
      }
      this.applyFilters();
      this.ensureEnoughFilteredProducts();
    }
  }

  loadProducts() {
    if (this.products && this.products.length > 0) return;

    this.isLoading = true;
    this.skipCount = 0;
    this.totalCount = 0;
    this.allProducts = [];

    this.productService.getProductsForCards(this.skipCount, this.pageSize).subscribe({
      next: (res: any) => {
        const items = this.extractItems(res);
        this.totalCount = this.extractTotalCount(res, items.length);
        this.skipCount = items.length;
        this.allProducts = items;
        this.productsLoaded.emit(this.allProducts);
        this.applyFilters();
        this.ensureEnoughFilteredProducts();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load products', err);
        this.isLoading = false;
      }
    });
  }

  private loadMoreProducts() {
    if (this.products && this.products.length > 0) return;
    if (this.isLoadingMore || this.skipCount >= this.totalCount) {
      this.applyFilters();
      return;
    }

    this.isLoadingMore = true;

    this.productService.getProductsForCards(this.skipCount, this.pageSize).subscribe({
      next: (res: any) => {
        const items = this.extractItems(res);
        this.totalCount = this.extractTotalCount(res, this.totalCount || this.allProducts.length + items.length);
        this.skipCount += items.length;
        this.allProducts = [...this.allProducts, ...items];
        this.productsLoaded.emit(this.allProducts);
        this.applyFilters();
        this.ensureEnoughFilteredProducts();
        this.isLoadingMore = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load more products', err);
        this.isLoadingMore = false;
        this.applyFilters();
      }
    });
  }

  private extractItems(res: any): ProductCardDto[] {
    if (Array.isArray(res)) {
      return res;
    }

    if (res && Array.isArray(res.items)) {
      return res.items;
    }

    if (res && res.result && Array.isArray(res.result.items)) {
      return res.result.items;
    }

    if (res && Array.isArray(res.result)) {
      return res.result;
    }

    return [];
  }

  private extractTotalCount(res: any, fallback: number): number {
    if (res && typeof res.totalCount === 'number') {
      return res.totalCount;
    }

    if (res && res.result && typeof res.result.totalCount === 'number') {
      return res.result.totalCount;
    }

    return fallback;
  }

  applyFilters() {
    if (!this.allProducts.length) {
      this.filteredProductsCount = 0;
      this.visibleProducts = [];
      return;
    }

    let filtered = [...this.allProducts];

    const normalize = (value: any): string =>
      (value ?? '').toString().toLowerCase().replace(/\s+/g, ' ').trim();

    const matchesTerm = (product: any, rawTerm: string): boolean => {
      const term = normalize(rawTerm);
      if (!term) return true;

      const searchableFields = [
        product.categoryName,
        product.title,
        product.productName,
        product.name,
        product.storeName,
        product.sellerName,
        product.shopName,
        product.store
      ];

      return searchableFields.some(field => normalize(field).includes(term));
    };

    // 1. Category Filter (Strict or fuzzy)
    if (this.filterData.category) {
      filtered = filtered.filter(p => matchesTerm(p, this.filterData.category));
    }

    // 1b. Free text search (header search: q=...)
    if (this.filterData.search) {
      filtered = filtered.filter(p => matchesTerm(p, this.filterData.search));
    }

    // 2. Custom Filters (Size, Color, etc. from sidebar chips)
    if (this.filterData.filters && this.filterData.filters.length > 0) {
      this.filterData.filters.forEach((f: string) => {
        const lowF = f.toLowerCase();
        if (lowF.startsWith('price:')) return; // handled separately

        // Check if it's a color or size match
        filtered = filtered.filter(p =>
          ((p as any).color && (p as any).color.toLowerCase() === lowF) ||
          ((p as any).size && (p as any).size.toLowerCase() === lowF) ||
          (p.categoryName && p.categoryName.toLowerCase() === lowF)
        );
      });
    }

    // 3. Price Filter
    if (this.filterData.price) {
      // Only filter if price range is explicitly set/changed from default
      // The default max is 6062, so if max is less, we filter.
      if (this.filterData.price.max < 6062 || this.filterData.price.min > 0) {
        filtered = filtered.filter(p => p.price >= this.filterData.price.min && p.price <= this.filterData.price.max);
      }
    }

    // 4. Sort
    if (this.filterData.sort) {
      if (this.filterData.sort === 'price-low') {
        filtered.sort((a, b) => a.price - b.price);
      } else if (this.filterData.sort === 'price-high') {
        filtered.sort((a, b) => b.price - a.price);
      } else if (this.filterData.sort === 'newest') {
        // Assuming there is a date field, or just by ID roughly if incremental
        // If no date field, we might skip or use randomness/mock
        // filtered.sort((a: any, b: any) => new Date(b.creationTime).getTime() - new Date(a.creationTime).getTime());
      }
    }

    filtered = this.mixByTitle(filtered);
    this.filteredProductsCount = filtered.length;
    this.visibleProducts = filtered.slice(0, this.visibleCount);
  }

  get showViewMore(): boolean {
    if (this.filteredProductsCount === 0) {
      return false;
    }

    return this.visibleProducts.length < this.filteredProductsCount || this.skipCount < this.totalCount;
  }

  viewMore() {
    this.visibleCount += this.viewMoreStep;

    if (!this.products && this.visibleCount > this.allProducts.length && this.skipCount < this.totalCount) {
      this.loadMoreProducts();
      return;
    }

    this.applyFilters();
    this.ensureEnoughFilteredProducts();
  }

  private ensureEnoughFilteredProducts(): void {
    if (this.visibleCountOverride || this.products) {
      return;
    }

    if (this.filteredProductsCount >= this.visibleCount || this.skipCount >= this.totalCount || this.isLoading || this.isLoadingMore) {
      return;
    }

    this.loadMoreProducts();
  }

  getFirstImage(product: any): string {
    // 1. Get raw value from one of the possible fields
    let val = product.image1 || product.productImage || product.imageUrl || product.image2;

    // 2. Initial cleanup
    if (!val || val === 'string' || val.trim() === '') {
      return `https://picsum.photos/seed/${product.id || product.productId || 'p'}/300/400`;
    }

    // NEW: Handle malformed JSON array strings or extra quotes like "[\"url\"" or "\"url\""
    if (typeof val === 'string') {
      // Remove known artifacts
      val = val.replace(/^\["/, '').replace(/"\]$/, '').replace(/^"/, '').replace(/"$/, '').replace(/\\"/g, '');

      // If it was a clean JSON array string like '["url1", "url2"]', we might need to split
      if (val.includes('","')) {
        val = val.split('","')[0];
      } else if (val.includes(',')) {
        val = val.split(',')[0];
      }
    }

    val = val ? val.trim() : '';
    if (!val) return 'assets/images/card_1.jpg'; // Ultimate fallback

    // 4. Broken CDN or Missing File Fix (MUST BE BEFORE http CHECK)
    if (val.includes('cdn.elicom.com') || val.includes('hair.png')) {
      const seed = val.split('/').pop() || (this.getTitle(product));
      return `https://picsum.photos/seed/${seed}/300/400`;
    }

    // 5. Absolute vs Relative
    if (val.startsWith('http')) return val;

    // 6. Prepend Base URL logic fixed
    const baseUrl = environment.apiUrl;

    // Remove leading slash if present
    if (val.startsWith('/')) {
      val = val.substring(1);
    }

    return `${baseUrl}/${val}`;
  }

  getSecondImage(product: any): string | null {
    let val = null;

    // source selection
    if (product.image2 && product.image2 !== product.image1) {
      val = product.image2;
    } else if (product.images && Array.isArray(product.images) && product.images.length > 1) {
      val = product.images[1];
    } else {
      // Check if primary field has multiple comma-separated
      const primary = product.image1 || product.productImage || product.imageUrl;

      // NEW: Handle JSON string logic for second image
      let cleanPrimary = primary;
      if (typeof cleanPrimary === 'string') {
        cleanPrimary = cleanPrimary.replace(/^\["/, '').replace(/"\]$/, '').replace(/^"/, '').replace(/"$/, '').replace(/\\"/g, '');
        if (cleanPrimary.includes('","')) {
          const parts = cleanPrimary.split('","');
          if (parts.length > 1) val = parts[1];
        } else if (cleanPrimary.includes(',')) {
          const parts = cleanPrimary.split(',');
          if (parts.length > 1) val = parts[1];
        }
      }
    }

    if (!val || typeof val !== 'string') return null;

    // cleanup
    val = val.replace(/^\["/, '').replace(/"\]$/, '').replace(/^"/, '').replace(/"$/, '').replace(/\\"/g, '');
    if (val.includes(',')) val = val.split(',')[0].trim();

    // Broken CDN or Missing File Fix
    if (val.includes('cdn.elicom.com') || val.includes('hair.png')) {
      const seed = val.split('/').pop() || 'p2';
      return `https://picsum.photos/seed/${seed}/300/400`;
    }

    if (val.startsWith('http')) return val;

    const baseUrl = environment.apiUrl;

    // Remove leading slash if present
    if (val.startsWith('/')) {
      val = val.substring(1);
    }

    return `${baseUrl}/${val}`;
  }

  getTitle(product: any): string {
    const t = product.title || product.productName || product.name || 'Untitled Product';
    return t.trim();
  }

  private shuffle<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  private normalizeTitleKey(product: any): string {
    return this.getTitle(product)
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private mixByTitle(items: ProductCardDto[]): ProductCardDto[] {
    if (!items || items.length <= 1) return items || [];

    const buckets = new Map<string, ProductCardDto[]>();
    for (const item of items) {
      const key = this.normalizeTitleKey(item);
      if (!buckets.has(key)) {
        buckets.set(key, []);
      }
      buckets.get(key)!.push(item);
    }

    const shuffledBuckets = this.shuffle(
      Array.from(buckets.values()).map(bucket => this.shuffle(bucket))
    );

    const mixed: ProductCardDto[] = [];
    let added = true;

    while (added) {
      added = false;
      for (const bucket of shuffledBuckets) {
        if (bucket.length) {
          mixed.push(bucket.shift() as ProductCardDto);
          added = true;
        }
      }
    }

    return mixed;
  }

  private getKey(product: any): string {
    return (product?.__cloneId || product?.storeProductId || product?.id || product?.productId || this.getTitle(product)) as string;
  }

  getDiscountPercent(product: any): number {
    const direct = Number(product?.resellerDiscountPercentage || 0);
    if (direct > 0) return Math.round(direct);

    const original = Number(product?.originalPrice || 0);
    const price = Number(product?.price || 0);
    if (original > price && original > 0) {
      return Math.round(((original - price) / original) * 100);
    }

    return 0;
  }

  private hashSeed(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = value.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  }

  getRating(product: any): number {
    const seed = this.hashSeed(this.getKey(product));
    return 3.8 + (seed % 12) / 10;
  }

  getReviewCount(product: any): number {
    const seed = this.hashSeed(this.getKey(product));
    return 120 + (seed % 4800);
  }

  getPromoLabel(product: any): string | null {
    const seed = this.hashSeed(this.getKey(product));
    const promoIndex = seed % 5;

    if (promoIndex === 0) return null;
    if (promoIndex === 1) return 'New';
    if (promoIndex === 2) return 'Limited';
    if (promoIndex === 3) return 'Almost Sold Out';

    return this.getDiscountPercent(product) > 0 ? `Sale -${this.getDiscountPercent(product)}%` : 'Best Pick';
  }

  isFavorite(product: any): boolean {
    return this.favoriteKeys.has(this.getKey(product));
  }

  isHeartBursting(product: any): boolean {
    return this.burstingFavoriteKeys.has(this.getKey(product));
  }

  toggleFavorite(event: Event, product: any): void {
    event.preventDefault();
    event.stopPropagation();

    const key = this.getKey(product);
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

  getAnimationDelay(index: number): string {
    return `${Math.min(index, 11) * 70}ms`;
  }

  handleImageError(event: any, product: any, type: string) {
    const title = this.getTitle(product).toLowerCase();
    let fallbackUrl = '';

    // Specific Fallbacks for Known Broken Products or filenames
    if (title.includes('hair remov') || (product.imageUrl && product.imageUrl.includes('hair.png'))) {
      fallbackUrl = type === 'main'
        ? 'https://picsum.photos/seed/hair1/300/400'
        : 'https://picsum.photos/seed/hair2/300/400';
    } else if (title.includes('laptop bag')) {
      fallbackUrl = type === 'main'
        ? 'https://picsum.photos/seed/bag1/300/400'
        : 'https://picsum.photos/seed/bag2/300/400';
    } else if (title.includes('women summer floral dress')) {
      fallbackUrl = type === 'main'
        ? 'https://picsum.photos/seed/dress1/300/400'
        : 'https://picsum.photos/seed/dress2/300/400';
    } else {
      // Generic consistent random fallback
      const seed = (product.id || product.productId || title || 'default').toString();
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
      }

      const totalCards = 8;
      const index = Math.abs(hash) % totalCards + 1;

      // For main image
      if (type !== 'hover') {
        fallbackUrl = `assets/images/card_${index}.jpg`;
      } else {
        // For hover, ensure it's different
        const nextIndex = (index % totalCards) + 1;
        fallbackUrl = `assets/images/card_${nextIndex}.jpg`;
      }
    }

    // Prevent infinite loop
    if (event.target.src === fallbackUrl || event.target.src.includes(fallbackUrl)) return;

    event.target.src = fallbackUrl;
  }

  // Add To Cart Logic
  addToCart(product: any, event: Event) {
    event.stopPropagation(); // prevent navigating to detail page

    // For grid, we usually don't have size/color selected, so we might send defaults or null
    // If logic requires size/color, we might need to open a Quick View modal instead.
    // For now assuming we can add base product.

    // Check if auth happens in service
    // We Subscribe to trigger execution
    // Inject CartService first (which I need to add to constructor)
    if (!this.cartService) {
      console.error('CartService not injected');
      return;
    }

    const image = this.getFirstImage(product);

    // ...

    this.cartService.addToCart(product, 1, '', '', image).subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: 'Added to Cart!',
          text: `${this.getTitle(product)} added to your bag.`,
          timer: 2000,
          showConfirmButton: false
        });
      },
      error: (err) => {
        console.error('[ProductGrid] Add to cart failed:', err);
      }
    });
  }
}
