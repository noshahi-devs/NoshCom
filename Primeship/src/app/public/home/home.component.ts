import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
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
  image?: string;
  video?: string;
  poster?: string;
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
  imports: [CommonModule, RouterLink, FormsModule, CurrencyPipe],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy {
  @ViewChild('categoryTrack') categoryTrack?: ElementRef<HTMLDivElement>;

  searchQuery = '';
  brandLinks = [
    { label: 'Wayfair', href: '/' },
    { label: 'ALLMODERN', href: '/allmodern' },
    { label: 'BIRCH LN', href: '/birch-ln' },
    { label: 'JOSS & MAIN', href: '/joss-main' },
    { label: 'PERIGOLD', href: '/perigold' }
  ];

  utilityLinks = [
    { label: 'Rewards', href: '/rewards' },
    { label: 'Financing', href: '/financing' },
    { label: 'Professional', href: '/professional' },
    { label: 'Fast & Free Shipping Over $35*', href: '/shipping' }
  ];

  navCategories = [
    { label: 'Furniture', href: '/furniture' },
    { label: 'Outdoor', href: '/outdoor' },
    { label: 'Bedding & Bath', href: '/bedding-bath' },
    { label: 'Rugs', href: '/rugs' },
    { label: 'Decor & Pillows', href: '/decor-pillows' },
    { label: 'Lighting', href: '/lighting' },
    { label: 'Organization', href: '/organization' },
    { label: 'Kitchen', href: '/kitchen' },
    { label: 'Baby & Kids', href: '/baby-kids' },
    { label: 'Home Improvement', href: '/home-improvement' },
    { label: 'Appliances', href: '/appliances' },
    { label: 'Pet', href: '/pet' },
    { label: 'Holiday', href: '/holiday' },
    { label: 'Sale', href: '/sale' }
  ];

  heroIndex = 0;
  activeTab = 0;
  heroSlides: HeroSlide[] = [
    {
      kicker: '',
      title: 'Present<br/>Your Products',
      highlight: 'to Millions',
      subtitle: '',
      primaryCta: 'Open a Shop Now',
      secondaryCta: '',
      video: 'https://secure.img1-fg.wfcdn.com/dm/video/de3b1f89-5bb5-49f1-870f-a49d4cc07e25/wfus_5dod_etm_desktop.mp4',
      poster: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1920&h=600'
    },
    {
      kicker: '',
      title: 'Present<br/>Your Products',
      highlight: 'to Millions',
      subtitle: '',
      primaryCta: 'Open a Shop Now',
      secondaryCta: '',
      image: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1920&h=600'
    },
    {
      kicker: '',
      title: 'Source Top<br/>Trending',
      highlight: 'Global Inventories',
      subtitle: '',
      primaryCta: 'Explore Deals',
      secondaryCta: '',
      image: 'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=1920&h=600'
    },
    {
      kicker: '',
      title: 'Scale Your<br/>Operations',
      highlight: 'Globally',
      subtitle: '',
      primaryCta: 'Browse Catalog',
      secondaryCta: '',
      image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1920&h=600'
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

  categoryTabs: CategoryTab[] = [];

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

  miniCategories: MiniCategory[] = [];

  dealsPrimary: DealItem[] = [];
  dealsSecondary: DealItem[] = [];
  dealsJustForYou: DealItem[] = [];
  allProducts: DealItem[] = [];

  // Wayfair-style 3-up recommendation panels
  keepShoppingQuery = 'mattresses';
  wfKeepShoppingProducts: DealItem[] = [];
  wfDealsProducts: DealItem[] = [];
  wfVerifiedProducts: DealItem[] = [];

  dealTimer = { hours: 12, minutes: 45, seconds: 30 };
  visibleDealsCount = 8;
  readonly DEALS_PER_LOAD = 4;
  visibleDealsSecondaryCount = 8;
  visibleJustForYouCount = 12;
  readonly EXTRA_DEALS_PER_LOAD = 4;
  isLoadingCategories = false;
  isLoadingDeals = false;
  isLoadingMiniCategories = false;

  private heroTimerId?: number;
  private dealTimerId?: number;

  constructor(
    private router: Router,
    private cartService: CartService,
    private wishlistService: WishlistService,
    private publicService: PublicService,
    private categoryService: CategoryService
  ) { }

  onSearch(event: Event): void {
    event.preventDefault();
    const query = this.searchQuery?.trim();
    if (!query) {
      return;
    }
    this.router.navigate(['/home'], { queryParams: { q: query } });
  }

  ngOnInit(): void {
    this.startHeroAutoPlay();
    this.startDealTimer();
    this.loadBackendData();
  }

  private loadBackendData(): void {
    this.categoryTabs = [];
    this.miniCategories = [];
    this.dealsPrimary = [];
    this.dealsSecondary = [];
    this.dealsJustForYou = [];
    this.allProducts = [];
    this.activeTab = 0;
    this.visibleDealsCount = 8;
    this.visibleDealsSecondaryCount = 8;
    this.visibleJustForYouCount = 12;
    this.isLoadingCategories = true;
    this.isLoadingDeals = true;
    this.isLoadingMiniCategories = true;

    // 1. Categories tabs are disabled (user requested removing category table UI)
    this.isLoadingCategories = false;

    // 2. Load Real Deals for Carousels
    this.publicService.getProducts('', 0, 120).subscribe({
      next: (products) => {
        this.isLoadingDeals = false;
        if (products && products.length > 0) {
          const mapped = products.map(p => {
          const originalPrice = p.resellerMaxPrice ?? (p as any).ResellerMaxPrice ?? p.price ?? 0;
          const discountPct = p.discountPercentage ?? (p as any).DiscountPercentage ?? 0;
          const salePrice = discountPct > 0 ? (originalPrice - (originalPrice * discountPct / 100)) : originalPrice;

          const displayPrice = salePrice > 0 ? salePrice : (originalPrice > 0 ? originalPrice : 0);
          const oldPrice = discountPct > 0 ? originalPrice : (displayPrice * 1.25); // Show old price if there's a discount
          const discountLabel = discountPct > 0 ? `-${Math.round(discountPct)}%` : (oldPrice > displayPrice ? 'SALE' : 'HOT');
          const categoryLabel = p.categoryName || (p as any).category || 'Featured';

          return {
            name: p.name,
            category: categoryLabel,
            price: displayPrice,
            oldPrice: oldPrice,
            discount: discountLabel,
            image: this.getParsedImage(p.images),
            id: p.id,
            slug: p.slug
          };
        });
          this.allProducts = mapped;

          const mixed = this.mixByKey(mapped, deal => deal.category || 'Featured');
          const [primary, secondary, justForYou] = this.splitDeals(mixed, 3);
          this.dealsPrimary = primary;
          this.dealsSecondary = secondary;
          this.dealsJustForYou = justForYou;
          this.buildWfPanels();
        }
      },
      error: () => {
        this.isLoadingDeals = false;
      }
    });

    // 3. Load Mini Categories
    // (Disabled for now - user requested removing the categories table UI)
    this.isLoadingMiniCategories = false;
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

  private shuffle<T>(items: T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  private mixByKey<T>(items: T[], getKey: (item: T) => string): T[] {
    if (!items || items.length <= 1) return items || [];

    const buckets = new Map<string, T[]>();
    for (const item of items) {
      const key = (getKey(item) || 'unknown').toString();
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(item);
    }

    const shuffledBuckets = this.shuffle(
      Array.from(buckets.values()).map(bucket => this.shuffle(bucket))
    );

    const mixed: T[] = [];
    let added = true;
    while (added) {
      added = false;
      for (const bucket of shuffledBuckets) {
        if (bucket.length) {
          mixed.push(bucket.shift() as T);
          added = true;
        }
      }
    }

    return mixed;
  }

  private splitDeals(items: DealItem[], groupCount: number): DealItem[][] {
    const groups: DealItem[][] = Array.from({ length: groupCount }, () => []);
    if (!items || items.length === 0) return groups;

    const seen = new Set<string>();
    const keyOf = (deal: DealItem) => (deal.id || deal.slug || `${deal.name}-${deal.price}`).toString();

    let index = 0;
    for (const deal of items) {
      const key = keyOf(deal);
      if (seen.has(key)) continue;
      groups[index % groupCount].push(deal);
      seen.add(key);
      index++;
    }

    // Best-effort fallback if data is too small: ensure every group has something
    if (groups.some(group => group.length === 0)) {
      let fillIndex = 0;
      for (const deal of items) {
        groups[fillIndex % groupCount].push(deal);
        fillIndex++;
        if (!groups.some(group => group.length === 0)) break;
      }
    }

    return groups;
  }

  setDefaultImage(event: Event): void {
    (event.target as HTMLImageElement).src = 'assets/images/placeholder.jpg';
  }

  private buildWfPanels(): void {
    const all = [...this.dealsPrimary, ...this.dealsSecondary, ...this.dealsJustForYou];

    const uniqById = (items: DealItem[]) => {
      const seen = new Set<string>();
      const result: DealItem[] = [];
      for (const item of items) {
        const key = item.id || item.slug || item.name;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(item);
      }
      return result;
    };

    const keepMatches = uniqById(all.filter(p => (p.name || '').toLowerCase().includes(this.keepShoppingQuery.toLowerCase())));
    const keepFilled = uniqById([...keepMatches, ...all]);

    const dealsMatches = uniqById(all.filter(p => (p.discount || '').toLowerCase().includes('%') || (p.discount || '').toLowerCase().includes('sale')));
    const dealsFilled = uniqById([...dealsMatches, ...all]);

    const verifiedFilled = uniqById([...(this.dealsSecondary.length ? this.dealsSecondary : []), ...all]);

    this.wfKeepShoppingProducts = keepFilled.slice(0, 4);
    this.wfDealsProducts = dealsFilled.slice(0, 4);
    this.wfVerifiedProducts = verifiedFilled.slice(0, 4);
  }

  getWfTag(panel: 'keep' | 'deals' | 'verified', index: number): string {
    if (panel === 'deals' && index === 2) return '5% Off Coupon';
    return '5 Days of Deals';
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
    return this.dealsPrimary.slice(0, this.visibleDealsCount);
  }

  get canLoadMoreDeals(): boolean {
    return this.visibleDealsCount < this.dealsPrimary.length;
  }

  get visibleDealsSecondary(): DealItem[] {
    return this.dealsSecondary.slice(0, this.visibleDealsSecondaryCount);
  }

  get canLoadMoreDealsSecondary(): boolean {
    return this.visibleDealsSecondaryCount < this.dealsSecondary.length;
  }

  get visibleJustForYou(): DealItem[] {
    return this.dealsJustForYou.slice(0, this.visibleJustForYouCount);
  }

  get canLoadMoreJustForYou(): boolean {
    return this.visibleJustForYouCount < this.dealsJustForYou.length;
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
