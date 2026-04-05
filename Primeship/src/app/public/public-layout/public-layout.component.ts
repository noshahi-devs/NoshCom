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
      <header class="eliship-header" *ngIf="!isAuthPage">
        <div class="header-main-bar">
          <div class="container-header header-main-flex">
            <div class="logo-section">
              <a routerLink="/home" class="logo eliship-logo">
                <span class="logo-mark">E</span>
                <span class="logo-text">Eliship</span>
              </a>
            </div>

            <div class="search-section">
              <div class="search-box">
                <input type="text" [(ngModel)]="searchTerm" placeholder="Find anything home..." (keyup.enter)="onSearch()" />
                <button class="search-icon-btn" (click)="onSearch()"><i class="fas fa-search"></i></button>
              </div>
            </div>

            <div class="action-section">
               <a *ngIf="!authService.isAuthenticated()" routerLink="/auth/login" class="action-link">
                  <i class="far fa-user-circle"></i>
                  <span>Account</span>
               </a>
               <a routerLink="/cart" class="action-link cart-trigger">
                  <i class="fas fa-shopping-cart"></i>
                  <span>Cart</span>
                  <span class="badge" *ngIf="cartCount > 0">{{ cartCount }}</span>
               </a>
            </div>
          </div>
        </div>

        <div class="header-nav-bar">
          <div class="container-header nav-bar-inner">
            <div class="category-links">
              <a *ngFor="let cat of categoryNavLinks" [routerLink]="['/category', cat.slug]" class="category-link">{{ cat.label }}</a>
            </div>
          </div>
        </div>

        <div class="promo-bar">
          <div class="container-header promo-inner">
            <span>UP TO 70% OFF | 5 DAYS OF DEALS</span>
            <span class="promo-arrow">→</span>
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
    .search-icon-btn { position: relative; background: transparent; color: #444; border: none; font-size: 18px; cursor: pointer; &:hover { color: var(--primary); } }

    /* User Actions Section */
    .header-action-section { display: flex; align-items: center; gap: 20px; flex-shrink: 0; }
    .action-link { text-decoration: none; color: #FFF; font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 10px; transition: 0.2s; padding: 12px 14px; border-radius: 999px; background: rgba(255,255,255,0.08); }
    .action-link:hover { background: rgba(255,255,255,0.15); }
    .scale-12 { font-size: 1.3rem; }
    .cart-trigger { position: relative; .badge { position: absolute; top: -8px; right: -10px; background: var(--primary); color: #FFF; font-size: 11px; font-weight: 900; padding: 2px 6px; border-radius: 12px; line-height: 1; border: 2px solid var(--header-bg); } }

    .eliship-header { background: #FFF; }
    .header-brand-bar { background: #7B189F; color: #FFF; }
    .brand-bar-inner { display: flex; justify-content: space-between; align-items: center; gap: 18px; padding: 10px 0; flex-wrap: nowrap; }
    .brand-links, .utility-links { display: flex; flex-wrap: nowrap; gap: 24px; align-items: center; }
    .brand-link, .utility-link { color: #FFF; font-size: 12px; font-weight: 800; text-decoration: none; text-transform: uppercase; letter-spacing: 0.12em; white-space: nowrap; }
    .brand-link.active { opacity: 1; }
    .utility-link { opacity: 0.9; }
    .utility-link:hover { opacity: 1; }

    .header-main-bar { padding: 10px 0 12px; }
    .header-main-flex { display: grid; grid-template-columns: auto minmax(320px, 1fr) auto; align-items: center; gap: 32px; }
    .logo-section { flex-shrink: 0; margin-left: 40px; }
    .eliship-logo { display: inline-flex; align-items: center; gap: 12px; text-decoration: none; color: #7B189F; font-size: 28px; font-weight: 900; letter-spacing: -0.05em; }
    .logo-mark { width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center; border-radius: 16px; background: linear-gradient(135deg, #8d2ec3 0%, #7a127b 100%); color: #FFF; font-size: 18px; font-weight: 800; }
    .logo-text { letter-spacing: -0.8px; color: #7B189F; }

    .search-section { width: 100%; display: flex; align-items: center; justify-content: center; }
    .search-box { display: flex; width: 100%; max-width: 680px; height: 56px; border-radius: 10px; background: #FFF; border: 1px solid #D1D5DB; box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08); overflow: hidden; }
    .search-box input { flex: 1; border: none; padding: 0 28px; font-size: 16px; font-weight: 500; outline: none; color: #111827; }
    .search-box input::placeholder { color: #9CA3AF; }
    .search-icon-btn { width: 72px; border: none; background: #7B189F; color: #FFF; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 20px; border-radius: 0 10px 10px 0; padding: 0 12px; }
    .search-icon-btn:focus { outline: none; }

    .action-section { display: flex; align-items: center; gap: 16px; justify-content: flex-end; margin-right: 20px; }
    .action-link { text-decoration: none; color: #111827; font-weight: 700; font-size: 14px; display: inline-flex; align-items: center; gap: 10px; padding: 6px 10px; border-radius: 999px; background: transparent; }
    .action-link:hover { color: #7B189F; }
    .action-link i { color: #7B189F; font-size: 18px; }
    .cart-trigger { position: relative; }
    .cart-trigger .badge { position: absolute; top: -5px; right: -8px; background: #F43F5E; color: #FFF; font-size: 11px; font-weight: 900; padding: 2px 6px; border-radius: 12px; line-height: 1; border: 2px solid #FFF; }

    .category-links { display: flex; gap: 22px; flex-wrap: nowrap; overflow-x: auto; padding: 10px 0; align-items: center; }
    .category-link { color: #111827; font-size: 13px; font-weight: 700; text-decoration: none; white-space: nowrap; opacity: 0.92; transition: opacity 0.2s ease, color 0.2s ease; }
    .category-link:hover { color: #7B189F; opacity: 1; }
    .header-nav-bar { border-top: 1px solid #E5E7EB; border-bottom: 1px solid #E5E7EB; }
    .nav-bar-inner { overflow-x: auto; }

    .promo-bar { background: #7B189F; color: #FFF; }
    .promo-inner { display: flex; justify-content: center; align-items: center; gap: 10px; min-height: 44px; font-size: 13px; font-weight: 800; letter-spacing: 0.06em; }
    .promo-arrow { font-size: 18px; }

    .search-box::-webkit-scrollbar,
    .category-links::-webkit-scrollbar { display: none; }

    @media (max-width: 1200px) {
      .header-main-flex { grid-template-columns: auto 1fr auto; }
      .brand-bar-inner, .category-links { gap: 16px; }
      .search-box { max-width: 100%; }
    }

    @media (max-width: 992px) {
      .header-main-flex { grid-template-columns: 1fr; gap: 16px; }
      .action-section { justify-content: flex-start; width: 100%; }
      .search-box { max-width: 100%; }
    }

    @media (max-width: 768px) {
      .brand-bar-inner, .header-main-flex, .nav-bar-inner, .promo-inner { flex-wrap: wrap; justify-content: center; }
      .brand-links, .utility-links, .category-links { justify-content: center; gap: 12px; }
      .header-main-flex { grid-template-columns: 1fr; }
      .action-link { width: 100%; justify-content: center; }
    }

    @media (max-width: 1024px) {
      .brand-bar-inner,
      .header-main-flex,
      .nav-bar-inner,
      .promo-inner { flex-wrap: wrap; justify-content: center; }
      .search-box { min-width: 100%; }
      .category-links { justify-content: center; }
    }

    @media (max-width: 768px) {
      .brand-links, .utility-links, .category-links { gap: 12px; }
      .header-main-flex { flex-direction: column; align-items: stretch; }
      .action-section { justify-content: space-between; }
      .action-link { width: 100%; justify-content: center; }
    }

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

  categoryNavLinks = [
    { label: 'Furniture', slug: 'furniture' },
    { label: 'Outdoor', slug: 'outdoor' },
    { label: 'Bedding & Bath', slug: 'bedding-bath' },
    { label: 'Rugs', slug: 'rugs' },
    { label: 'Decor & Pillows', slug: 'decor-pillows' },
    { label: 'Lighting', slug: 'lighting' },
    { label: 'Organization', slug: 'organization' },
    { label: 'Kitchen', slug: 'kitchen' },
    { label: 'Baby & Kids', slug: 'baby-kids' },
    { label: 'Home Improvement', slug: 'home-improvement' },
    { label: 'Appliances', slug: 'appliances' },
    { label: 'Pet', slug: 'pet' },
    { label: 'Holiday', slug: 'holiday' },
    { label: 'Sale', slug: 'sale' }
  ];

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
