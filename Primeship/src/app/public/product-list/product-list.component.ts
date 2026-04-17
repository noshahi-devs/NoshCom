import { Component, OnInit, OnDestroy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Observable, catchError, throwError, combineLatest, Subject, of } from 'rxjs';
import { map, switchMap, takeUntil, finalize, startWith } from 'rxjs/operators';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { PublicService } from '../../core/services/public.service';
import { ProductService, ProductDto } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { CategoryDto } from '../../core/services/category.service';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule, ButtonModule, ToastModule],
  providers: [MessageService],
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.scss']
})
export class ProductListComponent implements OnInit, OnDestroy {
  // Data State
  products: any[] = [];
  filteredProducts: any[] = [];
  categories: CategoryDto[] = [];
  categoriesWithCount: any[] = [];
  isLoading = false;
  loadingMessage = 'Loading products...';
  private messageInterval: any;
  private readonly loadingMessages = [
    'Loading products...',
    'Finding top items...',
    'Best products for you...',
    'Checking latest stocks...',
    'Getting things ready...',
    'Almost there...'
  ];


  // Selection
  selectedProducts: Set<string> = new Set();
  isAllSelected = false;

  // UI State
  categoryTitle: string = 'Explore Products';
  categoryDescription: string = 'Discover high-performance products selected for quality and style.';
  categoryImage: string = 'assets/images/61+DG4Np+zL._AC_SX425_.jpg';
  private routeCategorySlug = '';
  private routeTitle = '';
  private routeDescription = '';
  private routeImage = '';
  private routeFallbackAll = false;
  private routeMaxProducts = 60;
  hideNonProductUI = false;

  private readonly outdoorFallbackProducts: any[] = [
    {
      id: 'outdoor-1',
      name: 'Coastal Patio Lounge Set',
      images: ['https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=900&q=80'],
      price: 229
    },
    {
      id: 'outdoor-2',
      name: 'Modern Teak Bistro Table',
      images: ['https://images.unsplash.com/photo-1523413651479-597eb2da0ad6?auto=format&fit=crop&w=900&q=80'],
      price: 149
    },
    {
      id: 'outdoor-3',
      name: 'Rattan Outdoor Egg Chair',
      images: ['https://images.unsplash.com/photo-1501045661006-fcebe0257c3f?auto=format&fit=crop&w=900&q=80'],
      price: 199
    },
    {
      id: 'outdoor-4',
      name: 'All-Weather Sectional Set',
      images: ['https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80'],
      price: 389
    },
    {
      id: 'outdoor-5',
      name: 'Garden Solar Lanterns',
      images: ['https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=900&q=80'],
      price: 48
    },
    {
      id: 'outdoor-6',
      name: 'Woven Outdoor Rug',
      images: ['https://images.unsplash.com/photo-1523413651479-597eb2da0ad6?auto=format&fit=crop&w=900&q=80'],
      price: 78
    },
    {
      id: 'outdoor-7',
      name: 'Adjustable Patio Umbrella',
      images: ['https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=900&q=80'],
      price: 99
    },
    {
      id: 'outdoor-8',
      name: 'Acacia Wood Bench',
      images: ['https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=900&q=80'],
      price: 159
    },
    {
      id: 'outdoor-9',
      name: 'Planter Box Trio',
      images: ['https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=900&q=80'],
      price: 69
    },
    {
      id: 'outdoor-10',
      name: 'Outdoor Dining Set',
      images: ['https://images.unsplash.com/photo-1472220625704-91e1462799b2?auto=format&fit=crop&w=900&q=80'],
      price: 329
    },
    {
      id: 'outdoor-11',
      name: 'Cushioned Lounge Chair',
      images: ['https://images.unsplash.com/photo-1501045661006-fcebe0257c3f?auto=format&fit=crop&w=900&q=80'],
      price: 139
    },
    {
      id: 'outdoor-12',
      name: 'Fire Pit Table',
      images: ['https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=900&q=80'],
      price: 259
    }
  ];

  // Filters state
  filtersForm: FormGroup;
  searchTerm = '';
  sortBy = 'newest';
  isDiscountPage = false;
  currentCategorySlug = '';
  pricePoints = [10, 50, 100, 200, 300, 400, 500];
  categoryMenuOpen = false;

  private destroy$ = new Subject<void>();

  constructor(
    public publicService: PublicService,
    private productService: ProductService,
    private cartService: CartService,
    private messageService: MessageService,
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.filtersForm = this.fb.group({
      sortBy: ['newest'],
      category: [''],
      minPrice: [0],
      maxPrice: [10000000]
    });
  }

