import { ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { Observable, Subject, combineLatest, takeUntil } from 'rxjs';
import { PublicService } from '../../core/services/public.service';
import { ProductService, ProductDto } from '../../core/services/product.service';

import { Product } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { ToastService } from '../../core/services/toast.service';
import { RecentlyViewedService } from '../../core/services/recently-viewed.service';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, ButtonModule, FormsModule, ReactiveFormsModule],

  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.scss']
})
export class ProductDetailComponent implements OnInit, OnDestroy {
  @ViewChild('mainImage') mainImageRef?: ElementRef<HTMLImageElement>;
  private destroy$ = new Subject<void>();
  product: Product | null = null;
  relatedProducts: any[] = [];
  quantity: number = 1;
  selectedSize: string = '';
  selectedColor: string = '';
  isLoading = true;
  isLoadingRelated = false;

  // New properties for enhanced functionality

  activeTab: 'description' | 'specifications' | 'reviews' = 'description';

  // Gallery items for product images
  galleryItems: { image: string, title: string }[] = [];

  // Key features for the product
  keyFeatures: { icon: string, text: string }[] = [];

  // Default specifications if none provided
  specs: { key: string, value: string }[] = [];


  sizes: string[] = [];
  colors: string[] = [];

  reviews = [];


  // Additional properties for related products
  isLoadingMore = false;
  allRelatedProducts: Product[] = [];
  showAllProducts = false;
  maxProductsToShow = 8;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private publicService: PublicService,
    private productService: ProductService,
    private authService: AuthService,
    private cartService: CartService,
    private toastService: ToastService,
    private recentlyViewedService: RecentlyViewedService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([params, query]) => {
        const id = query.get('id');
        const sku = query.get('sku');
        const slug = params.get('slug');
        this.loadProduct(id, sku, slug);
      });
  }


  private loadProduct(id: string | null, sku: string | null, slug: string | null): void {
    if (!id && !sku && !slug) {
      this.router.navigate(['/home']);
      return;
    }

    this.isLoading = true;
    this.isLoadingRelated = false;
    this.relatedProducts = [];
    this.cdr.detectChanges();

    // Strategy: Try looking up by ID (Marketplace/Supplier direct), then SKU, then Slug.
    // All these now hit the clean PublicAppService which has no "Store" dependency.
    let lookup$: Observable<ProductDto>;

    if (id) {
      lookup$ = this.publicService.getProductDetail(id);
    } else if (sku) {
      lookup$ = this.publicService.getProductBySku(sku);
    } else {
      lookup$ = this.publicService.getProductBySlug(slug!);
    }

    lookup$.subscribe({
      next: (dto: ProductDto) => this.handleProductLoadSuccess(dto),
      error: (err) => this.handleLoadError(err)
    });
  }

  private handleProductLoadSuccess(dto: ProductDto): void {
    // Robust normalization for ProductDto (Public Marketplace Model)
    const id = dto.id;
    const name = dto.name;
    const description = dto.description || '';
    const brand = dto.brandName || 'Generic';

    // Image handling
    const images = this.productService.parseImages(dto.images);
    const mainImage = images.length > 0 ? images[0] : `https://placehold.co/600x400/f85606/ffffff?text=${encodeURIComponent(name)}`;

    // Price and Stock handling
    const displayPrices = this.resolveDisplayPrices(dto as any);
    const price = displayPrices.price;
    const originalPrice = displayPrices.originalPrice;
    const discount = displayPrices.discount;
    const inStock = dto.stockQuantity > 0;
    const sku = dto.sku || (dto as any).SKU || 'N/A';

    // Options mapping
    this.sizes = this.productService.parseSizeOptions(dto.sizeOptions);
    this.colors = this.productService.parseColorOptions(dto.colorOptions);

    // Populate Gallery/Specs as before
    this.galleryItems = images.map((img: string, idx: number) => ({
      image: img,
      title: idx === 0 ? 'Main View' : `Detail View ${idx}`
    }));

    const categoryName = dto.categoryName || 'Marketplace';

    this.specs = [
      { key: 'SKU', value: sku },
      { key: 'Brand', value: brand },
      { key: 'Category', value: categoryName },
      { key: 'Origin', value: 'Global' }
    ];

    this.keyFeatures = [
      { icon: 'pi pi-check-circle', text: 'Verified Authenticity' },
      { icon: 'pi pi-box', text: 'Wholesale Ready' },
      { icon: 'pi pi-globe', text: 'Global Sourcing' }
    ];

    this.product = {
      id,
      name,
      slug: dto.slug || '',
      price,
      originalPrice,
      discount,
      rating: 4.8,
      reviewCount: Math.floor(Math.random() * 50) + 10,
      image: mainImage,
      images,
      inStock,
      description,
      fullDescription: description,
      category: categoryName,
      specifications: this.specs,
      brand,
      sku
    };

    this.recentlyViewedService.add({
      id: String(id),
      name,
      slug: dto.slug || '',
      sku,
      image: mainImage,
      price
    });

    this.isLoading = false;
    this.cdr.detectChanges();
    if (dto.categoryId) {
      this.loadRelatedProducts(dto.categoryId);
    }
  }

  private handleLoadError(error: any): void {
    this.isLoading = false;
    this.cdr.detectChanges();
    console.error('❌ Error loading product:', error);
    this.router.navigate(['/home']);
  }

  private loadRelatedProducts(categoryId: string): void {
    this.isLoadingRelated = true;
    this.publicService.getProductsByCategory('', undefined, categoryId).subscribe({
      next: (products) => {

        this.relatedProducts = (products || [])
          .filter(p => p.slug !== this.product?.slug)
          .slice(0, 12)
          .map(p => ({
            ...p,
            images: this.productService.parseImages(p.images),
            image: this.getFirstImage(p),
            ...this.resolveDisplayPrices(p),
            reviewCount: Math.floor(Math.random() * 20) + 5
          }));

        // ADDING THREE MORE DUMMY PRODUCTS FOR A RICHER UI
        this.relatedProducts.push(
          { name: 'Minimalist Ceramic Vase', price: 45.99, image: 'https://images.unsplash.com/photo-1578500494198-246f612d3b3d?auto=format&fit=crop&w=400&h=400', reviewCount: 88, slug: 'item' },
          { name: 'Artisan Woven Basket', price: 29.50, image: 'https://images.unsplash.com/photo-1620189507195-68309c04c4d0?auto=format&fit=crop&w=400&h=400', reviewCount: 42, slug: 'item' },
          { name: 'Nordic Velvet Cushion', price: 34.00, image: 'https://images.unsplash.com/photo-1584347719230-0582522eeded?auto=format&fit=crop&w=400&h=400', reviewCount: 156, slug: 'item' }
        );

        this.isLoadingRelated = false;
        this.cdr.detectChanges();

      },
      error: (err) => {
        console.error('Error loading related products:', err);
        this.isLoadingRelated = false;
        this.cdr.detectChanges();
      }
    });
  }


  increaseQuantity(): void {
    if (this.quantity < 10) {
      this.quantity++;
    }
  }

  decreaseQuantity(): void {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  addToCart(): void {
    if (!this.authService.isAuthenticated()) {
      this.toastService.showInfo('Please login to add items to cart');
      this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    if (this.product) {
      this.cartService.addToCart(this.product, this.quantity, this.selectedSize, this.selectedColor);
      this.toastService.showSuccess(`${this.product.name} added to cart!`);
    }
  }

  addToWishlist(): void {
    if (this.product) {
      console.log('Adding to wishlist:', this.product);
      this.toastService.showSuccess('Product added to wishlist!');
    }
  }

  calculateSavings(): number {
    if (this.product?.originalPrice && this.product?.price) {
      return this.product.originalPrice - this.product.price;
    }
    return 0;
  }

  loadAllRelatedProducts(): void {
    if (this.isLoadingMore) return;
    this.isLoadingMore = true;
    setTimeout(() => {
      this.isLoadingMore = false;
      this.showAllProducts = true;
    }, 1500);
  }

  toggleViewAll(): void {
    if (!this.showAllProducts) {
      this.loadAllRelatedProducts();
    } else {
      this.showAllProducts = false;
    }
  }

  getFirstImage(p: any): string {
    const images = this.productService.parseImages(p.images);
    return images.length > 0 ? images[0] : `https://placehold.co/600x400/f85606/ffffff?text=${encodeURIComponent(p.name)}`;
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

  selectImage(product: Product, imageIndex: number): void {
    if (product.images && product.images[imageIndex]) {
      product.image = product.images[imageIndex];
    }
  }


  buyNow(): void {
    if (!this.product) return;
    if (!this.authService.isAuthenticated()) {
      this.toastService.showInfo('Please login to continue to checkout');
      this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    console.log('Buying now:', {
      product: this.product,
      quantity: this.quantity,
      size: this.selectedSize,
      color: this.selectedColor
    });

    // Add to cart and go to checkout
    this.cartService.addToCart(this.product, this.quantity, this.selectedSize, this.selectedColor);
    this.router.navigate(['/checkout']);
  }

  onRelatedProductClick(product: any): void {
    if (!product) return;
    const id = product.id || product.productId;
    const slug = product.slug || (product.name ? this.productService.generateSlug(product.name) : 'item');
    this.router.navigate(['/product', slug], id ? { queryParams: { id } } : undefined);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  selectGalleryImage(image: string, index: number): void {
    if (!this.product) return;
    if (this.product.images && this.product.images[index]) {
      this.product.image = this.product.images[index];
    } else {
      this.product.image = image;
    }
  }

  openImageInNewTab(): void {
    const imageUrl = this.product?.image || this.mainImageRef?.nativeElement?.src;
    if (imageUrl) {
      window.open(imageUrl, '_blank');
    }
  }

  openImageFullscreen(): void {
    const imageEl = this.mainImageRef?.nativeElement;
    if (!imageEl) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
      return;
    }
    if (imageEl.requestFullscreen) {
      imageEl.requestFullscreen().catch(() => undefined);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

