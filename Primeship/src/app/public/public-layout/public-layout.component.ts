import { Component, HostListener, OnInit, ChangeDetectorRef, AfterViewChecked } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CartService } from '../../core/services/cart.service';
import { WishlistService } from '../../core/services/wishlist.service';
import { AuthService } from '../../core/services/auth.service';
import { CategoryService, CategoryLookupDto } from '../../core/services/category.service';
import { filter } from 'rxjs/operators';
import { NavigationEnd } from '@angular/router';
import { PublicService } from '../../core/services/public.service';
import Swal from 'sweetalert2';

declare var lucide: any;

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, CurrencyPipe, FormsModule, ReactiveFormsModule],
  template: `
    <div class="nosh-shell">
      <!-- Skygarden Utility Top Bar -->
      <div class="top-util-bar" *ngIf="!isAuthPage">
        <div class="container-header">
           <div class="top-util-flex">
              <div class="top-util-left">
                <a href="#" class="util-link">Language: EN</a>
                <span class="sep"></span>
                <a href="#" class="util-link">Ship to: United States</a>
              </div>
              <div class="top-util-right">
                <a [attr.href]="merchantPortalHref" (click)="openMerchantPortal($event)" class="util-link highlight">Sell on Noshahibaba</a>
                <a routerLink="/help" class="util-link">Help & Contact</a>
              </div>
           </div>
        </div>
      </div>

      <!-- Skygarden Main Header -->
      <header class="main-header" [class.sticky]="isScrolled" *ngIf="!isAuthPage">
        <div class="container-header">
          <div class="header-main-flex">
            <!-- Logo Section -->
            <div class="header-logo-section">
              <a routerLink="/" class="logo">
                <span class="logo-text">Noshahi<span>baba</span></span>
              </a>
            </div>

            <!-- Categories Dropdown Button -->
            <div class="header-cat-section" (mouseenter)="showNavCategories = true" (mouseleave)="showNavCategories = false">
              <button class="cat-btn">
                CATEGORIES <i class="fas fa-chevron-down ms-2"></i>
              </button>
              <div class="cat-dropdown-menu" [class.show]="showNavCategories">
                <div class="cat-grid">
                  <div class="cat-item" *ngFor="let cat of navCategories" [routerLink]="['/category', cat.slug]" (click)="showNavCategories = false">
                    {{ cat.name }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Long Search Bar -->
            <div class="header-search-section">
              <div class="search-box">
                <input type="text" [(ngModel)]="searchTerm" placeholder="Search for products, categories or shops" (keyup.enter)="onSearch()">
                <button class="search-icon-btn" (click)="onSearch()"><i class="fas fa-search"></i></button>
              </div>
            </div>

            <!-- User Actions -->
            <div class="header-action-section">
               <a *ngIf="!authService.isAuthenticated()" routerLink="/auth/login" class="action-link">
                  Log In <i class="far fa-user-circle ms-2 scale-12"></i>
               </a>
               <a *ngIf="authService.isAuthenticated()" [routerLink]="getPortalUrl()" class="action-link">
                  {{ userName.split(' ')[0] }} <i class="fas fa-user-circle ms-2 scale-12"></i>
               </a>
               <a routerLink="/cart" class="action-link cart-trigger">
                  Cart <i class="fas fa-shopping-cart ms-2 scale-12"></i>
                  <span class="badge" *ngIf="cartCount > 0">{{ cartCount }}</span>
               </a>
            </div>
          </div>
        </div>
      </header>

      <!-- Content Area -->
      <main class="nosh-main">
        <router-outlet></router-outlet>
      </main>

      <!-- Global Noshahibaba Footer -->
      <footer class="nosh-footer-canvas" *ngIf="!isAuthPage">
        <div class="container-footer">
          <div class="footer-plate">
            
            <div class="plate-inner">
              <!-- Premium Newsletter Banner -->
              <div class="newsletter-banner">
                <div class="nl-content">
                  <h2>Subscribe to our Newsletter</h2>
                  <p>Enter your email address to receive the latest global sourcing updates, wholesale campaigns, and exclusive Noshahibaba offers.</p>
                  
                  <div class="nl-form-group">
                    <input type="email" placeholder="Enter your email address">
                    <button class="btn-nl-subscribe">Subscribe</button>
                  </div>
                  <div class="nl-consent">
                     <i class="fas fa-check-square"></i> I accept the terms of data processing according to strict privacy protocols.
                  </div>
                </div>
                <div class="nl-visual">
                  <!-- Sleek e-commerce/3d logistics box graphic -->
                  <img src="https://cdn-icons-png.flaticon.com/512/4129/4129437.png" alt="Logistics 3D Graphic">
                </div>
              </div>

              <!-- Footer Links Matrix (5 Columns) -->
              <div class="footer-links-grid">
                <div class="f-col">
                  <h4>Categories</h4>
                  <ul>
                    <li><a routerLink="/shop">Personal Care</a></li>
                    <li><a routerLink="/shop">Electronics</a></li>
                    <li><a routerLink="/shop">Apparel & Fashion</a></li>
                    <li><a routerLink="/shop">Home & Garden</a></li>
                  </ul>
                </div>
                <div class="f-col">
                  <h4>Corporate</h4>
                  <ul>
                    <li><a routerLink="/about-us">About Us</a></li>
                    <li><a routerLink="/about-us">Our Network</a></li>
                    <li><a routerLink="/about-us">Certifications</a></li>
                    <li><a routerLink="/about-us">Partners</a></li>
                  </ul>
                </div>
                <div class="f-col">
                  <h4>Support Hub</h4>
                  <ul>
                    <li><a routerLink="/track">Order Tracking</a></li>
                    <li><a routerLink="/help">Logistics Options</a></li>
                    <li><a routerLink="/returns">Delivery & Returns</a></li>
                    <li><a routerLink="/help">Trade Assurance</a></li>
                  </ul>
                </div>
                <div class="f-col">
                  <h4>Legal & Compliance</h4>
                  <ul>
                    <li><a routerLink="/help">FAQ</a></li>
                    <li><a routerLink="/about-us">Privacy Policy</a></li>
                    <li><a routerLink="/about-us">Terms of Use</a></li>
                    <li><a routerLink="/about-us">Data Security</a></li>
                  </ul>
                </div>
                <div class="f-col f-col-cert">
                  <!-- Certification Badges Mockup -->
                  <div class="cert-placeholder">Guven<br>Damgasi</div>
                  <div class="cert-placeholder dark">ETBIS Reg.</div>
                </div>
              </div>
            </div>

            <!-- Dark Green Bottom Bar -->
            <div class="footer-bottom-bar">
              <div class="f-bottom-left">
                Copyright © 2026 Noshahibaba Matrix. All rights reserved.
              </div>
              <div class="f-bottom-center social-icons">
                <a href="#"><i class="fab fa-facebook-f"></i></a>
                <a href="#"><i class="fab fa-twitter"></i></a>
                <a href="#"><i class="fab fa-instagram"></i></a>
                <a href="#"><i class="fab fa-youtube"></i></a>
                <a href="#"><i class="fab fa-linkedin-in"></i></a>
              </div>
              <div class="f-bottom-right payment-badges">
                <i class="fab fa-cc-mastercard"></i>
                <i class="fab fa-cc-visa"></i>
                <span class="ssl-badge"><i class="fas fa-shield-alt"></i> 256 Bit SSL Encryption</span>
              </div>
            </div>

          </div>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    :host {
      --header-bg: #064E3B; // Deep Emerald Green
      --primary: #10B981; // Emerald Green Accent
      --primary-hover: #059669;
      --text-white: #FFFFFF;
      --text-gray: #D1D5DB;
      --bg-light: #F9FAFB;
      --border-gray: #E5E7EB;
    }

    .nosh-shell { font-family: 'Poppins', sans-serif; background: #FFF; min-height: 100vh; display: flex; flex-direction: column; }
    .container-header { max-width: 1400px; margin: 0 auto; padding: 0 20px; width: 100%; }
    .container-footer { max-width: 1300px; margin: 0 auto; padding: 0 20px; width: 100%; }

    /* Utility Top Bar */
    .top-util-bar { background: #000; padding: 6px 0; font-size: 13px; font-weight: 700; color: var(--text-gray); }
    .top-util-flex { display: flex; justify-content: space-between; align-items: center; }
    .top-util-left, .top-util-right { display: flex; align-items: center; gap: 20px; }
    .util-link { color: var(--text-gray); text-decoration: none; transition: 0.2s; &:hover { color: var(--text-white); } }
    .util-link.highlight { color: var(--primary); }
    .sep { width: 1px; height: 12px; background: #333; }

    /* Main Header */
    .main-header { background: var(--header-bg); padding: 20px 0; border-bottom: 2px solid rgba(16,185,129,0.3); transition: 0.3s; position: relative; z-index: 1000; }
    .main-header.sticky { box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
    .header-main-flex { display: flex; align-items: center; gap: 25px; }

    /* Logo Section */
    .header-logo-section { flex-shrink: 0; }
    .logo { text-decoration: none; }
    .logo-text { font-size: 30px; font-weight: 900; color: #FFF; letter-spacing: -1.5px; span { color: var(--primary); } }

    /* Categories Button */
    .header-cat-section { position: relative; display: flex; align-items: center; }
    .cat-btn { height: 48px; display: flex; align-items: center; background: transparent; color: #FFF; border: 1.5px solid rgba(255,255,255,0.3); padding: 0 20px; border-radius: 6px; font-weight: 900; font-size: 14px; cursor: pointer; transition: 0.3s; &:hover { border-color: var(--primary); color: var(--primary); } }
    .cat-dropdown-menu { position: absolute; top: 100%; left: 0; width: 600px; background: #FFF; box-shadow: 0 15px 40px rgba(0,0,0,0.15); border-radius: 0 0 10px 10px; padding: 25px; opacity: 0; visibility: hidden; transform: translateY(10px); transition: 0.3s; z-index: 1500; &.show { opacity: 1; visibility: visible; transform: translateY(0); } }
    .cat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .cat-item { color: #333; padding: 10px 15px; border-radius: 6px; font-weight: 700; font-size: 14px; cursor: pointer; transition: 0.2s; &:hover { background: var(--bg-light); color: var(--primary); } }

    /* Search Bar section */
    .header-search-section { flex: 1; margin: 0 15px; display: flex; align-items: center; }
    .search-box { display: flex; background: #FFF; border-radius: 8px; overflow: hidden; height: 48px; width: 100%; position: relative; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
    .search-box input { flex: 1; border: none; padding: 0 20px; font-size: 15px; font-weight: 500; outline: none; }
    .search-icon-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: transparent; color: #444; border: none; font-size: 18px; cursor: pointer; &:hover { color: var(--primary); } }

    /* User Actions Section */
    .header-action-section { display: flex; align-items: center; gap: 20px; flex-shrink: 0; }
    .action-link { text-decoration: none; color: #FFF; font-weight: 700; font-size: 14px; display: flex; align-items: center; transition: 0.2s; &:hover { color: var(--primary); } }
    .scale-12 { font-size: 1.3rem; }
    .cart-trigger { position: relative; .badge { position: absolute; top: -8px; right: -10px; background: var(--primary); color: #FFF; font-size: 11px; font-weight: 900; padding: 2px 6px; border-radius: 12px; line-height: 1; border: 2px solid var(--header-bg); } }

    /* Content Area */
    .nosh-main { flex: 1; }

    /* Premium Rounded Footer Matrix */
    .nosh-footer-canvas { background: var(--header-bg); padding: 30px 0 0; position: relative; width: 100%; margin-top: auto; }
    .footer-plate { background: #FFFFFF; max-width: 1300px; margin: 0 auto; border-radius: 30px 30px 0 0; overflow: hidden; box-shadow: 0 -10px 30px rgba(0,0,0,0.1); }
    .plate-inner { padding: 30px 40px 10px; }
    
    /* Newsletter Banner */
    .newsletter-banner { background: linear-gradient(135deg, #FFFFFF 0%, #F5EAE0 100%); border-radius: 12px; padding: 15px 30px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; position: relative; overflow: hidden; border: 1px solid #EAE0D5; box-shadow: 0 5px 15px rgba(0,0,0,0.03); }
    .nl-content { max-width: 500px; z-index: 2; position: relative; }
    .nl-content h2 { font-size: 20px; font-weight: 900; color: #3A4E48; margin: 0 0 6px; letter-spacing: -0.5px; }
    .nl-content p { font-size: 12px; color: #5B6B65; margin-bottom: 12px; line-height: 1.4; font-weight: 500; }
    
    .nl-form-group { display: flex; gap: 10px; margin-bottom: 8px; }
    .nl-form-group input { flex: 1; padding: 10px 15px; border: 1px solid #DDD; background: #FFF; border-radius: 6px; font-size: 13px; font-weight: 500; outline: none; }
    .nl-form-group input::placeholder { color: #AAA; }
    .btn-nl-subscribe { background: var(--header-bg); color: #FFF; border: none; padding: 0 20px; border-radius: 6px; font-weight: 800; font-size: 13px; cursor: pointer; transition: 0.3s; &:hover { background: var(--primary); transform: translateY(-2px); box-shadow: 0 5px 15px rgba(16,185,129,0.3); } }
    
    .nl-consent { font-size: 11px; color: #7F8A85; display: flex; align-items: center; gap: 6px; font-weight: 500; }
    .nl-consent i { color: #A3B5AE; font-size: 12px; }
    
    .nl-visual { position: absolute; right: 30px; top: 50%; transform: translateY(-50%); width: 90px; z-index: 1; pointer-events: none; }
    .nl-visual img { width: 100%; height: auto; filter: drop-shadow(0 10px 20px rgba(0,0,0,0.15)); transform: scale(1.1); }

    /* Footer Links Matrix */
    .footer-links-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 25px; }
    .f-col h4 { font-size: 15px; font-weight: 800; color: #111; margin-bottom: 16px; text-transform: none; }
    .f-col ul { list-style: none; padding: 0; margin: 0; }
    .f-col li { margin-bottom: 10px; }
    .f-col a { color: #555; text-decoration: none; font-size: 13px; font-weight: 600; transition: 0.2s; position: relative; }
    .f-col a:hover { color: var(--primary); padding-left: 5px; }
    
    .f-col-cert { display: flex; flex-direction: column; align-items: flex-end; justify-content: flex-end; gap: 12px; }
    .cert-placeholder { width: 100px; height: 45px; border: 1.5px dashed #CCC; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; color: #888; text-align: center; line-height: 1.2; }
    .cert-placeholder.dark { border-color: #333; color: #333; }

    /* Gray Bottom Bar */
    .footer-bottom-bar { background: #F3F4F6; border-top: 1px solid #E5E7EB; padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; color: var(--header-bg); font-size: 13px; font-weight: 700; border-radius: 0; }
    .f-bottom-center a { color: var(--header-bg); background: #E5E7EB; width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; margin: 0 5px; transition: 0.3s; font-size: 14px; &:hover { background: var(--header-bg); color: #FFF; transform: translateY(-3px); } }
    .payment-badges { display: flex; align-items: center; gap: 12px; font-size: 24px; color: var(--header-bg); }
    .ssl-badge { border: 1.5px solid rgba(6,78,59,0.2); border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 800; display: inline-flex; align-items: center; gap: 6px; background: rgba(6,78,59,0.05); color: var(--header-bg); }

    @media (max-width: 1024px) {
      .footer-links-grid { grid-template-columns: repeat(2, 1fr); }
      .nl-visual { opacity: 0.3; right: -50px; }
      .newsletter-banner, .plate-inner, .footer-bottom-bar { padding: 30px; }
      .footer-bottom-bar { flex-direction: column; gap: 20px; text-align: center; }
    }
  `]
})
export class PublicLayoutComponent implements OnInit, AfterViewChecked {
  isScrolled = false;
  selectedCategory = 'Products';
  showCategoryDropdown = false;
  showNavCategories = false;
  isAuthPage = false;
  cartCount = 0;
  userName = 'Guest';
  categories: CategoryLookupDto[] = [];
  searchTerm = '';
  selectedCategorySlug = '';

