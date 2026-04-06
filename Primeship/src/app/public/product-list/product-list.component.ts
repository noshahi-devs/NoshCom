import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
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

  // Filters state
  filtersForm: FormGroup;
  searchTerm = '';
  sortBy = 'newest';
  isDiscountPage = false;
  currentCategorySlug = '';
  pricePoints = [10, 50, 100, 200, 300, 400, 500];

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
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(
        takeUntil(this.destroy$),
        switchMap(([params, queryParams]) => {
          this.isLoading = true;
          this.startLoadingMessages();
          this.products = [];
          this.filteredProducts = [];
          this.cdr.detectChanges();


          const slug = params.get('slug') || '';
          const q = queryParams.get('q') || '';
          const sort = (queryParams.get('sortBy') || 'newest').toLowerCase();

          this.currentCategorySlug = slug;
          this.searchTerm = q;
          this.sortBy = sort;
          this.isDiscountPage = sort === 'discount';

          // Sync form UI instantly
          this.filtersForm.patchValue({ category: slug, sortBy: sort }, { emitEvent: false });

          console.log(`🚀 [ProductList] Loading Path: /${slug || 'all'} (Search: ${q})`);

          // Fetch products immediately. Backend handles slug or id.
          // We don't wait for categories to start the product search.
          return this.publicService.getProductsByCategory(slug, q).pipe(
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

  // Logic: Transform raw API products into UI models
  private processProducts(raw: any[]): void {
    const list = raw || [];
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
    this.router.navigate(['/product', p.slug], {
      queryParams: {
        id: p.id,
        sku: p.sku || p.Sku
      }
    });
  }

  onCategoryToggle(cat: any): void {
    this.router.navigate(['/category', cat.slug || cat.id]);
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

