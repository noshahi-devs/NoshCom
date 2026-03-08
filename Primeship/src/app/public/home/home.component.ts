import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../core/services/cart.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { PublicService } from '../../core/services/public.service';
import { CategoryService } from '../../core/services/category.service';
import Swal from 'sweetalert2';

interface HeroSlide {
  kicker: string;
  title: string;
  highlight: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta: string;
  image: string;
}

interface SideBanner {
  kicker: string;
  title: string;
  subtitle: string;
  image: string;
}

interface ProductItem {
  name: string;
  category: string;
  price: number;
  image: string;
  id?: string;
  slug?: string;
}

interface CategoryTab {
  title: string;
  products: ProductItem[];
}

interface PromoBanner {
  kicker: string;
  title: string;
  image: string;
  blob: string;
}

interface DealItem {
  name: string;
  category: string;
  price: number;
  oldPrice: number;
  discount: string;
  image: string;
  id?: string;
  slug?: string;
}

interface MiniListItem {
  title: string;
  price: number;
  image: string;
  id?: string;
  slug?: string;
}

interface MiniCategory {
  title: string;
  slug: string;
  items: MiniListItem[];
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, CurrencyPipe],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  @ViewChild('categoryTrack') categoryTrack?: ElementRef<HTMLDivElement>;

  heroIndex = 0;
  activeTab = 0;
  heroSlides: HeroSlide[] = [
    {
      kicker: 'Premium Picks for UK Sellers',
      title: 'Power Your Store',
      highlight: 'With Primeship',
      subtitle: 'Curated essentials, fast fulfillment, and margin-friendly pricing for growing stores.',
      primaryCta: 'Shop Now',
      secondaryCta: 'View Collections',
      image: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&h=600'
    },
    {
      kicker: 'Weekly Mega Deals',
      title: 'Top Trending',
      highlight: 'Home Essentials',
      subtitle: 'Bestselling products updated weekly, ready to ship across the UK.',
      primaryCta: 'Explore Deals',
      secondaryCta: 'See New Drops',
      image: 'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=900&h=600'
    },
    {
      kicker: 'Seller Favorites',
      title: 'Upgrade Your',
      highlight: 'Product Line',
      subtitle: 'Verified quality, strong margins, and quick restock for high-demand categories.',
      primaryCta: 'Browse Catalog',
      secondaryCta: 'View Popular',
      image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&h=600'
    }
  ];

  heroSideBanners: SideBanner[] = [
    {
      kicker: 'Up to 40% Off',
      title: 'Smart Accessories',
      subtitle: 'High-demand tech add-ons.',
      image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=360&h=360'
    },
    {
      kicker: 'Limited Stock',
      title: 'Home & Living',
      subtitle: 'Top margin decor picks.',
      image: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=360&h=360'
    }
  ];

  categoryTabs: CategoryTab[] = [
    {
      title: 'baby accessories',
      products: [
        { name: 'Newborn Clothes Set', category: 'baby accessories', price: 32.4, image: 'assets/images/71NpF4JP7HL._AC_SY879_.jpg' },
        { name: 'Baby Car Camera Full-Color', category: 'baby accessories', price: 34.2, image: 'assets/images/61+DG4Np+zL._AC_SX425_.jpg' },
        { name: 'Infant Electric Swing', category: 'baby accessories', price: 42.73, image: 'assets/images/81jgetrp87L._AC_SX679_.jpg' },
        { name: 'WonderFold Stroller Wagon', category: 'baby accessories', price: 37.7, image: 'assets/images/81ec6uY7eML._AC_SX425_.jpg' },
        { name: 'Single Jogging Stroller', category: 'baby accessories', price: 27.3, image: 'assets/images/61BKAbqOL5L._AC_SX679_.jpg' },
        { name: 'Portable Baby Monitor', category: 'baby accessories', price: 29.99, image: 'assets/images/81BrD6Y4ieL._AC_SX425_.jpg' },
        { name: 'Cotton Swaddle Set', category: 'baby accessories', price: 18.99, image: 'assets/images/91NNZo3825L._AC_SX679_.jpg' },
        { name: 'Bottle Sterilizer Pro', category: 'baby accessories', price: 54.0, image: 'assets/images/81eUg-ixCSL._AC_SX679_.jpg' }
      ]
    },
    {
      title: 'sports and outdoor',
      products: [
        { name: 'Foldable Camp Chair', category: 'sports and outdoor', price: 28.5, image: 'assets/images/91P2724BW3L._AC_SX679_.jpg' },
        { name: 'Tactical Sports Backpack', category: 'sports and outdoor', price: 39.9, image: 'assets/images/61ZY6ZP0V6L._AC_SL1024_.jpg' },
        { name: 'Outdoor Lantern Set', category: 'sports and outdoor', price: 22.4, image: 'assets/images/81OT48ieUNL._AC_SL1500_.jpg' },
        { name: 'Running Hydration Vest', category: 'sports and outdoor', price: 26.75, image: 'assets/images/71J6P8L6ORL._AC_SX679_.jpg' },
        { name: 'Portable Stove Kit', category: 'sports and outdoor', price: 31.6, image: 'assets/images/81eUg-ixCSL._AC_SX679_.jpg' },
        { name: 'Thermal Flask Pro', category: 'sports and outdoor', price: 19.8, image: 'assets/images/61BKAbqOL5L._AC_SX679_.jpg' }
      ]
    },
    {
      title: 'Home Decor',
      products: [
        { name: 'Modern Table Lamp', category: 'Home Decor', price: 24.3, image: 'assets/images/81jgetrp87L._AC_SX679_.jpg' },
        { name: 'Accent Wall Mirror', category: 'Home Decor', price: 39.0, image: 'assets/images/81OT48ieUNL._AC_SL1500_.jpg' },
        { name: 'Minimal Vase Set', category: 'Home Decor', price: 18.2, image: 'assets/images/91NNZo3825L._AC_SX679_.jpg' },
        { name: 'Nordic Cushion Pack', category: 'Home Decor', price: 22.1, image: 'assets/images/71NpF4JP7HL._AC_SY879_.jpg' },
        { name: 'Decorative Shelf', category: 'Home Decor', price: 44.5, image: 'assets/images/61ZY6ZP0V6L._AC_SL1024_.jpg' }
      ]
    },
    {
      title: 'Beauty & Personal Care',
      products: [
        { name: 'Glow Facial Kit', category: 'Beauty & Personal Care', price: 19.9, image: 'assets/images/81BrD6Y4ieL._AC_SX425_.jpg' },
        { name: 'Hair Dryer Ultra', category: 'Beauty & Personal Care', price: 45.0, image: 'assets/images/61+DG4Np+zL._AC_SX425_.jpg' },
        { name: 'Portable Manicure Set', category: 'Beauty & Personal Care', price: 13.5, image: 'assets/images/91P2724BW3L._AC_SX679_.jpg' },
        { name: 'Travel Makeup Bag', category: 'Beauty & Personal Care', price: 16.75, image: 'assets/images/71J6P8L6ORL._AC_SX679_.jpg' },
        { name: 'Skin Care Bundle', category: 'Beauty & Personal Care', price: 27.9, image: 'assets/images/81eUg-ixCSL._AC_SX679_.jpg' }
      ]
    }
  ];

  topPromoBanners: PromoBanner[] = [
    {
      kicker: '50% OFF',
      title: 'Watch',
      image: '/assets/images/home/cat-electronics.png',
      blob: '#E8F4FF'
    },
    {
      kicker: '40% OFF',
      title: 'Fashion',
      image: '/assets/images/home/cat-fashion.png',
      blob: '#FFF0E6'
    },
    {
      kicker: '60% OFF',
      title: 'Beauty',
      image: '/assets/images/home/cat-beauty.png',
      blob: '#F4E8FF'
    }
  ];

  bottomPromoBanners: PromoBanner[] = [
    {
      kicker: 'New Arrival',
      title: 'Kitchen',
      image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=500&h=500',
      blob: '#E6FFFA'
    },
    {
      kicker: 'Best Seller',
      title: 'Sports',
      image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=500&h=500',
      blob: '#FFF5F5'
    },
    {
      kicker: 'Limited',
      title: 'Home Decor',
      image: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?auto=format&fit=crop&w=500&h=500',
      blob: '#F0FFF4'
    }
  ];

  miniCategories: MiniCategory[] = [
    {
      title: 'sports and outdoor',
      slug: 'sports-outdoor',
      items: [
        { title: 'Plastic Cones and Rings Games', price: 5.12, image: 'assets/images/71pJrGjCY4L._AC_SY300_SX300_QL70_FMwebp_.webp' },
        { title: 'Polarized Sunglasses-Men', price: 7.23, image: 'assets/images/71f5OAgbOhL._AC_SY300_SX300_QL70_FMwebp_.webp' },
        { title: 'Badminton Set 4 Rackets', price: 12.23, image: 'assets/images/71J6P8L6ORL._AC_SX679_.jpg' },
        { title: 'Premium Foam Glow Football', price: 6.12, image: 'assets/images/71KSGYZbdtL._AC_SY300_SX300_QL70_FMwebp_.webp' }
      ]
    },
    {
      title: 'Kitchen',
      slug: 'kitchen',
      items: [
        { title: 'Amazon Basics File Tabs', price: 7.22, image: 'assets/images/71mDH9AeWL._AC_SY300_SX300_QL70_FMwebp_.webp' },
        { title: 'Hanging Organizer File', price: 6.11, image: 'assets/images/71uCAB24cIL._AC_SY300_SX300_QL70_FMwebp_.webp' },
        { title: 'Magnetic Clips 50 Pack', price: 9.32, image: 'assets/images/71wXw9c4UnL._AC_SY300_SX300_QL70_FMwebp_.webp' },
        { title: 'Heavy Duty Shipping Tape', price: 7.88, image: 'assets/images/71pJrGjCY4L._AC_SY300_SX300_QL70_FMwebp_.webp' }
      ]
    },
    {
      title: 'Office Products',
      slug: 'office-products',
      items: [
        { title: 'Under Sink Organizer 2 Tier', price: 7.22, image: 'assets/images/71yZ4mpVwoL._AC_SX679_.jpg' },
        { title: 'Kitchen Pot Rack Mounted', price: 31.84, image: 'assets/images/71eefm+fvoL._AC_SX679_.jpg' },
        { title: 'Kitchen Bakers Rack', price: 38.11, image: 'assets/images/71dY1KlUS3L._AC_SX679_.jpg' },
        { title: 'Toddler Kitchen Stool Helper', price: 39.0, image: 'assets/images/81OT48ieUNL._AC_SL1500_.jpg' }
      ]
    }
  ];

  deals: DealItem[] = [
    {
      name: 'Smart Vacuum Cleaner',
      category: 'Home Appliance',
      price: 79.2,
      oldPrice: 119.0,
      discount: '-34%',
      image: 'assets/images/81OT48ieUNL._AC_SL1500_.jpg'
    },
    {
      name: 'Wireless Earbuds Pro',
      category: 'Electronics',
      price: 29.4,
      oldPrice: 49.0,
      discount: '-40%',
      image: 'assets/images/61+DG4Np+zL._AC_SX425_.jpg'
    },
    {
      name: 'Air Fryer XL',
      category: 'Kitchen',
      price: 64.0,
      oldPrice: 89.0,
      discount: '-28%',
      image: 'assets/images/81jgetrp87L._AC_SX679_.jpg'
    },
    {
      name: 'Fitness Smartwatch',
      category: 'Wearables',
      price: 55.5,
      oldPrice: 79.0,
      discount: '-30%',
      image: 'assets/images/91NNZo3825L._AC_SX679_.jpg'
    },
    {
      name: 'Portable Blender Mini',
      category: 'Kitchen',
      price: 24.9,
      oldPrice: 35.0,
      discount: '-29%',
      image: 'assets/images/71J6P8L6ORL._AC_SX679_.jpg'
    },
    {
      name: 'LED Desk Lamp',
      category: 'Home Decor',
      price: 18.5,
      oldPrice: 29.0,
      discount: '-36%',
      image: 'assets/images/81jgetrp87L._AC_SX679_.jpg'
    },
    {
      name: 'Noise Canceling Headset',
      category: 'Electronics',
      price: 69.0,
      oldPrice: 95.0,
      discount: '-27%',
      image: 'assets/images/71eefm+fvoL._AC_SX679_.jpg'
    },
    {
      name: 'Ergonomic Office Chair',
      category: 'Office',
      price: 129.0,
      oldPrice: 179.0,
      discount: '-28%',
      image: 'assets/images/71dY1KlUS3L._AC_SX679_.jpg'
    },
    {
      name: 'Smart Air Purifier',
      category: 'Home Appliance',
      price: 89.0,
      oldPrice: 129.0,
      discount: '-31%',
      image: 'assets/images/81OT48ieUNL._AC_SL1500_.jpg'
    },
    {
      name: 'Kitchen Knife Set',
      category: 'Kitchen',
      price: 39.0,
      oldPrice: 59.0,
      discount: '-34%',
      image: 'assets/images/71fJxIg1yZL._AC_SX569_.jpg'
    },
    {
      name: 'Fitness Resistance Bands',
      category: 'Sports',
      price: 16.9,
      oldPrice: 24.0,
      discount: '-30%',
      image: 'assets/images/71kmszI1pfL._AC_SX679_.jpg'
    },
    {
      name: 'Wireless Desk Charger',
      category: 'Electronics',
      price: 21.5,
      oldPrice: 32.0,
      discount: '-33%',
      image: 'assets/images/71NsPQ4s+YL._AC_SX679_.jpg'
    }
  ];

  dealTimer = { hours: 12, minutes: 45, seconds: 30 };
  visibleDealsCount = 4;
  readonly DEALS_PER_LOAD = 8;
  visibleDealsSecondaryCount = 4;
  visibleJustForYouCount = 4;
  readonly EXTRA_DEALS_PER_LOAD = 4;

  private heroTimerId?: number;
  private dealTimerId?: number;

  constructor(
    private router: Router,
    private cartService: CartService,
    private wishlistService: WishlistService,
    private publicService: PublicService,
    private categoryService: CategoryService
  ) { }

  ngOnInit(): void {
    this.startHeroAutoPlay();
    this.startDealTimer();
    this.loadBackendData();
  }

  private loadBackendData(): void {
    // 1. Load Categories for Tabs
    this.publicService.getCategories().subscribe(cats => {
      if (cats && cats.length > 0) {
        // Create tabs for the first 3-5 categories
        this.categoryTabs = [];
        const topCats = cats.slice(0, 5);

        topCats.forEach(cat => {
          this.publicService.getProductsByCategory(cat.slug).subscribe(products => {
            if (products && products.length > 0) {
              this.categoryTabs.push({
                title: cat.name,
                products: products.map(p => {
                  const originalPrice = p.resellerMaxPrice ?? (p as any).ResellerMaxPrice ?? p.price ?? 0;
                  const discount = p.discountPercentage ?? (p as any).DiscountPercentage ?? 0;
                  const salePrice = discount > 0 ? (originalPrice - (originalPrice * discount / 100)) : originalPrice;

                  return {
                    name: p.name,
                    category: cat.name,
                    price: salePrice > 0 ? salePrice : (originalPrice > 0 ? originalPrice : 0),
                    image: this.getParsedImage(p.images),
                    id: p.id,
                    slug: p.slug
                  };
                })
              });
            }
          });
        });
      }
    });

    // 2. Load Real Deals for Carousels
    this.publicService.getProducts('', 0, 12).subscribe(products => {
      if (products && products.length > 0) {
        this.deals = products.map(p => {
          const originalPrice = p.resellerMaxPrice ?? (p as any).ResellerMaxPrice ?? p.price ?? 0;
          const discountPct = p.discountPercentage ?? (p as any).DiscountPercentage ?? 0;
          const salePrice = discountPct > 0 ? (originalPrice - (originalPrice * discountPct / 100)) : originalPrice;

          const displayPrice = salePrice > 0 ? salePrice : (originalPrice > 0 ? originalPrice : 0);
          const oldPrice = discountPct > 0 ? originalPrice : (displayPrice * 1.25); // Show old price if there's a discount
          const discountLabel = discountPct > 0 ? `-${Math.round(discountPct)}%` : (oldPrice > displayPrice ? 'SALE' : 'HOT');

          return {
            name: p.name,
            category: 'Featured',
            price: displayPrice,
            oldPrice: oldPrice,
            discount: discountLabel,
            image: this.getParsedImage(p.images),
            id: p.id,
            slug: p.slug
          };
        });
      }
    });

    // 3. Load Mini Categories
    this.publicService.getCategories().subscribe(cats => {
      const miniCats = cats.slice(5, 8); // Choose different categories
      if (miniCats.length > 0) {
        this.miniCategories = [];
        miniCats.forEach(cat => {
          this.publicService.getProductsByCategory(cat.slug).subscribe(items => {
            this.miniCategories.push({
              title: cat.name,
              slug: cat.slug,
              items: items.slice(0, 4).map(it => {
                const originalPrice = it.resellerMaxPrice ?? (it as any).ResellerMaxPrice ?? it.price ?? 0;
                const discount = it.discountPercentage ?? (it as any).DiscountPercentage ?? 0;
                const salePrice = discount > 0 ? (originalPrice - (originalPrice * discount / 100)) : originalPrice;

                return {
                  title: it.name,
                  price: salePrice > 0 ? salePrice : (originalPrice > 0 ? originalPrice : 0),
                  image: this.getParsedImage(it.images),
                  id: it.id,
                  slug: it.slug
                };
              })
            });
          });
        });
      }
    });
  }

  private getParsedImage(images: string | string[]): string {
    const placeholder = 'assets/images/placeholder.jpg';
    if (!images) return placeholder;
    if (Array.isArray(images)) return images[0] || placeholder;

    let result = images;
    try {
      if (images.startsWith('[') || images.startsWith('{')) {
        const parsed = JSON.parse(images);
        result = Array.isArray(parsed) ? (parsed[0] || placeholder) : (parsed || placeholder);
      }
    } catch {
      result = images;
    }

    // Final check: if it's not a URL and not a local asset path, it might be a broken backend reference
    if (result && !result.startsWith('http') && !result.startsWith('assets/') && !result.startsWith('/')) {
      // If it looks like a filename, it might need a base path, but for now we fallback to placeholder to avoid broken icons
      return placeholder;
    }

    return result || placeholder;
  }

  setDefaultImage(event: Event): void {
    (event.target as HTMLImageElement).src = 'assets/images/placeholder.jpg';
  }

  ngOnDestroy(): void {
    if (this.heroTimerId) {
      clearInterval(this.heroTimerId);
    }
    if (this.dealTimerId) {
      clearInterval(this.dealTimerId);
    }
  }

  get activeTabProducts(): ProductItem[] {
    return this.categoryTabs[this.activeTab]?.products ?? [];
  }

  get visibleDeals(): DealItem[] {
    return this.deals.slice(0, this.visibleDealsCount);
  }

  get canLoadMoreDeals(): boolean {
    return this.visibleDealsCount < this.deals.length;
  }

  get visibleDealsSecondary(): DealItem[] {
    return this.deals.slice(0, this.visibleDealsSecondaryCount);
  }

  get canLoadMoreDealsSecondary(): boolean {
    return this.visibleDealsSecondaryCount < this.deals.length;
  }

  get visibleJustForYou(): DealItem[] {
    return this.deals.slice(0, this.visibleJustForYouCount);
  }

  get canLoadMoreJustForYou(): boolean {
    return this.visibleJustForYouCount < this.deals.length;
  }

  selectTab(index: number): void {
    this.activeTab = index;
    this.resetCategoryScroll();
  }

  prevHero(): void {
    this.heroIndex = (this.heroIndex - 1 + this.heroSlides.length) % this.heroSlides.length;
  }

  nextHero(): void {
    this.heroIndex = (this.heroIndex + 1) % this.heroSlides.length;
  }

  goHero(index: number): void {
    this.heroIndex = index;
  }

  onHeroKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      this.prevHero();
      event.preventDefault();
    }
    if (event.key === 'ArrowRight') {
      this.nextHero();
      event.preventDefault();
    }
  }

  scrollCategory(direction: number): void {
    const track = this.categoryTrack?.nativeElement;
    if (!track) {
      return;
    }
    const amount = track.clientWidth * 0.9;
    track.scrollBy({ left: direction * amount, behavior: 'smooth' });
  }

  resetCategoryScroll(): void {
    const track = this.categoryTrack?.nativeElement;
    if (!track) {
      return;
    }
    track.scrollTo({ left: 0, behavior: 'smooth' });
  }

  onCategoryKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      this.scrollCategory(-1);
      event.preventDefault();
    }
    if (event.key === 'ArrowRight') {
      this.scrollCategory(1);
      event.preventDefault();
    }
  }

  loadMoreDeals(): void {
    this.visibleDealsCount += this.DEALS_PER_LOAD;
  }

  loadMoreDealsSecondary(): void {
    this.visibleDealsSecondaryCount += this.EXTRA_DEALS_PER_LOAD;
  }

  loadMoreJustForYou(): void {
    this.visibleJustForYouCount += this.EXTRA_DEALS_PER_LOAD;
  }

  addToCart(product: any, event?: Event): void {
    if (event) event.stopPropagation();
    this.cartService.addToCart(product, 1);
    // You could add a toast notification here if ToastService is available
  }

  toggleWishlist(product: any, event?: Event): void {
    if (event) event.stopPropagation();
    this.wishlistService.toggleWishlist(product);
  }

  isInWishlist(product: any): boolean {
    const idOrName = product.id || product.name;
    return this.wishlistService.isInWishlist(idOrName);
  }

  // --- New Interactive Features ---

  addToCompare(product: any, event: Event) {
    event.stopPropagation();
    Swal.fire({
      title: 'Added to Compare',
      text: `${product.name} has been added to your comparison list.`,
      icon: 'success',
      toast: true,
      position: 'top-end',
      timer: 3000,
      showConfirmButton: false,
      background: '#fff',
      color: '#1e293b'
    });
  }

  // Quick View State
  showQuickView = false;
  selectedProduct: any = null;

  openQuickView(product: any, event: Event) {
    event.stopPropagation();
    this.selectedProduct = product;
    this.showQuickView = true;
    document.body.style.overflow = 'hidden'; // Prevent scroll
  }

  closeQuickView() {
    this.showQuickView = false;
    this.selectedProduct = null;
    document.body.style.overflow = 'auto';
  }

  quickViewAddToCart() {
    if (this.selectedProduct) {
      this.addToCart(this.selectedProduct);
      this.closeQuickView();
    }
  }

  goToProduct(product: any) {
    if (product?.slug) {
      this.router.navigate(['/product', product.slug]);
      return;
    }
    if (product?.id) {
      this.router.navigate(['/product', 'item'], { queryParams: { id: product.id } });
      return;
    }
    Swal.fire({
      title: 'Product Detail Unavailable',
      text: 'This item does not have a detail page yet.',
      icon: 'info',
      toast: true,
      position: 'top-end',
      timer: 2500,
      showConfirmButton: false,
      background: '#fff',
      color: '#1e293b'
    });
  }

  goToMiniCategory(slug: string, event?: Event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (slug) {
      this.router.navigate(['/category', slug]);
    }
  }

  private startHeroAutoPlay(): void {
    this.heroTimerId = window.setInterval(() => {
      this.nextHero();
    }, 7000);
  }

  private startDealTimer(): void {
    this.dealTimerId = window.setInterval(() => {
      if (this.dealTimer.seconds > 0) {
        this.dealTimer.seconds -= 1;
        return;
      }
      this.dealTimer.seconds = 59;
      if (this.dealTimer.minutes > 0) {
        this.dealTimer.minutes -= 1;
        return;
      }
      this.dealTimer.minutes = 59;
      if (this.dealTimer.hours > 0) {
        this.dealTimer.hours -= 1;
        return;
      }
      this.dealTimer = { hours: 12, minutes: 45, seconds: 30 };
    }, 1000);
  }
}