  ngOnInit(): void {
    // -------------------------------------------------------------------------
    // 1. Reactive Data Stream (BEST PRACTICE)
    // This handles EVERYTHING: Loading, Navigation, Parameters, and Cancellation.
    // -------------------------------------------------------------------------
    combineLatest([this.route.paramMap, this.route.queryParamMap, this.route.data])
      .pipe(
        takeUntil(this.destroy$),
        switchMap(([params, queryParams, data]) => {
          this.isLoading = true;
          this.startLoadingMessages();
          this.products = [];
          this.filteredProducts = [];
          this.cdr.detectChanges();

          this.routeCategorySlug = (data && (data as any).categorySlug) || '';
          this.routeTitle = (data && (data as any).title) || '';
          this.routeDescription = (data && (data as any).description) || '';
          this.routeImage = (data && (data as any).image) || '';
          this.routeFallbackAll = Boolean(data && (data as any).fallbackAll);
          this.routeMaxProducts = Number((data && (data as any).maxProducts) || 60);
          this.hideNonProductUI = Boolean(data && (data as any).hideNonProductUI);

          const slug = params.get('slug') || this.routeCategorySlug || '';
          const categoryId = queryParams.get('categoryId') || '';
          const q = queryParams.get('q') || '';
          const sort = (queryParams.get('sortBy') || 'newest').toLowerCase();

          this.currentCategorySlug = categoryId || slug;
          this.searchTerm = q;
          this.sortBy = sort;
          this.isDiscountPage = sort === 'discount';

          // Sync form UI instantly
          this.filtersForm.patchValue({ category: categoryId || slug, sortBy: sort }, { emitEvent: false });

          console.log(`🚀 [ProductList] Loading Path: /${slug || 'all'} (Search: ${q})`);

          // Fetch products immediately. Backend handles slug or id.
          // We don't wait for categories to start the product search.
          return this.fetchProducts(slug, q, categoryId).pipe(
            finalize(() => {
              this.isLoading = false;
              this.stopLoadingMessages();
              this.cdr.detectChanges();
            }),
            catchError(err => {
              console.error('❌ [ProductList] API Error:', err);
              return of([]);
            })
          );
        })
      )
      .subscribe(allProducts => {
        this.processProducts(allProducts);
      });

    // -------------------------------------------------------------------------
    // 2. Background Category Polling
    // Runs independently so it never blocks the main product grid.
    // -------------------------------------------------------------------------
    this.publicService.getCategories().pipe(takeUntil(this.destroy$)).subscribe(cats => {
      this.categories = cats || [];
      this.calculateCategoryCounts();
      this.updateCategoryInfo();
      this.cdr.detectChanges();
    });

    // 3. Form Changes (Local UI narrowing)
    this.filtersForm.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(val => {
      this.sortBy = val.sortBy;
      const newCategory = val.category || '';

      if (newCategory !== this.currentCategorySlug) {
        const path = newCategory === '' ? ['/shop'] : ['/category', newCategory];
        this.router.navigate(path);
      } else {
        this.applyFilters();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:click')
  closeCategoryMenu(): void {
    this.categoryMenuOpen = false;
  }

  private fetchProducts(slug: string, searchTerm: string, categoryId?: string): Observable<ProductDto[]> {
    const base$ = this.publicService.getProductsByCategory(slug, searchTerm, categoryId).pipe(
      catchError(() => of([]))
    );

    if (!this.routeFallbackAll) {
      return base$;
    }

    return base$.pipe(
      switchMap(items => {
        if (items && items.length > 0) {
          return of(items);
        }
        return this.publicService.getProducts(searchTerm, 0, this.routeMaxProducts).pipe(
          catchError(() => of([]))
        );
      })
    );
  }

  // Logic: Transform raw API products into UI models
  private processProducts(raw: any[]): void {
    let list = raw || [];
    if ((!list || list.length === 0) && this.routeCategorySlug === 'outdoor') {
      list = [...this.outdoorFallbackProducts];
    }
    console.log(`📦 [ProductList] Processing ${list.length} Items.`);

    this.products = list.map(p => ({
      ...p,
      image: this.getFirstImage(p),
      ...this.resolveDisplayPrices(p),
      brand: p.brandName || p.BrandName || 'Generic',
      sku: p.sku || p.Sku,
      reviewCount: Math.floor(Math.random() * 80) + 12
    }));

    this.applyFilters();
  }

  applyFilters(): void {
    let result = [...this.products];
    const val = this.filtersForm.value;

    // Search Narrowing is handled by the backend API call in ngOnInit.
    // We should NOT re-filter here, as it breaks fuzzy/category matches returned by the server.
    // if (this.searchTerm) { ... } -> REMOVED

    // Price Narrowing
    const max = Number(val.maxPrice) || 10000000;
    result = result.filter(p => (Number(p.price) || 0) <= max);

    // Sorting
    if (this.sortBy === 'price-low') {
      result.sort((a, b) => a.price - b.price);
    } else if (this.sortBy === 'price-high') {
      result.sort((a, b) => b.price - a.price);
    } else if (this.sortBy === 'newest') {
      // Sort by ID descending (assuming higher ID is newer) or date
      result.sort((a, b) => (b.id > a.id ? 1 : -1));
    } else if (this.sortBy === 'chart') {
      // Best Sellers: Sort by simulated reviewCount and featured flag
      result.sort((a, b) => {
        if (b.featured !== a.featured) return b.featured ? 1 : -1;
        return (b.reviewCount || 0) - (a.reviewCount || 0);
      });
    } else if (this.sortBy === 'discount') {
      // Flash Deals: Sort by discount percentage descending
      result.sort((a, b) => (b.discount || 0) - (a.discount || 0));
    }

    this.filteredProducts = result;
    this.checkIfAllSelected();
    this.cdr.detectChanges();
  }

  private calculateCategoryCounts(): void {
    this.categoriesWithCount = this.categories.map(cat => ({
      ...cat,
      count: cat.productCount || 0
    }));
  }

  private updateCategoryInfo(): void {
    if (this.routeTitle) {
      this.categoryTitle = this.routeTitle;
      this.categoryDescription = this.routeDescription || this.categoryDescription;
      if (this.routeImage) {
        this.categoryImage = this.routeImage;
      }
      return;
    }

    if (!this.currentCategorySlug || this.currentCategorySlug === 'all') {
      this.categoryTitle = 'All Products';
      this.categoryDescription = 'Discover high-performance products selected for quality and style.';
      return;
    }

    const cat = this.categories.find(c => c.id === this.currentCategorySlug || c.slug === this.currentCategorySlug);
    if (cat) {
      this.categoryTitle = cat.name;
      this.categoryDescription = `Explore our curated ${cat.name} collection.`;
      this.categoryImage = cat.imageUrl || this.categoryImage;
    } else {
      this.categoryTitle = this.currentCategorySlug.replace(/-/g, ' ');
    }
  }

  // -------------------------------------------------------------------------
  // UI Helpers
  // -------------------------------------------------------------------------
  getDiscountedPrice(p: any): number {
    const original = this.getBasePrice(p);
    const discount = this.getDiscountPercent(p);
    return original - (original * discount / 100);
  }

  private getBasePrice(p: any): number {
    return Number(
      p?.resellerMaxPrice ??
      p?.ResellerMaxPrice ??
      p?.price ??
      p?.Price ??
      p?.supplierPrice ??
      p?.SupplierPrice ??
      0
    ) || 0;
  }

  private getDiscountPercent(p: any): number {
    return Number(p?.discountPercentage ?? p?.DiscountPercentage ?? p?.discount ?? 0) || 0;
  }

  private resolveDisplayPrices(p: any): { price: number; originalPrice: number; discount: number } {
    const basePrice = this.getBasePrice(p);
    const discount = this.getDiscountPercent(p);
    const salePrice = discount > 0 ? (basePrice - (basePrice * discount / 100)) : basePrice;
    const safeBasePrice = this.roundToCurrency(basePrice);
    const safeSalePrice = this.roundToCurrency(salePrice);

    return {
      price: safeSalePrice > 0 ? safeSalePrice : safeBasePrice,
      originalPrice: discount > 0 ? safeBasePrice : 0,
      discount
    };
  }

  private roundToCurrency(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  getFirstImage(p: any): string {
    const images = this.productService.parseImages(p.images);
    return images.length > 0 ? images[0] : `https://placehold.co/600x400/f85606/ffffff?text=${encodeURIComponent(p.name)}`;
  }

  handleImageError(event: any, name: string): void {
    event.target.src = `https://placehold.co/600x400/f85606/ffffff?text=${encodeURIComponent(name)}`;
  }

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  onProductClick(p: any): void {
    const routeSlug = this.getProductRouteFromProduct(p);
    const queryParams = this.getProductQueryParamsFromProduct(p);

    if (routeSlug) {
      this.router.navigate(['/product', routeSlug], { queryParams });
      return;
    }

    this.router.navigate(['/shop']);
  }

  private getProductRouteFromProduct(product: any): string {
    const raw = (
      product?.slug ||
      product?.productSlug ||
      product?.name ||
      product?.sku ||
      product?.id ||
      ''
    ).toString().trim();

    if (!raw) {
      return '';
    }

    return raw
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private getProductQueryParamsFromProduct(product: any): Record<string, string> {
    const queryParams: Record<string, string> = {};
    const id = (product?.id || '').toString().trim();
    const sku = (product?.sku || '').toString().trim();
    if (id) {
      queryParams['id'] = id;
    }
    if (sku) {
      queryParams['sku'] = sku;
    }
    return queryParams;
  }

  onCategoryToggle(cat: any): void {
    this.router.navigate(['/category', cat.slug || cat.id]);
  }

  toggleCategoryMenu(): void {
    this.categoryMenuOpen = !this.categoryMenuOpen;
  }

  selectCategory(value: string): void {
    this.categoryMenuOpen = false;
    this.filtersForm.patchValue({ category: value });
  }

  get categoryLabel(): string {
    const current = this.filtersForm?.get('category')?.value || '';
    if (!current) return 'All';

    const match = (this.categoriesWithCount || []).find((c: any) => (c.slug || c.id) === current);
    if (!match) return String(current);
    return `${match.name}`;
  }

  get selectedCategoryImage(): string {
    const current = this.filtersForm?.get('category')?.value || '';
    if (!current) return this.getCategoryFallbackImage('All');

    const match = (this.categoriesWithCount || []).find((c: any) => (c.slug || c.id) === current);
    const url = (match as any)?.imageUrl || (match as any)?.image || (match as any)?.ImageUrl;
    return url || this.getCategoryFallbackImage(this.categoryLabel);
  }

  getCategoryOptionImage(cat: any): string {
    if (!cat || cat.__isAll) return this.getCategoryFallbackImage('All');
    const url = cat?.imageUrl || cat?.image || cat?.ImageUrl;
    return url || this.getCategoryFallbackImage(cat?.name || 'Category');
  }

  handleCategoryThumbError(event: any, name: string): void {
    const img = event?.target;
    if (!img) return;
    img.src = this.getCategoryFallbackImage(name || 'Category');
    img.onerror = null;
  }

  private getCategoryFallbackImage(name: string): string {
    return `https://placehold.co/96x96/10B981/ffffff?text=${encodeURIComponent(name || 'Category')}`;
  }

  get categoryColumns(): any[][] {
    const cols: any[][] = [];
    const rawItems = this.categoriesWithCount || [];
    const items = [
      { __isAll: true, id: '', slug: '', name: 'All', count: null },
      ...rawItems
    ];
    for (let i = 0; i < items.length; i += 4) {
      cols.push(items.slice(i, i + 4));
    }
    return cols;
  }

  get categoryColumnRows(): any[][][] {
    const rows: any[][][] = [];
    const columns = this.categoryColumns;
    const columnsPerRow = 4;
    for (let i = 0; i < columns.length; i += columnsPerRow) {
      rows.push(columns.slice(i, i + columnsPerRow));
    }
    return rows;
  }

  setPricePoint(val: number): void {
    this.filtersForm.patchValue({ maxPrice: val });
  }

  clearFilters(): void {
    this.filtersForm.patchValue({ sortBy: 'newest', maxPrice: 10000000 }, { emitEvent: false });
    this.searchTerm = '';
    if (this.currentCategorySlug) this.router.navigate(['/shop']);
    else this.applyFilters();
  }

  toggleProductSelection(productId: string): void {
    this.selectedProducts.has(productId) ? this.selectedProducts.delete(productId) : this.selectedProducts.add(productId);
    this.checkIfAllSelected();
  }

  toggleAllProducts(event: any): void {
    this.isAllSelected = event.target.checked;
    if (this.isAllSelected) this.filteredProducts.forEach(p => this.selectedProducts.add(p.id));
    else this.selectedProducts.clear();
  }

  private checkIfAllSelected(): void {
    this.isAllSelected = this.filteredProducts.length > 0 && this.filteredProducts.every(p => this.selectedProducts.has(p.id));
  }

  addToCart(product: any): void {
    this.cartService.addToCart(product, 1);
    this.messageService.add({ severity: 'success', summary: 'Added to Cart', detail: `${product.name} added!` });
  }

  addSelectedToCart(): void {
    const selected = this.filteredProducts.filter(p => this.selectedProducts.has(p.id));
    selected.forEach(p => this.cartService.addToCart(p, 1));
    this.messageService.add({ severity: 'success', summary: 'Added to Cart', detail: `Successfully added ${selected.length} items!` });
    this.selectedProducts.clear();
    this.isAllSelected = false;
  }
  private startLoadingMessages(): void {
    if (this.messageInterval) return;
    let index = 0;
    this.messageInterval = setInterval(() => {
      index = (index + 1) % this.loadingMessages.length;
      this.loadingMessage = this.loadingMessages[index];
      this.cdr.detectChanges();
    }, 2500);
  }

  private stopLoadingMessages(): void {
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
      this.messageInterval = null;
    }
  }
}