  private fallbackCategories: CategoryLookupDto[] = [
    { id: 'pc', name: 'Personal Care', slug: 'personal-care' },
    { id: 'el', name: 'Electronics', slug: 'electronics' },
    { id: 'lp', name: 'Laptop', slug: 'laptop' },
    { id: 'kt', name: 'Kitchen', slug: 'kitchen' },
    { id: 'ph', name: 'Phones', slug: 'phones' },
    { id: 'wm', name: 'Women Fashion', slug: 'women-fashion' },
    { id: 'mn', name: 'Men Fashion', slug: 'men-fashion' },
    { id: 'sp', name: 'Sports', slug: 'sports' },
    { id: 'hm', name: 'Home Decor', slug: 'home-decor' },
    { id: 'bb', name: 'Baby Care', slug: 'baby-care' }
  ];

  constructor(
    public cartService: CartService,
    public wishlistService: WishlistService,
    public authService: AuthService,
    private categoryService: CategoryService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private publicService: PublicService
  ) { }

  ngOnInit(): void {
    this.cartService.cartItems$.subscribe(() => {
      this.cartCount = this.cartService.getCartCount();
    });

    this.authService.currentUser$.subscribe(user => {
      if (user && this.authService.isAuthenticated()) {
        const nameFromToken = this.authService.getUserName();
        this.userName = nameFromToken || 'User';
        this.publicService.getProfile().subscribe({
          next: (profile: any) => {
            if (profile && (profile.name || profile.surname)) {
              this.userName = `${profile.name || ''} ${profile.surname || ''}`.trim();
              this.cdr.detectChanges();
            }
          }
        });
      } else {
        this.userName = 'Guest';
      }
    });

    this.loadCategories();

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.isAuthPage = this.router.url.includes('/auth/login') || this.router.url.includes('/auth/register');
      this.syncCategoryWithUrl();
      this.scrollToTop();
    });
  }

  ngAfterViewChecked(): void {
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  get navCategories(): CategoryLookupDto[] {
    return this.categories.length > 0 ? this.categories : this.fallbackCategories;
  }

  private syncCategoryWithUrl(): void {
    const url = this.router.url;
    const match = url.match(/\/category\/([^?\/]+)/);
    if (match && match[1]) {
      this.selectedCategorySlug = match[1];
      if (this.categories.length > 0) {
        const cat = this.categories.find(c => c.slug === this.selectedCategorySlug);
        this.selectedCategory = cat ? cat.name : this.selectedCategorySlug.replace(/-/g, ' ');
      }
    } else {
      this.selectedCategory = 'Products';
      this.selectedCategorySlug = '';
    }
  }

  loadCategories(): void {
    this.categoryService.getLookup().subscribe({
      next: (data) => {
        this.categories = data || [];
        this.syncCategoryWithUrl();
        this.cdr.detectChanges();
      }
    });
  }

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.isScrolled = window.pageYOffset > 50;
  }

  toggleCategoryDropdown() {
    this.showCategoryDropdown = !this.showCategoryDropdown;
  }

  selectSearchCategory(name: string, slug?: string) {
    this.selectedCategory = name;
    this.selectedCategorySlug = slug || '';
    this.showCategoryDropdown = false;
  }

  onSearch() {
    const queryParams: any = { q: this.searchTerm };
    if (this.selectedCategorySlug) {
      this.router.navigate(['/category', this.selectedCategorySlug], { queryParams });
    } else {
      this.router.navigate(['/shop'], { queryParams });
    }
  }

  toggleLanguage() {
    Swal.fire({ title: 'Global Sourcing Matrix', text: 'Multi-lingual sourcing is being provisioned.', icon: 'info' });
  }

  getPortalUrl(): string {
    if (!this.authService.isAuthenticated()) return '/auth/login';
    return this.authService.isAdmin() ? '/admin/dashboard' : '/seller/dashboard';
  }

  private scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  get merchantPortalHref(): string {
    if (this.authService.isAuthenticated()) {
      return this.authService.isAdmin() ? '/admin/dashboard' : '/seller/dashboard';
    }
    return '/auth/login?returnUrl=%2Fseller%2Fdashboard';
  }

  openMerchantPortal(event: Event): void {
    event.preventDefault();
    this.router.navigateByUrl(this.merchantPortalHref);
  }
}
