import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
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

interface AutoBannerSlide {
  label: string;
  title: string;
  subtitle: string;
  cta: string;
  image: string;
  alt: string;
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

interface CircleTailSpec {
  label: string;
  slug: string;
  keywords: string[];
}

interface CircleTailItem {
  label: string;
  slug: string;
  image: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, CurrencyPipe],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('recList') recList?: ElementRef<HTMLDivElement>;
  @ViewChild('dealList') dealList?: ElementRef<HTMLDivElement>;
  @ViewChild('collList') collList?: ElementRef<HTMLDivElement>;
  @ViewChild('prodList') prodList?: ElementRef<HTMLDivElement>;
  @ViewChild('squareList2') squareList2?: ElementRef<HTMLDivElement>;
  @ViewChild('spaceList') spaceList?: ElementRef<HTMLDivElement>;
  @ViewChild('budgetList') budgetList?: ElementRef<HTMLDivElement>;
  @ViewChild('wfDealList') wfDealList?: ElementRef<HTMLDivElement>;
  @ViewChild('categoryTrack') categoryTrack?: ElementRef<HTMLDivElement>;
  @ViewChild('heroCarouselWrapper') heroCarouselWrapper?: ElementRef<HTMLDivElement>;

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

  bannerThumbs = [
    { src: '/assets/images/home/cat-electronics.png', alt: 'Electronics' },
    { src: '/assets/images/home/cat-beauty.png', alt: 'Beauty' },
    { src: '/assets/images/home/hero.png', alt: 'Featured' }
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
      image: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1920&h=600'
    },
    {
      kicker: '',
      title: 'Storefront<br/>In Style',
      highlight: 'Modern Design',
      subtitle: '',
      primaryCta: 'Open a Shop Now',
      secondaryCta: '',
      image: 'https://images.pexels.com/photos/32549949/pexels-photo-32549949.jpeg?cs=srgb&dl=pexels-kriss-32549949.jpg&fm=jpg'
    },
    {
      kicker: '',
      title: 'Styled<br/>Shopping Spaces',
      highlight: 'For Your Brand',
      subtitle: '',
      primaryCta: 'Explore Deals',
      secondaryCta: '',
      image: 'https://images.pexels.com/photos/32549954/pexels-photo-32549954.jpeg?cs=srgb&dl=pexels-kriss-32549954.jpg&fm=jpg'
    },
    {
      kicker: '',
      title: 'Sell<br/>Online Faster',
      highlight: 'Live From Home',
      subtitle: '',
      primaryCta: 'Browse Catalog',
      secondaryCta: '',
      image: 'https://images.pexels.com/photos/12935042/pexels-photo-12935042.jpeg?cs=srgb&dl=pexels-imin-technology-276315592-12935042.jpg&fm=jpg'
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

  promoBannerIndex = 0;
  promoBannerSlides: AutoBannerSlide[] = [
    {
      label: 'Fresh Drop',
      title: 'New Season Styles',
      subtitle: 'Browse a rotating mix of fashion-forward pieces, modern interiors, and lifestyle inspiration.',
      cta: 'Shop the Look',
      image: 'https://images.pexels.com/photos/32549949/pexels-photo-32549949.jpeg?cs=srgb&dl=pexels-kriss-32549949.jpg&fm=jpg',
      alt: 'Chic clothing storefront with modern design.'
    },
    {
      label: 'Studio Edit',
      title: 'Styled Spaces',
      subtitle: 'A clean retail mood with soft textures, bold displays, and polished finishing touches.',
      cta: 'Explore Now',
      image: 'https://images.pexels.com/photos/32549954/pexels-photo-32549954.jpeg?cs=srgb&dl=pexels-kriss-32549954.jpg&fm=jpg',
      alt: 'Stylish modern clothing store interior shot.'
    },
    {
      label: 'Work From Home',
      title: 'Sell Smarter',
      subtitle: 'Showcase your products and work-from-home story with a banner that keeps changing on its own.',
      cta: 'Start Selling',
      image: 'https://images.pexels.com/photos/12935042/pexels-photo-12935042.jpeg?cs=srgb&dl=pexels-imin-technology-276315592-12935042.jpg&fm=jpg',
      alt: 'Seamstress selling clothes online.'
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

  spaceCards = [
    {
      slug: 'living-room',
      label: 'Living room',
      image: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?auto=format&fit=crop&w=1800&q=80'
    },
    {
      slug: 'bedroom',
      label: 'Bedroom',
      image: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1800&q=80'
    },
    {
      slug: 'home-office',
      label: 'Home office',
      image: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1800&q=80'
    },
    {
      slug: 'kitchen-dining',
      label: 'Kitchen and dining',
      image: 'https://images.unsplash.com/photo-1556912167-f556f1f39fdf?auto=format&fit=crop&w=1800&q=80'
    },
    {
      slug: 'bathroom',
      label: 'Bathroom',
      image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1800&q=80'
    },
    {
      slug: 'outdoor',
      label: 'Outdoor',
      image: 'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=1800&q=80'
    },
    {
      slug: 'kids-room',
      label: 'Kids room',
      image: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=1800&q=80'
    },
    {
      slug: 'entryway',
      label: 'Entryway',
      image: 'https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=1800&q=80'
    },
    {
      slug: 'modern',
      label: 'Modern style',
      image: 'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1800&q=80'
    },
    {
      slug: 'small-spaces',
      label: 'Small spaces',
      image: 'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?auto=format&fit=crop&w=1800&q=80'
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

  private readonly tailCircleSpecs: CircleTailSpec[] = [
    { label: 'Outdoor decor', slug: 'outdoor', keywords: ['outdoor', 'patio', 'garden', 'yard'] },
    { label: 'Organization', slug: 'organization', keywords: ['organization', 'storage', 'closet'] },
    { label: 'Home Improvement', slug: 'home-improvement', keywords: ['home improvement', 'improvement', 'tools', 'hardware'] },
    { label: 'Kitchen', slug: 'kitchen', keywords: ['kitchen', 'cook', 'dining'] },
    { label: 'Decor & Pillows', slug: 'decor-pillows', keywords: ['decor', 'pillow', 'pillows'] },
    { label: 'Appliances', slug: 'appliances', keywords: ['appliance', 'appliances'] },
    { label: 'Bedding & Bath', slug: 'bedding-bath', keywords: ['bedding', 'bath', 'towel', 'sheets'] }
  ];

  circleCategories: CircleTailItem[] = [
    { label: 'Tax Refund Sale', slug: 'sale', image: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=300&q=80' },
    { label: 'Furniture', slug: 'furniture', image: 'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=300&q=80' },
    { label: 'Bedroom furniture', slug: 'bedroom', image: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=300&q=80' },
    { label: 'Storage', slug: 'storage', image: 'https://images.unsplash.com/photo-1615876234886-fd9a39fda97f?auto=format&fit=crop&w=300&q=80' },
    { label: 'Rugs', slug: 'rugs', image: 'https://images.unsplash.com/photo-1523413651479-597eb2da0ad6?auto=format&fit=crop&w=300&q=80' },
    { label: 'Outdoor decor', slug: 'outdoor', image: 'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=300&q=80' },
    { label: 'Kitchen', slug: 'kitchen', image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=300&q=80' },
    { label: 'Organization', slug: 'organization', image: 'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=300&q=80' },
    { label: 'Bedding & Bath', slug: 'bedding-bath', image: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=300&q=80' },
    { label: 'Lighting', slug: 'lighting', image: 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=300&q=80' },
    { label: 'Decor & Pillows', slug: 'decor-pillows', image: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=300&q=80' },
    { label: 'Home Improvement', slug: 'home-improvement', image: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=300&q=80' },
    { label: 'Appliances', slug: 'appliances', image: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=300&q=80' },
    { label: 'Plumbing', slug: 'plumbing', image: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=300&q=80' }
  ];

  dealTimer = { hours: 12, minutes: 45, seconds: 30 };
  visibleDealsCount = 8;
  readonly DEALS_PER_LOAD = 4;
  visibleDealsSecondaryCount = 8;
  visibleJustForYouCount = 12;
  readonly EXTRA_DEALS_PER_LOAD = 4;
  selectedCategory = '';
  isLoadingCategories = false;
  isLoadingDeals = false;
  isLoadingMiniCategories = false;

  private heroTimerId?: number;
  private promoBannerTimerId?: number;
  private dealTimerId?: number;

  constructor(
    private router: Router,
    private cartService: CartService,
    private wishlistService: WishlistService,
    private publicService: PublicService,
    private categoryService: CategoryService,
    private cdr: ChangeDetectorRef
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
    this.startPromoBannerAutoPlay();
    this.startDealTimer();
    this.loadBackendData();
  }

  ngAfterViewInit(): void {
    this.scheduleHeroVideoPlay();
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
    this.publicService.getProducts('', 0, 60).subscribe({
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
          this.allProducts = mapped.slice(0, 40);

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

  get currentPromoBanner(): AutoBannerSlide {
    return this.promoBannerSlides[this.promoBannerIndex] ?? this.promoBannerSlides[0];
  }

  get upcomingPromoBanner(): AutoBannerSlide {
    if (!this.promoBannerSlides.length) {
      return this.currentPromoBanner;
    }
    return this.promoBannerSlides[(this.promoBannerIndex + 1) % this.promoBannerSlides.length];
  }

  private getParsedImage(images: string | string[]): string {
    const placeholder = '/assets/images/placeholder.jpg';
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
    // Use an absolute path so it works on nested routes like `/home`.
    (event.target as HTMLImageElement).src = '/assets/images/home/hero.png';
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

  openKeepShoppingModal(): void {
    Swal.fire({
      title: `Keep shopping for ${this.keepShoppingQuery}`,
      html: `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;align-items:start">
          ${this.wfKeepShoppingProducts
            .slice(0, 6)
            .map(
              p => `
                <div style="border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;box-shadow:0 8px 20px rgba(15,23,42,0.08);">
                  <div style="width:100%;padding-bottom:100%;position:relative;background:#f8fafb;">
                    <img src="${p.image}" alt="${p.name}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" loading="lazy" />
                  </div>
                  <div style="padding:10px;text-align:center;">
                    <div style="font-weight:700;font-size:13px;color:#111;">${p.name || 'Product'}</div>
                    <div style="font-weight:800;font-size:14px;color:#0f172a;">${p.price ? '$' + p.price.toFixed(0) : ''}</div>
                  </div>
                  <div style="background:#10B981;color:#fff;font-weight:700;font-size:11px;padding:6px 10px;border-radius:0 10px 0 0;">5 Days of Deals</div>
                </div>`
            )
            .join('')}
        </div>
      `,
      width: 900,
      confirmButtonText: 'View more',
      confirmButtonColor: '#10B981',
      showCloseButton: true,
      customClass: {
        popup: 'keep-shopping-modal'
      }
    }).then(result => {
      if (result.isConfirmed) {
        this.router.navigate(['/shop'], { queryParams: { q: this.keepShoppingQuery } });
      }
    });
  }


  ngOnDestroy(): void {
    if (this.heroTimerId) {
      clearInterval(this.heroTimerId);
    }
    if (this.promoBannerTimerId) {
      clearInterval(this.promoBannerTimerId);
    }
    if (this.dealTimerId) {
      clearInterval(this.dealTimerId);
    }

    // Pause hero videos when leaving the page (saves CPU + avoids autoplay quirks on return)
    const wrapper = this.heroCarouselWrapper?.nativeElement;
    const videos = wrapper ? Array.from(wrapper.querySelectorAll<HTMLVideoElement>('.hero-bg-video')) : [];
    for (const v of videos) {
      try {
        v.pause();
      } catch {
        // Ignore
      }
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

  scrollRecommended(dir: 'left' | 'right'): void {
    const el = this.recList?.nativeElement;
    if (!el) return;
    const delta = dir === 'left' ? -320 : 320;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  }

  scrollDealsRow(dir: 'left' | 'right'): void {
    const el = this.dealList?.nativeElement;
    if (!el) return;
    const delta = dir === 'left' ? -320 : 320;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  }

  scrollCollections(dir: 'left' | 'right'): void {
    const el = this.collList?.nativeElement;
    if (!el) return;
    const delta = dir === 'left' ? -320 : 320;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  }

  get collectionItems(): DealItem[] {
    return this.allProducts.slice(0, 12);
  }

  scrollProducts(dir: 'left' | 'right'): void {
    const el = this.prodList?.nativeElement;
    if (!el) return;
    const delta = dir === 'left' ? -360 : 360;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  }

  scrollSquares2(dir: 'left' | 'right'): void {
    const el = this.squareList2?.nativeElement;
    if (!el) return;
    const delta = dir === 'left' ? -300 : 300;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  }

  scrollSpaces(dir: 'left' | 'right'): void {
    const el = this.spaceList?.nativeElement;
    if (!el) return;
    const delta = dir === 'left' ? -420 : 420;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  }

  scrollBudget(dir: 'left' | 'right'): void {
    const el = this.budgetList?.nativeElement;
    if (!el) return;
    const delta = dir === 'left' ? -420 : 420;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  }

  scrollWfDeals(dir: 'left' | 'right'): void {
    const el = this.wfDealList?.nativeElement;
    if (!el) return;
    const delta = dir === 'left' ? -420 : 420;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  }

  getRewardExtra(p: DealItem): number {
    const oldPrice = Number(p?.oldPrice || 0);
    const price = Number(p?.price || 0);
    if (oldPrice > price) return oldPrice - price;
    // Fallback: show a small "member" savings even if no oldPrice exists.
    return Math.max(0, Math.round(price * 0.08 * 100) / 100);
  }

  get tailCircleItems(): CircleTailItem[] {
    const fallback = this.allProducts || [];
    const placeholder = '/assets/images/placeholder.jpg';
    const haystack = (p: DealItem) => `${p?.category || ''} ${p?.name || ''}`.toLowerCase();

    return this.tailCircleSpecs.map((spec, idx) => {
      const match = fallback.find(p => {
        const s = haystack(p);
        return spec.keywords.some(k => s.includes(k.toLowerCase()));
      });

      const image = match?.image || fallback[idx]?.image || placeholder;
      return { label: spec.label, slug: spec.slug, image };
    });
  }

  selectTab(index: number): void {
    this.activeTab = index;
    this.resetCategoryScroll();
  }

  prevHero(): void {
    this.heroIndex = (this.heroIndex - 1 + this.heroSlides.length) % this.heroSlides.length;
    this.scheduleHeroVideoPlay();
  }

  nextHero(): void {
    this.heroIndex = (this.heroIndex + 1) % this.heroSlides.length;
    this.scheduleHeroVideoPlay();
  }

  goHero(index: number): void {
    this.heroIndex = index;
    this.scheduleHeroVideoPlay();
  }

  nextPromoBanner(): void {
    this.promoBannerIndex = (this.promoBannerIndex + 1) % this.promoBannerSlides.length;
  }

  goPromoBanner(index: number): void {
    if (!this.promoBannerSlides.length) {
      this.promoBannerIndex = 0;
      return;
    }
    this.promoBannerIndex = ((index % this.promoBannerSlides.length) + this.promoBannerSlides.length) % this.promoBannerSlides.length;
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

  private scheduleHeroVideoPlay(): void {
    // Autoplay sometimes doesn't start when the slide becomes active (especially on iOS/Safari).
    // Nudge the active hero video to play after the DOM updates.
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => requestAnimationFrame(() => this.playActiveHeroVideo()));
      return;
    }
    setTimeout(() => this.playActiveHeroVideo(), 0);
  }

  private playActiveHeroVideo(): void {
    const wrapper = this.heroCarouselWrapper?.nativeElement;
    if (!wrapper) return;

    // Pause any background videos that are not active (or when the active slide is an image).
    const allVideos = Array.from(wrapper.querySelectorAll<HTMLVideoElement>('.hero-bg-video'));
    for (const v of allVideos) {
      try {
        v.pause();
      } catch {
        // Ignore
      }
    }

    const video = wrapper.querySelector<HTMLVideoElement>('.hero-slide.active .hero-bg-video');
    if (!video) return;

    // Ensure autoplay requirements are satisfied
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    (video as any).webkitPlaysInline = true;

    try {
      if (video.readyState < 2) {
        video.load();
      }
    } catch {
      // Ignore
    }

    const promise = video.play();
    if (promise && typeof promise.catch === 'function') {
      promise.catch(() => {
        // Ignore autoplay blocking; poster will remain.
      });
    }
  }

  private startPromoBannerAutoPlay(): void {
    if (this.promoBannerTimerId) {
      clearInterval(this.promoBannerTimerId);
    }
    if (this.promoBannerSlides.length < 2) {
      return;
    }

    this.promoBannerTimerId = window.setInterval(() => {
      this.nextPromoBanner();
      this.cdr.detectChanges();
    }, 4500);
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
      // In zoneless change detection, timers don't trigger UI updates automatically.
      // Force view update so the active slide + dots update reliably.
      this.cdr.detectChanges();
    }, 7000);
  }

  private startDealTimer(): void {
    this.dealTimerId = window.setInterval(() => {
      if (this.dealTimer.seconds > 0) {
        this.dealTimer.seconds -= 1;
        this.cdr.detectChanges();
        return;
      }
      this.dealTimer.seconds = 59;
      if (this.dealTimer.minutes > 0) {
        this.dealTimer.minutes -= 1;
        this.cdr.detectChanges();
        return;
      }
      this.dealTimer.minutes = 59;
      if (this.dealTimer.hours > 0) {
        this.dealTimer.hours -= 1;
        this.cdr.detectChanges();
        return;
      }
      this.dealTimer = { hours: 12, minutes: 45, seconds: 30 };
      this.cdr.detectChanges();
    }, 1000);
  }
}
