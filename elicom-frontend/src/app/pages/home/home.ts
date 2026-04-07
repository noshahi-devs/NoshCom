import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HeroCarouselComponent } from '../../shared/components/hero-carousel/hero-carousel';
import { CategoryCarouselComponent } from '../../shared/components/category-carousel/category-carousel';
import { ProductService, ProductCardDto } from '../../services/product';
import { environment } from '../../../environments/environment';
import { CategoryService, Category } from '../../services/category';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { SmartPricePipe } from '../../shared/pipes/smart-price.pipe';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    SmartPricePipe,
    HeroCarouselComponent,
    CategoryCarouselComponent
  ],
  templateUrl: './home.html',
  styleUrls: ['./home.scss']
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('featuresSection') featuresSection?: ElementRef<HTMLElement>;
  @ViewChild('forYouSection') forYouSection?: ElementRef<HTMLElement>;
  @ViewChild('gallerySection') gallerySection?: ElementRef<HTMLElement>;
  @ViewChild('premiumSection') premiumSection?: ElementRef<HTMLElement>;
  @ViewChildren('forYouCard') forYouCards?: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('galleryCard') galleryCards?: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('premiumCard') premiumCards?: QueryList<ElementRef<HTMLElement>>;

  featuresInView = false;
  forYouVisibleRows = new Set<number>();
  galleryVisibleRows = new Set<number>();
  premiumVisibleRows = new Set<number>();
  private featuresObserver?: IntersectionObserver;
  private forYouObserver?: IntersectionObserver;
  private galleryObserver?: IntersectionObserver;
  private premiumObserver?: IntersectionObserver;
  favoriteKeys = new Set<string>();
  burstingFavoriteKeys = new Set<string>();

  products: ProductCardDto[] = [];
  sections: {
    id: string;
    title: string;
    subtitle: string;
    badge: string;
    tone: 'warm' | 'cool' | 'deal' | 'neutral';
    style: 'premium' | 'compact' | 'horizontal' | 'carousel' | 'forYou' | 'gallery';
    products: ProductCardDto[];
    initialCount?: number;
  }[] = [];
  sectionVisible: Record<string, number> = {};

  bestSellers: ProductCardDto[] = [];
  popularApparel: ProductCardDto[] = [];
  deals: ProductCardDto[] = [];
  bestBooks: ProductCardDto[] = [];
  categories: any[] = [];
  productError: string = '';
  categoryError: string = '';
  isLoadingCategories: boolean = false;
  isLoadingProducts: boolean = false;

  constructor(
    private productService: ProductService,
    private categoryService: CategoryService,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadProducts();
    this.loadCategories();
  }

  ngAfterViewInit(): void {
    if (this.featuresSection?.nativeElement) {
      this.updateFeaturesInView();

      this.featuresObserver = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (!entry) {
            return;
          }

          this.featuresInView = entry.isIntersecting;
          this.cdr.detectChanges();
        },
        {
          threshold: 0.08,
          rootMargin: '0px 0px -8% 0px',
        }
      );

      this.featuresObserver.observe(this.featuresSection.nativeElement);
    }

    if (this.forYouSection?.nativeElement) {
      this.updateForYouVisibleRows();

      this.forYouObserver = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (!entry) {
            return;
          }

          if (entry.isIntersecting) {
            this.updateForYouVisibleRows();
          }
          this.cdr.detectChanges();
        },
        {
          threshold: 0.08,
          rootMargin: '0px 0px -10% 0px',
        }
      );

      this.forYouObserver.observe(this.forYouSection.nativeElement);
    }

    if (this.gallerySection?.nativeElement) {
      this.updateGalleryVisibleRows();

      this.galleryObserver = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (!entry) {
            return;
          }

          if (entry.isIntersecting) {
            this.updateGalleryVisibleRows();
          }
          this.cdr.detectChanges();
        },
        {
          threshold: 0.08,
          rootMargin: '0px 0px -10% 0px',
        }
      );

      this.galleryObserver.observe(this.gallerySection.nativeElement);
    }

    if (this.premiumSection?.nativeElement) {
      this.updatePremiumVisibleRows();

      this.premiumObserver = new IntersectionObserver(
        (entries) => {
          const [entry] = entries;
          if (!entry) {
            return;
          }

          if (entry.isIntersecting) {
            this.updatePremiumVisibleRows();
          }
          this.cdr.detectChanges();
        },
        {
          threshold: 0.08,
          rootMargin: '0px 0px -10% 0px',
        }
      );

      this.premiumObserver.observe(this.premiumSection.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.featuresObserver?.disconnect();
    this.forYouObserver?.disconnect();
    this.galleryObserver?.disconnect();
    this.premiumObserver?.disconnect();
  }

  @HostListener('window:scroll')
  @HostListener('window:resize')
  onViewportChange(): void {
    this.updateFeaturesInView();
    this.updateForYouVisibleRows();
    this.updateGalleryVisibleRows();
    this.updatePremiumVisibleRows();
  }

  private updateFeaturesInView(): void {
    const element = this.featuresSection?.nativeElement;
    if (!element) {
      return;
    }

    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const isVisible = rect.top < viewportHeight * 0.9 && rect.bottom > viewportHeight * 0.15;

    if (this.featuresInView !== isVisible) {
      this.featuresInView = isVisible;
      this.cdr.detectChanges();
    }
  }

  private updateForYouVisibleRows(): void {
    const cards = this.forYouCards?.toArray() ?? [];
    if (!cards.length) {
      return;
    }

    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const nextVisibleRows = new Set<number>();

    cards.forEach((cardRef, index) => {
      const rect = cardRef.nativeElement.getBoundingClientRect();
      const rowIndex = this.getForYouRowIndex(index);
      const isVisible = rect.top < viewportHeight * 0.88 && rect.bottom > viewportHeight * 0.2;

      if (isVisible) {
        nextVisibleRows.add(rowIndex);
      }
    });

    const mergedVisibleRows = new Set([...this.forYouVisibleRows, ...nextVisibleRows]);
    const hasChanged =
      mergedVisibleRows.size !== this.forYouVisibleRows.size ||
      [...mergedVisibleRows].some((row) => !this.forYouVisibleRows.has(row));

    if (hasChanged) {
      this.forYouVisibleRows = mergedVisibleRows;
      this.cdr.detectChanges();
    }
  }

  private updateGalleryVisibleRows(): void {
    const cards = this.galleryCards?.toArray() ?? [];
    if (!cards.length) {
      return;
    }

    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const nextVisibleRows = new Set<number>();

    cards.forEach((cardRef, index) => {
      const rect = cardRef.nativeElement.getBoundingClientRect();
      const rowIndex = this.getGalleryRowIndex(index);
      const isVisible = rect.top < viewportHeight * 0.88 && rect.bottom > viewportHeight * 0.2;

      if (isVisible) {
        nextVisibleRows.add(rowIndex);
      }
    });

    const mergedVisibleRows = new Set([...this.galleryVisibleRows, ...nextVisibleRows]);
    const hasChanged =
      mergedVisibleRows.size !== this.galleryVisibleRows.size ||
      [...mergedVisibleRows].some((row) => !this.galleryVisibleRows.has(row));

    if (hasChanged) {
      this.galleryVisibleRows = mergedVisibleRows;
      this.cdr.detectChanges();
    }
  }

  private updatePremiumVisibleRows(): void {
    const cards = this.premiumCards?.toArray() ?? [];
    if (!cards.length) {
      return;
    }

    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const nextVisibleRows = new Set<number>();

    cards.forEach((cardRef, index) => {
      const rect = cardRef.nativeElement.getBoundingClientRect();
      const rowIndex = this.getPremiumRowIndex(index);
      const isVisible = rect.top < viewportHeight * 0.88 && rect.bottom > viewportHeight * 0.2;

      if (isVisible) {
        nextVisibleRows.add(rowIndex);
      }
    });

    const mergedVisibleRows = new Set([...this.premiumVisibleRows, ...nextVisibleRows]);
    const hasChanged =
      mergedVisibleRows.size !== this.premiumVisibleRows.size ||
      [...mergedVisibleRows].some((row) => !this.premiumVisibleRows.has(row));

    if (hasChanged) {
      this.premiumVisibleRows = mergedVisibleRows;
      this.cdr.detectChanges();
    }
  }

  loadProducts() {
    this.isLoadingProducts = true;
    this.productError = '';

    console.log('HomeComponent: Loading products...');
    this.productService.getProductsForCards(0, 200).subscribe({
      next: (res: any) => {
        this.isLoadingProducts = false;
        let items: any[] = [];
        if (Array.isArray(res)) items = res;
        else if (res && Array.isArray(res.items)) items = res.items;
        else if (res && Array.isArray(res.result)) items = res.result;

        console.log('HomeComponent: Products received:', items.length);
        const mixedItems = this.mixByCategory(items);
        this.products = mixedItems;
        this.buildSections(mixedItems);
        this.assignPreviewImages();
        this.cdr.detectChanges();
        window.setTimeout(() => this.updateForYouVisibleRows(), 0);
        window.setTimeout(() => this.updateGalleryVisibleRows(), 0);
        window.setTimeout(() => this.updatePremiumVisibleRows(), 0);
      },
      error: (err: any) => {
        this.isLoadingProducts = false;
        console.error('HomeComponent: Products error:', err);
        this.productError = this.extractErrorMessage(err, 'Failed to load products');
        this.cdr.detectChanges();
      }
    });
  }

  loadCategories() {
    this.isLoadingCategories = true;
    this.categoryError = '';
    console.log('HomeComponent: Triggering robust category load...');
    this.categoryService.getAllCategories(30).subscribe({
      next: (res: any[]) => {
        this.isLoadingCategories = false;
        console.log('HomeComponent: Categories arrived reliably. Count:', res.length);
        this.categories = this.shuffle(res);
        console.log(`[DEBUG] Home Shuffle: First category is "${this.categories[0]?.name}" at ${new Date().toLocaleTimeString()}`);
        this.assignPreviewImages();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoadingCategories = false;
        console.error('HomeComponent: Critical category load failure', err);
        this.categoryError = this.extractErrorMessage(err, 'Failed to load categories');
        this.cdr.detectChanges();
      }
    });
  }

  private extractErrorMessage(err: any, defaultMsg: string): string {
    if (err.error?.error?.message) {
      return err.error.error.message;
    }
    if (err.error?.message) {
      return err.error.message;
    }
    if (err.statusText) {
      return `Server Error: ${err.statusText} (${err.status})`;
    }
    return defaultMsg;
  }

  private buildSections(items: ProductCardDto[]) {
    const baseItems = this.expandItems(items, 80);
    const pool = [...baseItems];

    const take = (source: ProductCardDto[], count: number) => {
      const picked = source.slice(0, count);
      const pickedIds = new Set(picked.map(p => this.getKey(p)));
      // remove picked from pool
      for (let i = pool.length - 1; i >= 0; i--) {
        if (pickedIds.has(this.getKey(pool[i]))) {
          pool.splice(i, 1);
        }
      }
      return picked;
    };

    const shuffle = (arr: ProductCardDto[]) => this.shuffle(arr);

    const discountedSource = baseItems.filter(p =>
      (p as any).resellerDiscountPercentage > 0 ||
      ((p as any).originalPrice && (p as any).originalPrice > (p as any).price)
    );

    const discounted = take(discountedSource, 36);
    const topProducts = take(this.mixByCategory(pool), 24);
    const forYou = take(shuffle(pool), 32);
    const trending = take(shuffle(pool), 24);
    const freshFinds = take(shuffle(pool), 24);

    const fallbackFromBase = (count: number) => shuffle(baseItems).slice(0, count);

    const ensure = (list: ProductCardDto[], fallbackCount: number) => {
      if (list.length > 0) return list;
      const fallback = take(shuffle(pool), fallbackCount);
      return fallback.length ? fallback : fallbackFromBase(fallbackCount);
    };

    this.bestSellers = topProducts.slice(0, 8);
    this.popularApparel = this.pickByCategory(baseItems, ['fashion', 'apparel', 'clothing', 'men', 'women'], 8);
    this.deals = discounted.slice(0, 8);
    this.bestBooks = this.pickByCategory(baseItems, ['book', 'books'], 8);

    if (this.bestBooks.length === 0) {
      this.bestBooks = take(shuffle(pool), 8);
    }

    this.sections = [
      {
        id: 'gallery-top',
        title: 'Top Picks Gallery',
        subtitle: 'Curated highlights with a premium showcase feel',
        badge: 'Top Picks',
        tone: 'warm',
        style: 'gallery',
        products: ensure(topProducts, 24),
        initialCount: 15
      },
      {
        id: 'for-you',
        title: 'Just For You',
        subtitle: 'Personalized picks with standout value',
        badge: 'For You',
        tone: 'cool',
        style: 'forYou',
        products: ensure(forYou, 24),
        initialCount: 20
      },
      {
        id: 'hot-drops',
        title: 'Hot Drops Carousel',
        subtitle: 'Fast-moving deals and new arrivals',
        badge: 'Hot Drops',
        tone: 'deal',
        style: 'carousel',
        products: discounted.length ? discounted : ensure(trending, 24),
        initialCount: 0
      },
      {
        id: 'premium-spotlight',
        title: 'Premium Spotlight',
        subtitle: 'Elevated looks, new favorites, and standout brands',
        badge: 'Spotlight',
        tone: 'neutral',
        style: 'premium',
        products: ensure(freshFinds, 24),
        initialCount: 16
      }
    ];

    this.sectionVisible = {};
    this.sections.forEach(s => {
      if (s.initialCount && s.initialCount > 0) {
        this.sectionVisible[s.id] = s.initialCount;
      }
    });
  }

  private assignPreviewImages() {
    if (!this.categories.length || !this.products.length) return;

    this.categories.forEach((cat: any) => {
      const catProducts = this.products.filter(p => 
        p.categoryId === cat.id || 
        p.categoryName?.toLowerCase() === cat.name?.toLowerCase()
      );

      if (catProducts.length > 0) {
        cat.previewImages = this.shuffle(catProducts)
          .slice(0, 4)
          .map(p => this.getImage(p));
      } else {
        cat.previewImages = [];
      }
    });
  }

  private getKey(p: ProductCardDto): string {
    return ((p as any).__cloneId || p.storeProductId || p.id || p.productId || '') as string;
  }

  private shuffle<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  private mixByCategory(items: ProductCardDto[]): ProductCardDto[] {
    if (!items || items.length <= 1) return items || [];

    const buckets = new Map<string, ProductCardDto[]>();
    for (const item of items) {
      const key = (item.categoryId || item.categoryName || 'uncategorized').toString();
      if (!buckets.has(key)) buckets.set(key, []);
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

  private pickByCategory(items: ProductCardDto[], keywords: string[], count: number): ProductCardDto[] {
    const hits = items.filter(p => {
      const name = (p.categoryName || p.title || '').toLowerCase();
      return keywords.some(k => name.includes(k));
    });
    if (hits.length === 0) return [];
    return hits.slice(0, count);
  }

  getTitle(product: any): string {
    return (product.title || product.productName || product.name || 'Untitled Product').toString().trim();
  }

  getImage(product: any): string {
    let val = product.image1 || product.productImage || product.imageUrl || product.image2;

    if (!val || val === 'string' || val.trim() === '') {
      const seed = product.__cloneId || product.id || product.productId || 'p';
      return `https://picsum.photos/seed/${seed}/400/520`;
    }

    if (typeof val === 'string') {
      const urls = val.match(/https?:\/\/[^\s"'\\]+/g);
      if (urls && urls.length) {
        val = urls.find((u) => u.includes('picsum.photos')) || urls[0];
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
      const seed = product.__cloneId || product.id || product.productId || 'p';
      return `https://picsum.photos/seed/${seed}/400/520`;
    }

    if (val.includes('cdn.elicom.com') || val.includes('hair.png')) {
      const seed = val.split('/').pop() || this.getTitle(product);
      return `https://picsum.photos/seed/${seed}/400/520`;
    }

    if (val.startsWith('http')) return val;

    return `${(environment as any).apiUrl}/${val.startsWith('/') ? val.substring(1) : val}`;
  }

  onImgError(event: Event, product: any) {
    const target = event.target as HTMLImageElement;
    if (!target || (target.dataset && target.dataset['fallback'] === '1')) return;
    if (target.dataset) {
      target.dataset['fallback'] = '1';
    }
    const seed = product?.__cloneId || product?.id || product?.productId || 'fallback';
    target.src = `https://picsum.photos/seed/${seed}/400/520`;
  }

  private expandItems(items: ProductCardDto[], minCount: number): ProductCardDto[] {
    if (!items || items.length === 0) return items;
    if (items.length >= minCount) return items;
    const expanded: ProductCardDto[] = [];
    let idx = 0;
    while (expanded.length < minCount) {
      for (const item of items) {
        const clone: any = { ...item, __cloneId: `${this.getKey(item)}_${idx++}` };
        expanded.push(clone);
        if (expanded.length >= minCount) break;
      }
    }
    return expanded;
  }

  scrollCarousel(container: HTMLElement, dir: number) {
    if (!container) return;
    container.scrollBy({ left: dir * 700, behavior: 'smooth' });
  }

  showMore(sectionId: string, step: number = 8) {
    const current = this.sectionVisible[sectionId] || 0;
    this.sectionVisible[sectionId] = current + step;
  }

  getVisibleProducts(section: { id: string; products: ProductCardDto[]; initialCount?: number }) {
    const count = this.sectionVisible[section.id] || section.initialCount || section.products.length;
    return section.products.slice(0, count);
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
    const seed = this.hashSeed(this.getKey(product) || this.getTitle(product));
    return 3.8 + (seed % 12) / 10; // 3.8 - 5.0
  }

  getReviewCount(product: any): number {
    const seed = this.hashSeed(this.getKey(product) || this.getTitle(product));
    return 120 + (seed % 4800);
  }

  getPromoLabel(product: any): string | null {
    const seed = this.hashSeed(this.getKey(product) || this.getTitle(product));
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

  getForYouCardsPerRow(): number {
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

  getGalleryCardsPerRow(): number {
    if (typeof window === 'undefined') {
      return 5;
    }

    const width = window.innerWidth;
    if (width <= 768) {
      return 1;
    }

    if (width <= 1200) {
      return 2;
    }

    return 5;
  }

  getPremiumCardsPerRow(): number {
    if (typeof window === 'undefined') {
      return 4;
    }

    const width = window.innerWidth;
    if (width <= 768) {
      return 2;
    }

    if (width <= 1200) {
      return 3;
    }

    return 4;
  }

  isForYouRowFromLeft(index: number): boolean {
    const rowIndex = this.getForYouRowIndex(index);
    return rowIndex % 2 === 0;
  }

  getForYouAnimationDelay(index: number): string {
    const perRow = this.getForYouCardsPerRow();
    const rowIndex = this.getForYouRowIndex(index);
    const columnIndex = index % perRow;
    const inRowOrder = this.isForYouRowFromLeft(index)
      ? columnIndex
      : Math.max(0, perRow - columnIndex - 1);

    const delayMs = rowIndex * 160 + inRowOrder * 140;
    return `${delayMs}ms`;
  }

  getForYouRowIndex(index: number): number {
    return Math.floor(index / this.getForYouCardsPerRow());
  }

  isForYouRowVisible(index: number): boolean {
    return this.forYouVisibleRows.has(this.getForYouRowIndex(index));
  }

  getGalleryRowIndex(index: number): number {
    return Math.floor(index / this.getGalleryCardsPerRow());
  }

  isGalleryRowFromLeft(index: number): boolean {
    return this.getGalleryRowIndex(index) % 2 === 0;
  }

  getGalleryAnimationDelay(index: number): string {
    const perRow = this.getGalleryCardsPerRow();
    const rowIndex = this.getGalleryRowIndex(index);
    const columnIndex = index % perRow;
    const inRowOrder = this.isGalleryRowFromLeft(index)
      ? columnIndex
      : Math.max(0, perRow - columnIndex - 1);

    const delayMs = rowIndex * 160 + inRowOrder * 140;
    return `${delayMs}ms`;
  }

  isGalleryRowVisible(index: number): boolean {
    return this.galleryVisibleRows.has(this.getGalleryRowIndex(index));
  }

  getPremiumRowIndex(index: number): number {
    return Math.floor(index / this.getPremiumCardsPerRow());
  }

  isPremiumRowFromLeft(index: number): boolean {
    return this.getPremiumRowIndex(index) % 2 === 0;
  }

  getPremiumAnimationDelay(index: number): string {
    const perRow = this.getPremiumCardsPerRow();
    const rowIndex = this.getPremiumRowIndex(index);
    const columnIndex = index % perRow;
    const inRowOrder = this.isPremiumRowFromLeft(index)
      ? columnIndex
      : Math.max(0, perRow - columnIndex - 1);

    const delayMs = rowIndex * 160 + inRowOrder * 140;
    return `${delayMs}ms`;
  }

  isPremiumRowVisible(index: number): boolean {
    return this.premiumVisibleRows.has(this.getPremiumRowIndex(index));
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
