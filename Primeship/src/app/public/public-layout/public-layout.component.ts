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
    <div class="nosh-shell" (click)="closeOverlays()">
      <header class="eliship-header" *ngIf="!isAuthPage && !isCheckoutPage">
        <div class="marketing-banner">
          <div class="container-header marketing-inner">
            <div class="marketing-left">
              <div class="marketing-stores" aria-label="Stores">
                <a [routerLink]="['/shop']" [queryParams]="{ q: 'AllModern' }" class="marketing-store">AllModern</a>
                <a [routerLink]="['/shop']" [queryParams]="{ q: 'Birch Lane' }" class="marketing-store">Birch Lane</a>
                <a [routerLink]="['/shop']" [queryParams]="{ q: 'Joss & Main' }" class="marketing-store">Joss & Main</a>
                <a [routerLink]="['/shop']" [queryParams]="{ q: 'Perigold' }" class="marketing-store">Perigold</a>
              </div>
            </div>

            <div class="marketing-right" aria-label="Marketing links">
              <a routerLink="/rewards" class="marketing-action">Rewards</a>
              <a routerLink="/financing" class="marketing-action">Financing</a>
              <a href="#" class="marketing-action" (click)="openMerchantPortal($event)">Professional</a>
              <button type="button" class="free-ship-btn" (click)="showFreeShipping()">Fast & Free Shipping Over $35*</button>
            </div>
          </div>
        </div>

        <div class="header-main-bar">
          <div class="container-header header-main-flex">
            <div class="search-section">
              <div class="search-box">
                <input type="text" [(ngModel)]="searchTerm" placeholder="Find anything home..." (keyup.enter)="onSearch()" />
                <button class="search-icon-btn" (click)="onSearch()"><i class="fas fa-search"></i></button>
              </div>
            </div>

            <div class="action-section">
               <div class="account-wrap" (click)="$event.stopPropagation()">
                 <button type="button" class="action-link account-trigger" (click)="toggleAccountDropdown($event)">
                    <svg class="action-icon account-icon" viewBox="0 0 28 28" aria-hidden="true" focusable="false">
                      <path d="M14 4.5a9.5 9.5 0 109.5 9.5A9.51 9.51 0 0014 4.5zM9.26 21.05v-2.17a3.37 3.37 0 013.36-3.36h2.74a3.37 3.37 0 013.36 3.36v2.19a8.47 8.47 0 01-9.48 0zM14 14.5a2.5 2.5 0 112.5-2.5 2.5 2.5 0 01-2.5 2.5zm5.73 5.76v-1.38a4.37 4.37 0 00-3.44-4.26A3.45 3.45 0 0017.5 12a3.5 3.5 0 00-7 0 3.45 3.45 0 001.21 2.62 4.37 4.37 0 00-3.44 4.26v1.38a8.5 8.5 0 1111.46 0z"></path>
                    </svg>
                    <span>Account</span>
                 </button>

                 <div class="account-dropdown" *ngIf="showAccountDropdown" (click)="$event.stopPropagation()" role="menu" aria-label="Account menu">
                   <div class="account-dd-header">
                     Welcome, <span class="account-dd-name">{{ userName || 'Guest' }}</span>
                   </div>

                   <div class="account-dd-group">
                     <a routerLink="/account/profile" class="account-dd-item" role="menuitem" (click)="closeAccountDropdown()">
                       <i class="far fa-user"></i>
                       <span>My Account</span>
                     </a>
                     <a routerLink="/account/orders" class="account-dd-item" role="menuitem" (click)="closeAccountDropdown()">
                       <i class="fas fa-box"></i>
                       <span>My Orders</span>
                     </a>
                     <a routerLink="/wishlist" class="account-dd-item" role="menuitem" (click)="closeAccountDropdown()">
                       <i class="far fa-heart"></i>
                       <span>Lists</span>
                     </a>
                     <a routerLink="/account/reviews" class="account-dd-item" role="menuitem" (click)="closeAccountDropdown()">
                       <i class="far fa-star"></i>
                       <span>Review My Purchases</span>
                     </a>
                     <a routerLink="/account/recently-viewed" class="account-dd-item" role="menuitem" (click)="closeAccountDropdown()">
                       <i class="far fa-clock"></i>
                       <span>Recently Viewed</span>
                     </a>
                     <a routerLink="/contact-support" class="account-dd-item" role="menuitem" (click)="closeAccountDropdown()">
                       <i class="far fa-life-ring"></i>
                       <span>Help & Contact</span>
                     </a>

                     <div class="account-dd-footer">
                       <ng-container *ngIf="authService.isAuthenticated(); else signedOutCtas">
                         <span>On a public or shared device?</span>
                         <button type="button" class="account-dd-signout" (click)="signOut()">Sign Out</button>
                       </ng-container>
                       <ng-template #signedOutCtas>
                         <span>On a public or shared device?</span>
                         <div class="account-dd-ctas">
                           <a routerLink="/auth/login" class="account-dd-cta" (click)="closeAccountDropdown()">Sign In</a>
                         </div>
                       </ng-template>
                     </div>
                   </div>
                 </div>
                </div>

                <a routerLink="/cart" class="action-link cart-trigger" (click)="onCartClick($event)">
                   <svg class="action-icon" focusable="false" viewBox="2 2 24 24" aria-hidden="true">
                     <path d="M21 15.54a.51.51 0 00.49-.38l2-8a.51.51 0 00-.1-.43.49.49 0 00-.39-.19H8.28L8 4.9a.51.51 0 00-.49-.4H5a.5.5 0 000 1h2.05L9 15l-2.36 4.74a.53.53 0 000 .49.5.5 0 00.42.23H21a.5.5 0 00.5-.5.5.5 0 00-.5-.5H7.89l1.92-3.92zm1.34-8l-1.73 7H9.92l-1.43-7zM10 21a1 1 0 101 1 1 1 0 00-1-1zM18 21a1 1 0 101 1 1 1 0 00-1-1z"></path>
                   </svg>
                   <span>Cart</span>
                   <span class="badge" *ngIf="cartCount > 0">{{ cartCount }}</span>
                 </a>

                <div class="cart-modal-backdrop" *ngIf="showCartPopup" (click)="closeCartPopup()" aria-hidden="true"></div>
                <div class="cart-modal" *ngIf="showCartPopup" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-label="Cart popup">
                  <div class="cart-modal-header">
                    <div class="cart-modal-title">In Your Cart</div>
                    <button type="button" class="cart-modal-close" (click)="closeCartPopup()" aria-label="Close">×</button>
                  </div>
                  <div class="cart-modal-body">
                    <div class="cart-empty-title">Oh-no! Looks like your cart is empty.</div>
                    <div class="cart-empty-sub">Here are some options to get you started:</div>

                    <div class="cart-empty-options">
                      <button type="button" class="cart-empty-option" (click)="goToCartFromPopup()">
                        <span class="cart-empty-icon">
                          <i class="fas fa-shopping-cart"></i>
                        </span>
                        <span>View your saved items in <span class="cart-empty-link">Cart</span></span>
                      </button>

                      <button type="button" class="cart-empty-option" (click)="goToDailySalesFromPopup()">
                        <span class="cart-empty-icon">
                          <i class="fas fa-tag"></i>
                        </span>
                        <span>Start saving with <span class="cart-empty-link">Daily Sales</span></span>
                      </button>
                    </div>
                  </div>
                </div>
            </div>
          </div>
        </div>

        <div class="header-nav-bar">
          <div class="container-header nav-bar-inner">
            <div class="feature-links" aria-label="Primary navigation">
              <ng-container *ngFor="let link of headerFeatureLinks">
                <ng-container *ngIf="link.key === 'verified'; else collabOrStandard">
                  <div class="verified-pop-wrap" [class.open]="showVerifiedPopup">
                    <a
                      class="feature-link verified"
                      href="#"
                      (click)="toggleVerifiedPopup($event)"
                    >
                      <i *ngIf="link.icon" [class]="link.icon"></i>
                      {{ link.label }}
                    </a>
                    <div class="verified-popover" role="dialog" aria-label="Verified quick preview">
                      <div class="verified-pop-content">
                        <div class="verified-pop-intro">
                          <div class="verified-pop-badge">
                            <i class="fa-solid fa-shield-halved"></i>
                          </div>
                          <div class="verified-pop-title">Your shortcut to the good stuff.</div>
                          <div class="verified-pop-sub">
                            Verified items are hand‑vetted for quality by our product specialists.
                          </div>
                        </div>
                        <div class="verified-pop-grid">
                          <a
                            class="verified-pop-item"
                            *ngFor="let item of verifiedCategories"
                            [routerLink]="['/category', item.slug]"
                          >
                            <span
                              class="verified-pop-thumb"
                              [style.backgroundImage]="'url(' + item.image + ')'"
                            ></span>
                            <span class="verified-pop-label">{{ item.label }}</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </ng-container>
                <ng-template #collabOrStandard>
                  <a
                    *ngIf="!link.external"
                    [routerLink]="link.routerLink"
                    [queryParams]="link.queryParams"
                    class="feature-link"
                    (click)="handleFeatureLinkClick($event, link)"
                  >
                    <i *ngIf="link.icon" [class]="link.icon"></i>
                    {{ link.label }}
                  </a>
                  <a
                    *ngIf="link.external"
                    [href]="link.href"
                    class="feature-link"
                    [attr.target]="link.target || null"
                    [attr.rel]="link.target === '_blank' ? 'noopener noreferrer' : null"
                  >
                    <i *ngIf="link.icon" [class]="link.icon"></i>
                    {{ link.label }}
                  </a>
                </ng-template>
              </ng-container>
            </div>
            <div class="category-links">
              <ng-container *ngFor="let cat of categoryNavLinks">
                <ng-container *ngIf="getMegaMenu(cat.slug) as mega; else standardCategory">
                  <div class="mega-pop-wrap">
                    <a [routerLink]="['/category', cat.slug]" class="category-link mega-link">{{ cat.label }}</a>
                    <div class="mega-popover" role="dialog" aria-label="Category mega menu">
                      <div class="mega-pop-content">
                        <div class="mega-columns">
                          <div class="mega-col" *ngFor="let col of mega.columns">
                            <div class="mega-col-title">{{ col.title }}</div>
                            <a
                              class="mega-item"
                              *ngFor="let item of col.items"
                              [routerLink]="item.link"
                              [queryParams]="item.queryParams || null"
                            >
                              <span class="mega-item-thumb" aria-hidden="true">
                                <img
                                  [src]="item.thumb"
                                  [alt]="item.label"
                                  loading="lazy"
                                  decoding="async"
                                  (error)="onMegaThumbError($event)"
                                />
                              </span>
                              <span class="mega-item-label">{{ item.label }}</span>
                            </a>
                          </div>
                        </div>
                        <div class="mega-side">
                          <div class="mega-side-group" *ngFor="let group of mega.side">
                            <div class="mega-side-title">{{ group.title }}</div>
                            <a
                              class="mega-item"
                              *ngFor="let item of group.items"
                              [routerLink]="item.link"
                              [queryParams]="item.queryParams || null"
                            >
                              <span class="mega-item-thumb" aria-hidden="true">
                                <img
                                  [src]="item.thumb"
                                  [alt]="item.label"
                                  loading="lazy"
                                  decoding="async"
                                  (error)="onMegaThumbError($event)"
                                />
                              </span>
                              <span class="mega-item-label">{{ item.label }}</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </ng-container>
                <ng-template #standardCategory>
                  <a [routerLink]="['/category', cat.slug]" class="category-link">{{ cat.label }}</a>
                </ng-template>
              </ng-container>
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

      <section class="promo-carousel" *ngIf="showPromoCarousel && !isAuthPage && !isHomePage && !isShopPage" (click)="$event.stopPropagation()" aria-label="Promotions carousel">
        <div class="promo-carousel-inner">
          <button type="button" class="promo-carousel-nav prev" (click)="prevPromo($event)" aria-label="Previous promotion">
            <span class="promo-carousel-nav-ico" aria-hidden="true">
              <svg focusable="false" viewBox="0 0 24 24" role="img" aria-label="Previous Slide">
                <title>Previous Slide</title>
                <path d="M9.5 4.5c.13 0 .26.05.35.15l7 7c.2.2.2.51 0 .71l-7 7c-.2.2-.51.2-.71 0s-.2-.51 0-.71L15.79 12 9.14 5.35c-.2-.2-.2-.51 0-.71.1-.1.23-.15.35-.15z"></path>
              </svg>
            </span>
          </button>

          <div class="promo-carousel-viewport">
            <div class="promo-carousel-track" [style.transform]="'translateX(-' + (promoIndex * 100) + '%)'">
              <a
                *ngFor="let slide of promoSlides; let i = index"
                class="promo-carousel-slide"
                [class.active]="i === promoIndex"
                [routerLink]="slide.routerLink"
                [queryParams]="slide.queryParams"
              >
                <ng-container *ngIf="slide.video; else promoImage">
                  <video class="promo-carousel-media" autoplay muted loop playsinline preload="metadata" [attr.poster]="slide.poster || null">
                    <source [src]="slide.video" type="video/mp4" />
                  </video>
                </ng-container>
                <ng-template #promoImage>
                  <img class="promo-carousel-media" [src]="slide.image" [alt]="slide.alt" loading="lazy" />
                </ng-template>
              </a>
            </div>
          </div>

          <button type="button" class="promo-carousel-nav next" (click)="nextPromo($event)" aria-label="Next promotion">
            <span class="promo-carousel-nav-ico" aria-hidden="true">
              <svg focusable="false" viewBox="0 0 24 24" role="img" aria-label="Next Slide">
                <title>Next Slide</title>
                <path d="M9.5 4.5c.13 0 .26.05.35.15l7 7c.2.2.2.51 0 .71l-7 7c-.2.2-.51.2-.71 0s-.2-.51 0-.71L15.79 12 9.14 5.35c-.2-.2-.2-.51 0-.71.1-.1.23-.15.35-.15z"></path>
              </svg>
            </span>
          </button>

          <div class="promo-carousel-dots" aria-hidden="true">
            <button
              type="button"
              class="promo-carousel-dot"
              *ngFor="let _ of promoSlides; let i = index"
              [class.active]="i === promoIndex"
              (click)="goToPromo(i, $event)"
            ></button>
          </div>
        </div>
      </section>

      <!-- Content Area -->
      <main class="nosh-main">
        <router-outlet></router-outlet>
      </main>

      <!-- Floating Help Widget -->
      <div class="help-fab-wrap" *ngIf="!isAuthPage" (click)="$event.stopPropagation()">
        <button type="button" class="help-fab" (click)="toggleHelpWidget($event)" aria-label="Help">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" class="help-fab-ico">
            <path d="M8 10.5h8M8 13.5h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            <path d="M20 12a7 7 0 0 1-7 7H9l-3.2 2.2a.7.7 0 0 1-1.1-.6V19A7 7 0 1 1 20 12Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
          </svg>
        </button>

        <div class="help-popover" *ngIf="showHelpWidget" role="dialog" aria-label="Help" (click)="$event.stopPropagation()">
          <div class="help-popover-top">
            <div class="help-popover-title">Help</div>
            <button type="button" class="help-popover-close" aria-label="Close" (click)="closeHelpWidget($event)">×</button>
          </div>

          <div class="help-popover-body">
            <div class="help-popover-headline">We're here to help.</div>
            <div class="help-popover-sub">How can we assist you today?</div>

            <div class="help-popover-actions">
              <button type="button" class="help-popover-pill" (click)="goToLiveShopping($event)">Live Shopping Assistance</button>
              <button type="button" class="help-popover-pill" (click)="goToCustomerService($event)">Customer Service Help</button>
            </div>

            <div class="help-popover-sep"></div>

            <div class="help-popover-links">
              <a routerLink="/account/orders" (click)="closeHelpWidget($event)">My Orders</a>
              <a routerLink="/contact-support" (click)="closeHelpWidget($event)">Help Center</a>
            </div>
          </div>
        </div>
      </div>

      <!-- Global Eliship Footer -->
      <footer class="wf-footer" *ngIf="!isAuthPage">
        <hr class="wf-footer-hr" />

        <div class="wf-footer-wrap">
          <div class="container-footer wf-footer-inner">
            <section class="wf-footer-grid" aria-label="Footer navigation">
              <section class="wf-footer-col">
                <h2 class="wf-footer-title">About Us</h2>
                <ul class="wf-footer-list">
                  <li><a routerLink="/about-us">About Eliship</a></li>
                  <li><a routerLink="/rewards">Eliship Rewards</a></li>
                  <li><a href="#" (click)="openMerchantPortal($event)">Eliship Professional</a></li>
                  <li><a routerLink="/design-services">Design Services</a></li>
                  <li><a routerLink="/gift-card">Gift Cards</a></li>
                  <li><a routerLink="/cash-registry">Eliship Cash Registry</a></li>
                  <li><a routerLink="/credit-card">Eliship Credit Card</a></li>
                  <li><a routerLink="/financing">Eliship Financing</a></li>
                  <li><a routerLink="/shop" [queryParams]="{ sortBy: 'newest' }">New Arrivals</a></li>
                  <li><a routerLink="/shop" [queryParams]="{ sortBy: 'chart' }">Best Sellers</a></li>
                  <li><a routerLink="/collaborations">Collaborations</a></li>
                  <li><a routerLink="/verified">Verified</a></li>
                </ul>
              </section>

              <section class="wf-footer-col">
                <h2 class="wf-footer-title">Customer Service</h2>
                <ul class="wf-footer-list">
                  <li><a routerLink="/account/orders">My Orders</a></li>
                  <li><a routerLink="/account/profile">My Account</a></li>
                  <li><a routerLink="/track-order">Track My Order</a></li>
                  <li><a routerLink="/returns-policy">Return Policy</a></li>
                  <li><a routerLink="/contact-support">Help Center</a></li>
                  <li><a routerLink="/inspiration">Ideas & Advice</a></li>
                  <li><a routerLink="/services">Services</a></li>
                </ul>
              </section>

              <section class="wf-footer-col">
                <h2 class="wf-footer-title">Contact Us</h2>

                <div class="wf-contact-actions">
                  <button type="button" class="wf-contact-btn" (click)="goQuickHelp()">
                    <span class="wf-contact-ico"><i class="far fa-clock"></i></span>
                    <span>Quick Help</span>
                  </button>
                  <button type="button" class="wf-contact-btn" (click)="showCallUs()">
                    <span class="wf-contact-ico"><i class="fas fa-phone-alt"></i></span>
                    <span>Call Us</span>
                  </button>
                </div>

                <div class="wf-hours-block">
                  <h3 class="wf-hours-title">Customer Service</h3>
                  <p class="wf-hours-text">Open. Closes at 10:00 PM PKT.</p>
                  <button type="button" class="wf-hours-btn" (click)="showWeeklyHours('Customer Service')">Weekly Hours</button>
                </div>

                <div class="wf-hours-block">
                  <h3 class="wf-hours-title">Shopping Assistance</h3>
                  <p class="wf-hours-text">Open. Closes at 6:00 PM PKT.</p>
                  <button type="button" class="wf-hours-btn" (click)="showWeeklyHours('Shopping Assistance')">Weekly Hours</button>
                </div>
              </section>
            </section>

            <div class="wf-footer-bottom" aria-label="Footer bottom">
              <div class="wf-footer-copy">Copyright © 2026 Eliship. All rights reserved.</div>
              <div class="wf-footer-social">
                <a href="#" aria-label="Facebook"><i class="fab fa-facebook-f"></i></a>
                <a href="#" aria-label="Twitter"><i class="fab fa-twitter"></i></a>
                <a href="#" aria-label="Instagram"><i class="fab fa-instagram"></i></a>
                <a href="#" aria-label="YouTube"><i class="fab fa-youtube"></i></a>
                <a href="#" aria-label="LinkedIn"><i class="fab fa-linkedin-in"></i></a>
              </div>
              <div class="wf-footer-pay">
                <i class="fab fa-cc-mastercard"></i>
                <i class="fab fa-cc-visa"></i>
                <span class="ssl-badge"><i class="fa-solid fa-shield-halved"></i> 256 Bit SSL Encryption</span>
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

    .marketing-banner { background: #10B981; color: #FFF; }
    .marketing-inner { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 6px 32px; flex-wrap: nowrap; line-height: 1; }
    .marketing-left { display: flex; align-items: center; gap: 12px; min-width: 0; }

    .marketing-stores {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: nowrap;
      overflow: hidden;
      scrollbar-width: none;
      -ms-overflow-style: none;
    }
    .marketing-stores::-webkit-scrollbar { display: none; }
    .marketing-store { color: #FFF; text-decoration: none; font-size: 12px; font-weight: 500; white-space: nowrap; opacity: 0.95; border-bottom: 1px solid transparent; }
    .marketing-store:hover { opacity: 1; border-bottom-color: rgba(255,255,255,0.75); }

    .marketing-right { display: flex; align-items: center; gap: 0; flex: 0 0 auto; }
    .marketing-right > * { padding: 0 9px; }
    .marketing-right > *:not(:first-child) { border-left: 1px solid rgba(255,255,255,0.55); }

    .marketing-action { color: #FFF; text-decoration: none; font-size: 12px; font-weight: 500; white-space: nowrap; border-bottom: none; }
    .marketing-action:hover { opacity: 0.95; }
    .free-ship-btn { border: none; background: transparent; color: #FFF; font-size: 12px; font-weight: 500; cursor: pointer; padding: 0; text-decoration: none; white-space: nowrap; }

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
    .header-brand-bar { background: #10B981; color: #FFF; }
    .brand-bar-inner { display: flex; justify-content: space-between; align-items: center; gap: 18px; padding: 10px 0; flex-wrap: nowrap; }
    .brand-links, .utility-links { display: flex; flex-wrap: nowrap; gap: 24px; align-items: center; }
    .brand-link, .utility-link { color: #FFF; font-size: 12px; font-weight: 800; text-decoration: none; text-transform: uppercase; letter-spacing: 0.12em; white-space: nowrap; }
    .brand-link.active { opacity: 1; }
    .utility-link { opacity: 0.9; }
    .utility-link:hover { opacity: 1; }

    .header-main-bar { padding: 6px 0 8px; }
    .header-main-flex { display: grid; grid-template-columns: minmax(320px, 1fr) auto; align-items: center; gap: 22px; }

    .search-section { width: 100%; display: flex; align-items: center; justify-content: center; }
    .search-box { display: flex; width: 100%; max-width: 700px; height: 52px; border-radius: 10px; background: #FFF; border: 1px solid #D1D5DB; box-shadow: 0 6px 14px rgba(15, 23, 42, 0.07); overflow: hidden; }
    .search-box input { flex: 1; border: none; padding: 0 22px; font-size: 15px; font-weight: 500; outline: none; color: #111827; }
    .search-box input::placeholder { color: #9CA3AF; }
    .search-icon-btn { width: 64px; border: none; background: #10B981; color: #FFF; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 18px; border-radius: 0 10px 10px 0; padding: 0 10px; }
    .search-icon-btn:focus { outline: none; }

    .action-section { display: flex; align-items: center; gap: 12px; justify-content: flex-end; margin-right: 10px; }
    .action-link { text-decoration: none; color: #111827; font-weight: 600; font-size: 14px; display: inline-flex; align-items: center; gap: 10px; padding: 6px 10px; border-radius: 999px; background: transparent; border: none; cursor: pointer; font-family: inherit; }
    .action-link:hover { color: #10B981; }
    .action-icon { width: 26px; height: 26px; display: inline-block; flex: 0 0 auto; fill: #10B981; color: #10B981; stroke: #10B981; }
    .account-icon { width: 32px; height: 32px; }
    .account-wrap { position: relative; display: inline-flex; align-items: center; }
    .account-trigger { user-select: none; }

    .account-dropdown {
      position: absolute;
      top: calc(100% + 10px);
      right: 0;
      width: 290px;
      background: #FFF;
      border: 1px solid #E5E7EB;
      border-radius: 12px;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
      padding: 10px;
      z-index: 2400;
      max-height: min(70vh, 520px);
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    .account-dd-header { font-size: 18px; font-weight: 700; padding: 10px 10px 12px; color: #111827; border-bottom: 1px solid #E5E7EB; }
    .account-dd-name { font-weight: 800; }
    .account-dd-group { padding: 6px 2px 2px; display: grid; gap: 2px; }
    .account-dd-item { width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px 10px; border-radius: 10px; color: #111827; text-decoration: none; font-size: 14px; font-weight: 600; background: transparent; border: none; cursor: pointer; text-align: left; font-family: inherit; line-height: 1.3; }
    .account-dd-item i { width: 18px; text-align: center; color: #10B981; opacity: 0.9; font-size: 15px; }
    .account-dd-item:hover { background: #F3F4F6; }

    .account-dropdown::-webkit-scrollbar { width: 6px; }
    .account-dropdown::-webkit-scrollbar-track { background: transparent; }
    .account-dropdown::-webkit-scrollbar-thumb { background: #10B981; border-radius: 999px; }
    .account-dropdown::-webkit-scrollbar-thumb:hover { background: #059669; }
    .account-dropdown { scrollbar-width: thin; scrollbar-color: #10B981 transparent; }
    .account-dd-sep { height: 1px; background: #E5E7EB; margin: 8px 8px; }
    .account-dd-footer { border-top: 1px solid #E5E7EB; margin-top: 10px; padding: 10px 10px 6px; font-size: 12px; color: #6B7280; display: flex; align-items: center; justify-content: flex-start; gap: 6px; }
    .account-dd-footer > span { flex: 0 1 auto; }
    .account-dd-signout { border: none; background: transparent; color: #111827; font-weight: 700; cursor: pointer; padding: 0; text-decoration: underline; }
    .account-dd-ctas { display: inline-flex; gap: 10px; align-items: center; flex: 0 0 auto; }
    .account-dd-cta { color: #111827; font-weight: 800; text-decoration: underline; cursor: pointer; white-space: nowrap; }

    .cart-trigger { position: relative; }
    .cart-trigger .badge { position: absolute; top: -5px; right: -8px; background: #F43F5E; color: #FFF; font-size: 11px; font-weight: 900; padding: 2px 6px; border-radius: 12px; line-height: 1; border: 2px solid #FFF; }

    .cart-modal-backdrop { position: fixed; inset: 0; background: rgba(17, 24, 39, 0.35); z-index: 2500; }
    .cart-modal { position: fixed; top: 110px; right: 24px; width: 420px; max-width: calc(100vw - 32px); background: #FFF; border: 1px solid #E5E7EB; border-radius: 14px; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22); z-index: 2600; overflow: hidden; }
    .cart-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #E5E7EB; }
    .cart-modal-title { font-weight: 900; font-size: 20px; color: #111827; }
    .cart-modal-close { border: none; background: transparent; font-size: 22px; line-height: 1; cursor: pointer; color: #6B7280; padding: 0 6px; }
    .cart-modal-close:hover { color: #111827; }
    .cart-modal-body { padding: 16px; }
    .cart-empty-title { font-size: 22px; font-weight: 900; color: #111827; margin: 8px 0 6px; }
    .cart-empty-sub { color: #4B5563; font-weight: 600; margin-bottom: 14px; }
    .cart-empty-options { display: grid; gap: 10px; }
    .cart-empty-option { width: 100%; display: flex; align-items: center; gap: 12px; padding: 12px 12px; border: 1px solid #E5E7EB; border-radius: 12px; background: #FFF; cursor: pointer; text-align: left; font-weight: 700; color: #111827; }
    .cart-empty-option:hover { background: #F9FAFB; border-color: #D1D5DB; }
    .cart-empty-icon { width: 40px; height: 40px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; background: rgba(16, 185, 129, 0.12); color: #10B981; flex: 0 0 auto; }
    .cart-empty-icon i { font-size: 18px; }
    .cart-empty-link { color: #10B981; text-decoration: underline; }

    .category-links { display: flex; gap: 22px; flex-wrap: nowrap; overflow-x: auto; padding: 10px 0; align-items: center; justify-content: center; width: 100%; }
    .category-link { color: #111827; font-size: 13px; font-weight: 700; text-decoration: none; white-space: nowrap; opacity: 0.92; transition: opacity 0.2s ease, color 0.2s ease; }
    .category-link:hover { color: #10B981; opacity: 1; text-decoration: none; }

    .feature-links { display: flex; gap: 16px; flex-wrap: wrap; overflow: visible; padding: 6px 0; align-items: center; justify-content: center; width: 100%; border-bottom: 1px solid #34D399; }
    .feature-link { color: #111827; font-size: 12px; font-weight: 500; text-decoration: none; white-space: nowrap; opacity: 0.95; transition: opacity 0.2s ease, color 0.2s ease; display: inline-flex; align-items: center; gap: 6px; }
    .feature-link:hover { color: #10B981; opacity: 1; text-decoration: none; }
    .feature-link.verified { color: #10B981; }
    .feature-link i { font-size: 13px; }

    .verified-pop-wrap { position: relative; display: inline-flex; align-items: center; }
    .verified-pop-wrap::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 100%;
      height: 12px;
    }
    .verified-popover {
      position: absolute;
      top: calc(100% + 12px);
      left: 0;
      right: auto;
      transform: translateY(8px);
      width: min(760px, calc(100vw - 48px));
      max-height: none;
      overflow: visible;
      background: #FFF;
      border: 1px solid #34D399;
      border-radius: 18px;
      padding: 16px;
      box-shadow: 0 24px 60px rgba(16, 185, 129, 0.25);
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s ease;
      z-index: 2200;
    }

    .verified-pop-wrap.open .verified-popover,
    .verified-popover:hover {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
      transform: translateY(0);
    }

    .verified-pop-content { display: grid; grid-template-columns: 280px 1fr; gap: 18px; }
    .verified-pop-intro {
      background: #FFF;
      border: 1px solid #34D399;
      border-radius: 14px;
      padding: 16px;
      display: grid;
      gap: 10px;
      text-align: center;
      align-content: start;
    }
    .verified-pop-badge {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #10B981;
      color: #FFF;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto;
      font-size: 18px;
    }
    .verified-pop-title { font-size: 18px; font-weight: 900; color: #10B981; }
    .verified-pop-sub { font-size: 12px; font-weight: 600; color: #059669; line-height: 1.4; }
    .verified-pop-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 14px;
      border-radius: 999px;
      background: #10B981;
      color: #FFF;
      text-decoration: none;
      font-size: 12px;
      font-weight: 800;
      border: 1px solid #059669;
      margin-top: 4px;
    }

    .verified-pop-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .verified-pop-item {
      display: grid;
      gap: 8px;
      padding: 8px;
      border-radius: 12px;
      border: 1px solid #34D399;
      text-decoration: none;
      color: #059669;
      font-size: 12px;
      font-weight: 800;
      text-transform: lowercase;
      background: #FFF;
    }
    .verified-pop-thumb {
      width: 100%;
      height: 78px;
      border-radius: 10px;
      background-size: cover;
      background-position: center;
      box-shadow: 0 10px 20px rgba(16, 185, 129, 0.18);
    }
    .verified-pop-label { text-align: center; text-transform: capitalize; }
    .verified-pop-cta {
      align-items: center;
      justify-content: center;
      text-align: center;
      border-style: dashed;
      color: #10B981;
    }

    @media (max-width: 920px) {
      .verified-pop-content { grid-template-columns: 1fr; }
      .verified-pop-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (max-width: 640px) {
      .verified-popover { display: none; }
    }

    /* Hard-disable old Services popover if any cached markup exists */
    .services-popover { display: none !important; }

    @media (min-width: 900px) {
      .nav-bar-inner { overflow: visible; }
      .feature-links { overflow: visible; flex-wrap: wrap; }
    }
    .header-nav-bar { border-top: 1px solid #34D399; border-bottom: 1px solid #34D399; position: relative; z-index: 2100; overflow: visible; }
    .nav-bar-inner { overflow: visible; }
    .category-links { overflow: visible; position: relative; }

    .mega-pop-wrap { position: static; display: inline-flex; align-items: center; }
    .mega-pop-wrap::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 100%;
      height: 14px;
    }
    .mega-popover {
      position: absolute;
      top: calc(100% + 14px);
      left: 0;
      width: min(1320px, calc(100vw - 28px));
      background: #fff;
      border: 1px solid rgba(16,185,129,0.35);
      border-radius: 22px;
      padding: 24px 26px;
      box-shadow: 0 28px 60px rgba(15, 23, 42, 0.2);
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transform: translateY(8px);
      transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s ease;
      z-index: 2200;
    }
    .mega-pop-wrap:hover .mega-popover,
    .mega-popover:hover {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
      transform: translateY(0);
    }
    .mega-pop-content { display: grid; grid-template-columns: 1.15fr 0.95fr; gap: 0; }
    .mega-columns { display: grid; grid-template-columns: repeat(4, minmax(170px, 1fr)); gap: 0; padding-right: 24px; }
    .mega-col { padding: 0 18px; }
    .mega-col:first-child { padding-left: 0; }
    .mega-col:last-child { padding-right: 0; }
    .mega-col + .mega-col { border-left: 1px solid rgba(17, 24, 39, 0.10); }
    .mega-col-title { font-weight: 900; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #0F766E; margin-bottom: 12px; }
    .mega-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      font-size: 14px;
      font-weight: 700;
      color: #111827;
      text-decoration: none;
      padding: 8px 10px;
      margin: 0 -10px;
      border-radius: 12px;
      transition: background 0.18s ease, color 0.18s ease;
    }
    .mega-item:hover { color: #10B981; background: rgba(16,185,129,0.08); }
    .mega-item.hot { color: #10B981; font-weight: 800; }

    .mega-item-thumb {
      width: 40px;
      height: 40px;
      border-radius: 12px;
      overflow: hidden;
      flex: 0 0 auto;
      background: #F3F4F6;
      border: 1px solid rgba(16,185,129,0.22);
      box-shadow: 0 8px 16px rgba(15, 23, 42, 0.08);
      margin-top: 1px;
      transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
    }

    .mega-item-thumb img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }

    .mega-item-label {
      min-width: 0;
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .mega-item:hover .mega-item-thumb {
      border-color: rgba(16,185,129,0.55);
      box-shadow: 0 12px 22px rgba(16,185,129,0.14);
      transform: translateY(-1px);
    }

    .mega-item.hot .mega-item-thumb { border-color: rgba(16,185,129,0.55); }
    .mega-side { display: grid; grid-template-columns: repeat(2, minmax(170px, 1fr)); gap: 0; align-content: start; padding-left: 24px; border-left: 1px solid rgba(17, 24, 39, 0.10); }
    .mega-side-group { display: grid; gap: 8px; align-content: start; padding: 0 18px; }
    .mega-side-group:first-child { padding-left: 0; }
    .mega-side-group:last-child { padding-right: 0; }
    .mega-side-group + .mega-side-group { border-left: 1px solid rgba(17, 24, 39, 0.10); }
    .mega-side-title { font-weight: 900; font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #0F766E; margin-bottom: 8px; }

    @media (max-width: 1024px) {
      .mega-popover { width: min(980px, calc(100vw - 24px)); }
      .mega-pop-content { grid-template-columns: 1fr; }
      .mega-columns { padding-right: 0; }
      .mega-side { padding-left: 0; border-left: none; margin-top: 14px; }
    }
    @media (max-width: 820px) {
      .mega-popover { display: none; }
    }

    .promo-bar { background: #10B981; color: #FFF; }
    .promo-inner { display: flex; justify-content: center; align-items: center; gap: 8px; min-height: 34px; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; line-height: 1; }
    .promo-arrow { font-size: 15px; }

    .promo-carousel { background: #FFF; border-bottom: 1px solid #E5E7EB; }
    .promo-carousel-inner { position: relative; width: 100%; margin: 0; padding: 0; }
    .promo-carousel-viewport { border-radius: 0; overflow: hidden; border-top: 1px solid #E5E7EB; border-bottom: 1px solid #E5E7EB; background: #111827; }
    .promo-carousel-track { display: flex; width: 100%; transition: transform 420ms ease; }
    .promo-carousel-slide { min-width: 100%; height: 340px; position: relative; display: block; text-decoration: none; color: inherit; }
    .promo-carousel-media { width: 100%; height: 100%; object-fit: cover; display: block; }
    .promo-carousel-overlay { position: absolute; inset: 0; display: flex; align-items: center; padding: 18px 18px; background: linear-gradient(90deg, rgba(17, 24, 39, 0.58) 0%, rgba(17, 24, 39, 0.14) 60%, rgba(17, 24, 39, 0) 100%); }
    .promo-carousel-text { max-width: 520px; color: #FFF; }
    .promo-carousel-kicker { font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.92; margin-bottom: 6px; }
    .promo-carousel-title { font-size: 30px; font-weight: 900; line-height: 1.05; margin-bottom: 10px; }
    .promo-carousel-cta { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 999px; background: rgba(255,255,255,0.95); color: #111827; font-size: 12px; font-weight: 900; width: fit-content; }

    .promo-carousel-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 44px; height: 44px; border-radius: 999px; border: 1px solid #E5E7EB; background: rgba(255, 255, 255, 0.98); color: #111827; cursor: pointer; z-index: 2; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 10px 22px rgba(15, 23, 42, 0.18); }
    .promo-carousel-nav:hover { background: #FFF; }
    .promo-carousel-nav.prev { left: 14px; }
    .promo-carousel-nav.next { right: 14px; }
    .promo-carousel-nav-ico { display: inline-flex; align-items: center; justify-content: center; }
    .promo-carousel-nav-ico svg { width: 22px; height: 22px; display: block; fill: currentColor; }
    .promo-carousel-nav.prev svg { transform: rotate(180deg); }

    .promo-carousel-dots { display: inline-flex; gap: 6px; justify-content: center; width: 100%; padding: 12px 0 16px; }
    .promo-carousel-dot { width: 8px; height: 8px; border-radius: 999px; border: none; background: #D1D5DB; cursor: pointer; }
    .promo-carousel-dot.active { background: #10B981; width: 18px; }

    .search-box::-webkit-scrollbar,
    .feature-links::-webkit-scrollbar,
    .category-links::-webkit-scrollbar { display: none; }

    @media (max-width: 1200px) {
      .header-main-flex { grid-template-columns: 1fr auto; }
      .brand-bar-inner, .category-links { gap: 16px; }
      .search-box { max-width: 100%; }
    }

    @media (max-width: 992px) {
      .header-main-flex { grid-template-columns: 1fr; gap: 16px; }
      .action-section { justify-content: flex-start; width: 100%; }
      .search-box { max-width: 100%; }
      .marketing-inner { flex-wrap: wrap; justify-content: center; }
      .marketing-right { flex-wrap: wrap; justify-content: center; }
    }

    @media (max-width: 768px) {
      .brand-bar-inner, .header-main-flex, .nav-bar-inner, .promo-inner { flex-wrap: wrap; justify-content: center; }
      .brand-links, .utility-links, .category-links { justify-content: center; gap: 12px; }
      .header-main-flex { grid-template-columns: 1fr; }
      .action-link { width: 100%; justify-content: center; }
      .marketing-inner { padding-left: 16px; padding-right: 16px; }
      .promo-carousel-slide { height: 240px; }
      .promo-carousel-title { font-size: 22px; }
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

    /* Wayfair-style Footer */
    .wf-footer { margin-top: auto; background: #F9FAFB; color: #111827; }
    .wf-footer-hr { border: none; border-top: 1px solid #E5E7EB; margin: 0; }
    .wf-footer-wrap { background: #F9FAFB; }
    .wf-footer-inner { padding: 26px 20px 22px; }

    .wf-footer-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px; align-items: start; }
    .wf-footer-col { min-width: 0; }
    .wf-footer-title { margin: 0 0 12px; font-size: 20px; font-weight: 900; color: #111827; }
    .wf-footer-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
    .wf-footer-list a { color: #111827; text-decoration: none; font-size: 12px; font-weight: 600; transition: color 0.2s ease, opacity 0.2s ease; }
    .wf-footer-list a:hover { color: #10B981; text-decoration: none; opacity: 1; }

    .wf-contact-actions { display: grid; justify-items: start; gap: 8px; margin-bottom: 12px; }
    .wf-contact-btn { width: min(190px, 100%); border: 2px solid #E5E7EB; background: #FFF; border-radius: 10px; padding: 8px 10px; min-height: 56px; box-sizing: border-box; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; color: #111827; font-weight: 600; font-size: 12px; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease; }
    .wf-contact-btn:hover { background: #10B981; border-color: #10B981; color: #FFFFFF; box-shadow: 0 14px 26px rgba(16,185,129,0.22); transform: translateY(-1px); }
    .wf-contact-btn:hover .wf-contact-ico { background: rgba(255,255,255,0.18); border-color: rgba(255,255,255,0.30); }
    .wf-contact-btn:hover .wf-contact-ico i { color: #FFFFFF; }
    .wf-contact-ico { width: 24px; height: 24px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; background: rgba(16, 185, 129, 0.10); border: 1px solid rgba(16,185,129,0.22); color: #10B981; flex: 0 0 auto; }

    .wf-hours-block { margin-top: 14px; }
    .wf-hours-title { margin: 0 0 6px; font-size: 14px; font-weight: 900; color: #111827; }
    .wf-hours-text { margin: 0 0 8px; color: #6B7280; font-size: 12px; font-weight: 600; }
    .wf-hours-btn { border: 1px solid #E5E7EB; background: #FFF; border-radius: 999px; padding: 8px 12px; font-weight: 800; font-size: 11px; cursor: pointer; color: #111827; transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease; }
    .wf-hours-btn:hover { background: #10B981; border-color: #10B981; color: #FFFFFF; box-shadow: 0 14px 22px rgba(16,185,129,0.18); }

    .wf-footer-bottom { margin-top: 22px; padding-top: 16px; border-top: 1px solid #E5E7EB; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .wf-footer-copy { color: #6B7280; font-size: 12px; font-weight: 700; }
    .wf-footer-social { display: inline-flex; align-items: center; gap: 8px; }
    .wf-footer-social a { color: #065F46; background: #ECFDF5; border: 1px solid rgba(16,185,129,0.35); width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%; transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease; }
    .wf-footer-social a:hover { background: #10B981; border-color: #10B981; color: #FFF; transform: translateY(-1px); box-shadow: 0 10px 18px rgba(16,185,129,0.18); }
    .wf-footer-pay { display: inline-flex; align-items: center; gap: 12px; font-size: 22px; color: #111827; }
    .wf-footer-pay > i { color: #10B981; }
    .ssl-badge { display: inline-flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 900; color: #065F46; background: #ECFDF5; border: 1px solid rgba(16,185,129,0.35); padding: 6px 10px; border-radius: 999px; }
    .ssl-badge i { color: #10B981; font-size: 14px; }

    /* Floating Help */
    .help-fab-wrap { position: fixed; right: 24px; bottom: 24px; z-index: 2700; }
    .help-fab { width: 52px; height: 52px; border-radius: 999px; border: 2px solid #10B981; background: #FFF; color: #10B981; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 18px 36px rgba(15, 23, 42, 0.18); }
    .help-fab:hover { background: rgba(16, 185, 129, 0.06); }
    .help-fab-ico { width: 26px; height: 26px; display: block; }

    .help-popover { position: absolute; right: 0; bottom: 66px; width: 320px; max-width: calc(100vw - 32px); background: #FFF; border: 1px solid #E5E7EB; border-radius: 14px; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22); overflow: hidden; }
    .help-popover-top { display: flex; align-items: center; justify-content: center; padding: 12px 12px; border-bottom: 1px solid #E5E7EB; position: relative; }
    .help-popover-title { font-weight: 900; color: #111827; }
    .help-popover-close { position: absolute; right: 10px; top: 8px; border: none; background: transparent; font-size: 22px; line-height: 1; cursor: pointer; color: #6B7280; padding: 4px 6px; }
    .help-popover-close:hover { color: #111827; }

    .help-popover-body { padding: 18px 18px 16px; }
    .help-popover-headline { font-size: 20px; font-weight: 900; color: #111827; margin-bottom: 2px; }
    .help-popover-sub { color: #111827; font-weight: 600; opacity: 0.9; margin-bottom: 14px; }

    .help-popover-actions { display: grid; gap: 12px; margin-bottom: 14px; }
    .help-popover-pill { width: fit-content; max-width: 100%; border: 2px solid #10B981; background: #FFF; color: #10B981; border-radius: 999px; padding: 10px 16px; font-weight: 800; cursor: pointer; }
    .help-popover-pill:hover { background: rgba(16, 185, 129, 0.06); }

    .help-popover-sep { height: 1px; background: #E5E7EB; margin: 14px 0 12px; }
    .help-popover-links { display: grid; gap: 10px; }
    .help-popover-links a { color: #10B981; font-weight: 800; text-decoration: underline; cursor: pointer; }

    @media (max-width: 1024px) {
      .wf-footer-grid { grid-template-columns: 1fr; }
      .wf-footer-bottom { justify-content: center; text-align: center; }
    }

    @media (max-width: 768px) {
      .help-fab-wrap { right: 14px; bottom: 14px; }
      .help-popover { bottom: 62px; width: 300px; }
    }
  `]
})
export class PublicLayoutComponent implements OnInit, AfterViewChecked {
  isScrolled = false;
  selectedCategory = 'Products';
  showCategoryDropdown = false;
  showNavCategories = false;
  isAuthPage = false;
  isCheckoutPage = false;
  isHomePage = false;
  isShopPage = false;
  showPromoCarousel = false;
  cartCount = 0;
  userName = 'Guest';
  categories: CategoryLookupDto[] = [];
  searchTerm = '';
  selectedCategorySlug = '';
  showAccountDropdown = false;
  showCartPopup = false;
  showHelpWidget = false;
  promoIndex = 0;
  showVerifiedPopup = false;

  promoSlides: Array<{
    kicker: string;
    title: string;
    cta: string;
    routerLink: any[] | string;
    queryParams?: Record<string, any>;
    image?: string;
    alt: string;
    video?: string;
    poster?: string;
  }> = [
    {
      kicker: 'UP TO 70% OFF',
      title: '5 Days of Deals',
      cta: 'Shop Daily Sales',
      routerLink: ['/shop'],
      queryParams: { sortBy: 'discount' },
      video: 'https://secure.img1-fg.wfcdn.com/dm/video/de3b1f89-5bb5-49f1-870f-a49d4cc07e25/wfus_5dod_etm_desktop.mp4',
      poster: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1920&h=520',
      alt: 'Daily sales promotion'
    },
    {
      kicker: 'JUST DROPPED',
      title: 'New Arrivals',
      cta: 'Browse New',
      routerLink: ['/shop'],
      queryParams: { sortBy: 'newest' },
      image: 'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=1920&h=520',
      alt: 'New arrivals'
    },
    {
      kicker: 'TRENDING',
      title: 'Verified Picks',
      cta: 'Explore Verified',
      routerLink: ['/verified'],
      image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1920&h=520',
      alt: 'Verified picks'
    }
  ];

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

  categoryMegaMenus: Record<string, any> = {};

  headerFeatureLinks: Array<{
    key: 'verified' | 'new-arrivals' | 'best-sellers' | 'collaborations' | 'shop-by-room' | 'inspiration' | 'outdoor-shop' | 'services';
    label: string;
    icon?: string;
    external?: boolean;
    href?: string;
    target?: '_blank' | '_self';
    routerLink?: any[] | string;
    queryParams?: Record<string, any>;
  }> = [
    { key: 'verified', label: 'Verified', icon: 'fa-solid fa-shield-halved', routerLink: ['/verified'] },
    { key: 'new-arrivals', label: 'New Arrivals', routerLink: ['/shop'], queryParams: { sortBy: 'newest' } },
    { key: 'best-sellers', label: 'Best Sellers', routerLink: ['/shop'], queryParams: { sortBy: 'chart' } },
    { key: 'collaborations', label: 'Collaborations', routerLink: ['/collaborations'] },
    { key: 'inspiration', label: 'Inspiration', routerLink: ['/inspiration'] }
    ,
    { key: 'outdoor-shop', label: 'The Outdoor Shop', routerLink: ['/outdoor-shop'] },
    { key: 'services', label: 'Services', routerLink: ['/services'] }
  ];

  verifiedCategories = [
    { label: 'living room', slug: 'living-room', image: 'https://images.unsplash.com/photo-1615873968403-89e068629265?auto=format&fit=crop&w=800&q=80' },
    { label: 'kitchen & dining', slug: 'kitchen-dining', image: 'https://images.unsplash.com/photo-1556912167-f556f1f39fdf?auto=format&fit=crop&w=800&q=80' },
    { label: 'bedroom', slug: 'bedroom', image: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80' },
    { label: 'bathroom', slug: 'bathroom', image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80' },
    { label: 'outdoor', slug: 'outdoor', image: 'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=800&q=80' },
    { label: 'rugs', slug: 'rugs', image: 'https://images.unsplash.com/photo-1523413651479-597eb2da0ad6?auto=format&fit=crop&w=800&q=80' },
    { label: 'decor', slug: 'decor-pillows', image: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=800&q=80' },
    { label: 'baby & kids', slug: 'baby-kids', image: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=800&q=80' }
  ];

  collaborationsPreview = [
    { label: 'Studio Horizon', initials: 'SH', desc: 'Soft modern living' },
    { label: 'Atelier North', initials: 'AN', desc: 'Scandinavian calm' },
    { label: 'Drift & Co', initials: 'DC', desc: 'Coastal textures' },
    { label: 'Lineage', initials: 'LN', desc: 'Classic heritage' },
    { label: 'Monoform', initials: 'MF', desc: 'Minimal silhouettes' },
    { label: 'Terra Loom', initials: 'TL', desc: 'Warm earthy tones' }
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
  ) {
    this.categoryMegaMenus = this.buildMegaMenus();
  }

  ngOnInit(): void {
    // Set initial route-dependent flags (NavigationEnd may have fired before this component was constructed)
    this.isAuthPage = this.router.url.includes('/auth/login') || this.router.url.includes('/auth/register');
    this.isCheckoutPage = this.router.url.startsWith('/checkout');
    this.isHomePage = this.router.url === '/home' || this.router.url.startsWith('/home?') || this.router.url === '/';
    this.isShopPage = this.router.url.startsWith('/shop');

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
    ).subscribe((event) => {
      const url = (event as NavigationEnd).urlAfterRedirects || this.router.url;
      this.isAuthPage = url.includes('/auth/login') || url.includes('/auth/register');
      this.isCheckoutPage = url.startsWith('/checkout');
      this.isHomePage = url === '/home' || url.startsWith('/home?') || url === '/';
      this.isShopPage = url.startsWith('/shop');
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

  getMegaMenu(slug: string): any {
    return this.categoryMegaMenus[slug];
  }

  private megaThumbPool: string[] = [
    '/assets/images/home/cat-fashion.png',
    '/assets/images/home/cat-electronics.png',
    '/assets/images/home/cat-beauty.png',
    '/assets/images/backpack.jpg',
    '/assets/images/headphones.jpg',
    '/assets/images/mouse.jpg',
    '/assets/images/smartwatch.jpg',
    '/assets/images/PersonalCare.jpg',
    '/assets/images/placeholder.jpg'
  ];

  private getMegaItemThumb(baseSlug: string, label: string): string {
    const key = `${baseSlug}|${label}`.toLowerCase();
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    }
    return this.megaThumbPool[hash % this.megaThumbPool.length];
  }

  onMegaThumbError(event: Event): void {
    const img = event?.target as HTMLImageElement | null;
    if (!img) return;
    if (img.src.includes('/assets/images/placeholder.jpg')) return;
    img.src = '/assets/images/placeholder.jpg';
  }

  private buildItems(baseSlug: string, labels: string[]): Array<{ label: string; link: any[]; queryParams?: any; thumb: string }> {
    return labels.map(label => ({
      label,
      link: ['/category', baseSlug],
      queryParams: { q: label },
      thumb: this.getMegaItemThumb(baseSlug, label)
    }));
  }

  private buildMenu(
    baseSlug: string,
    columns: Array<{ title: string; items: string[] }>,
    side: Array<{ title: string; items: string[] }>
  ): any {
    return {
      columns: columns.map(col => ({
        title: col.title,
        items: this.buildItems(baseSlug, col.items)
      })),
      side: side.map(group => ({
        title: group.title,
        items: this.buildItems(baseSlug, group.items)
      }))
    };
  }

  private buildMegaMenus(): Record<string, any> {
    return {
      furniture: this.buildMenu(
        'furniture',
        [
          { title: 'Living Room', items: ['Sofas', 'Sectionals', 'Coffee Tables', 'TV Stands', 'Accent Chairs'] },
          { title: 'Bedroom', items: ['Beds', 'Dressers & Chests', 'Nightstands', 'Wardrobes', 'Mattresses'] },
          { title: 'Dining', items: ['Dining Tables', 'Dining Chairs', 'Bar Stools', 'Sideboards & Buffets', 'Kitchen Islands'] },
          { title: 'Office', items: ['Desks', 'Office Chairs', 'Bookcases', 'Filing Cabinets', 'Office Sets'] }
        ],
        [
          { title: 'New & Featured', items: ['Custom Furniture', 'Verified Furniture', 'Top-Rated Furniture', 'Fast Delivery Furniture'] },
          { title: 'Trending Now', items: ['Hang-Out Must Haves', 'Modern Dining Sets', 'Reclining Furniture', 'Apartment-Friendly Picks'] }
        ]
      ),
      outdoor: this.buildMenu(
        'outdoor',
        [
          { title: 'Patio Seating', items: ['Patio Sets', 'Outdoor Sectionals', 'Conversation Sets', 'Outdoor Chairs', 'Chaise Lounges'] },
          { title: 'Outdoor Dining', items: ['Dining Sets', 'Dining Tables', 'Dining Chairs', 'Bar Tables', 'Benches'] },
          { title: 'Garden', items: ['Planters', 'Raised Beds', 'Outdoor Storage', 'Potting Benches', 'Garden Decor'] },
          { title: 'Grilling', items: ['Grills', 'Smokers', 'Outdoor Kitchens', 'Grill Accessories', 'Coolers'] }
        ],
        [
          { title: 'New & Featured', items: ['Weatherproof Sets', 'Teak Collection', 'Coastal Patio', 'Small Space Patio', 'Sustainable Picks'] },
          { title: 'Trending Now', items: ['Fire Pit Tables', 'Bistro Sets', 'Solar Lighting', 'Pergolas', 'Outdoor Rugs'] }
        ]
      ),
      'bedding-bath': this.buildMenu(
        'bedding-bath',
        [
          { title: 'Bedding', items: ['Comforters', 'Sheets', 'Quilts', 'Duvet Covers', 'Pillows'] },
          { title: 'Bath', items: ['Bath Rugs', 'Towels', 'Shower Curtains', 'Bath Accessories', 'Storage'] },
          { title: 'Kids', items: ['Kids Bedding', 'Kids Bath', 'Crib Sheets', 'Baby Blankets', 'Changing Pads'] },
          { title: 'Mattresses', items: ['Mattresses', 'Mattress Toppers', 'Protectors', 'Bed Frames', 'Foundations'] }
        ],
        [
          { title: 'New & Featured', items: ['Cooling Bedding', 'Organic Cotton', 'Luxe Towels', 'Spa Sets', 'Hotel Picks'] },
          { title: 'Trending Now', items: ['Layered Bedding', 'Neutral Palettes', 'Pattern Play', 'Color Pop', 'Cozy Throws'] }
        ]
      ),
      rugs: this.buildMenu(
        'rugs',
        [
          { title: 'Living Room', items: ['Area Rugs', 'Runners', 'Round Rugs', 'Oversized Rugs', 'Washable Rugs'] },
          { title: 'Bedroom', items: ['Soft Pile', 'Shag', 'Layering Rugs', 'Bench Rugs', 'Rugs Under $200'] },
          { title: 'Outdoor', items: ['Patio Rugs', 'Indoor/Outdoor', 'Weatherproof', 'Doormats', 'Entryway Rugs'] },
          { title: 'Material', items: ['Wool Rugs', 'Jute Rugs', 'Cotton Rugs', 'Synthetic', 'Vintage'] }
        ],
        [
          { title: 'New & Featured', items: ['Machine Washable', 'Performance Rugs', 'Handmade', 'Texture Focus', 'New Arrivals'] },
          { title: 'Trending Now', items: ['Neutral Rugs', 'Bold Geometric', 'Persian Styles', 'Natural Jute', 'Plush Shag'] }
        ]
      ),
      'decor-pillows': this.buildMenu(
        'decor-pillows',
        [
          { title: 'Wall Decor', items: ['Art Prints', 'Mirrors', 'Wall Clocks', 'Shelves', 'Wall Accents'] },
          { title: 'Pillows', items: ['Throw Pillows', 'Inserts', 'Lumbar Pillows', 'Outdoor Pillows', 'Pillow Covers'] },
          { title: 'Accents', items: ['Vases', 'Candles', 'Decorative Objects', 'Trays', 'Books'] },
          { title: 'Lighting Decor', items: ['Lamps', 'String Lights', 'Lanterns', 'Neon', 'LED'] }
        ],
        [
          { title: 'New & Featured', items: ['Curated Sets', 'Artisan Finds', 'Seasonal Decor', 'Trending Colors', 'Minimal Picks'] },
          { title: 'Trending Now', items: ['Gallery Walls', 'Boucle Textures', 'Mixed Metals', 'Earthy Tones', 'Patterned Pillows'] }
        ]
      ),
      lighting: this.buildMenu(
        'lighting',
        [
          { title: 'Ceiling', items: ['Chandeliers', 'Pendants', 'Flush Mounts', 'Ceiling Fans', 'Track Lighting'] },
          { title: 'Lamps', items: ['Table Lamps', 'Floor Lamps', 'Desk Lamps', 'Reading Lamps', 'Tripod Lamps'] },
          { title: 'Outdoor', items: ['Wall Lights', 'Path Lights', 'String Lights', 'Solar Lights', 'Deck Lights'] },
          { title: 'Smart', items: ['Smart Bulbs', 'Smart Fixtures', 'Dimmers', 'Switches', 'LED Strips'] }
        ],
        [
          { title: 'New & Featured', items: ['Brass Finishes', 'Globe Lights', 'Minimal Fixtures', 'Warm Glow', 'New Arrivals'] },
          { title: 'Trending Now', items: ['Statement Pendants', 'Black Fixtures', 'Warm Dimmers', 'Scandi Lamps', 'Mixed Materials'] }
        ]
      ),
      organization: this.buildMenu(
        'organization',
        [
          { title: 'Storage', items: ['Shelving', 'Bins & Baskets', 'Closet Storage', 'Underbed Storage', 'Storage Benches'] },
          { title: 'Kitchen', items: ['Pantry', 'Drawer Organizers', 'Spice Racks', 'Counter Storage', 'Food Containers'] },
          { title: 'Office', items: ['Desk Organizers', 'File Storage', 'Cable Management', 'Bookcases', 'Wall Storage'] },
          { title: 'Entry', items: ['Shoe Storage', 'Hooks', 'Console Tables', 'Umbrella Stands', 'Mail Sorters'] }
        ],
        [
          { title: 'New & Featured', items: ['Modular Systems', 'Space Savers', 'Labeling', 'Clear Storage', 'Best Value'] },
          { title: 'Trending Now', items: ['Closet Refresh', 'Small Space', 'Open Shelving', 'Minimal Setups', 'Hidden Storage'] }
        ]
      ),
      kitchen: this.buildMenu(
        'kitchen',
        [
          { title: 'Cookware', items: ['Pots & Pans', 'Bakeware', 'Cookware Sets', 'Cast Iron', 'Nonstick'] },
          { title: 'Appliances', items: ['Coffee Makers', 'Air Fryers', 'Blenders', 'Microwaves', 'Toasters'] },
          { title: 'Dining', items: ['Dinnerware', 'Glassware', 'Flatware', 'Serving', 'Barware'] },
          { title: 'Storage', items: ['Food Storage', 'Pantry', 'Dish Racks', 'Counter', 'Kitchen Carts'] }
        ],
        [
          { title: 'New & Featured', items: ['Chef Picks', 'Compact Appliances', 'Sustainable Tools', 'Matte Black', 'New Arrivals'] },
          { title: 'Trending Now', items: ['Air Fryer Sets', 'Coffee Stations', 'Meal Prep', 'Open Shelves', 'Smart Kitchen'] }
        ]
      ),
      'baby-kids': this.buildMenu(
        'baby-kids',
        [
          { title: 'Nursery', items: ['Cribs', 'Changing Tables', 'Rockers', 'Nursery Decor', 'Storage'] },
          { title: 'Kids Room', items: ['Beds', 'Dressers', 'Desks', 'Bookcases', 'Rugs'] },
          { title: 'Play', items: ['Play Tables', 'Toy Storage', 'Play Tents', 'Kids Chairs', 'Activity'] },
          { title: 'Bath & Bedding', items: ['Kids Bedding', 'Bath', 'Nightlights', 'Bedding Sets', 'Kids Towels'] }
        ],
        [
          { title: 'New & Featured', items: ['Montessori', 'Soft Neutrals', 'Character Picks', 'Growth Beds', 'Organic'] },
          { title: 'Trending Now', items: ['Playroom Ideas', 'Space-Saving', 'Bunk Beds', 'Reading Nooks', 'Cozy Lighting'] }
        ]
      ),
      'home-improvement': this.buildMenu(
        'home-improvement',
        [
          { title: 'Hardware', items: ['Cabinet Hardware', 'Door Knobs', 'Hinges', 'Hooks', 'Handles'] },
          { title: 'Flooring', items: ['Rug Pads', 'Tiles', 'Vinyl', 'Laminate', 'Floor Care'] },
          { title: 'Paint & Tools', items: ['Paint', 'Wallpaper', 'Tools', 'Ladders', 'Supplies'] },
          { title: 'Fixtures', items: ['Faucets', 'Sinks', 'Lighting', 'Mirrors', 'Bath Accessories'] }
        ],
        [
          { title: 'New & Featured', items: ['DIY Essentials', 'Smart Upgrades', 'Weekend Projects', 'Contractor Picks', 'Best Value'] },
          { title: 'Trending Now', items: ['Peel & Stick', 'Modern Hardware', 'Matte Black', 'Statement Tile', 'Fresh Paint'] }
        ]
      ),
      appliances: this.buildMenu(
        'appliances',
        [
          { title: 'Major', items: ['Refrigerators', 'Ranges', 'Dishwashers', 'Washers', 'Dryers'] },
          { title: 'Small', items: ['Blenders', 'Coffee Makers', 'Air Fryers', 'Mixers', 'Vacuum'] },
          { title: 'Heating/Cooling', items: ['Air Purifiers', 'Fans', 'Heaters', 'Humidifiers', 'Dehumidifiers'] },
          { title: 'Smart Home', items: ['Smart Plugs', 'Sensors', 'Cameras', 'Doorbells', 'Hubs'] }
        ],
        [
          { title: 'New & Featured', items: ['Energy Star', 'Compact', 'Stainless', 'Smart Bundles', 'New Arrivals'] },
          { title: 'Trending Now', items: ['Robot Vacuums', 'Espresso', 'Air Purifiers', 'Portable AC', 'Induction'] }
        ]
      ),
      pet: this.buildMenu(
        'pet',
        [
          { title: 'Cats', items: ['Cat Trees', 'Litter', 'Beds', 'Feeding', 'Toys'] },
          { title: 'Dogs', items: ['Beds', 'Crates', 'Leashes', 'Bowls', 'Toys'] },
          { title: 'Outdoor', items: ['Pet Doors', 'Outdoor Beds', 'Travel', 'Kennels', 'Cleaning'] },
          { title: 'Decor', items: ['Pet Furniture', 'Covers', 'Storage', 'Mats', 'Odor Control'] }
        ],
        [
          { title: 'New & Featured', items: ['Washable', 'Stylish Picks', 'Travel Ready', 'Cozy Beds', 'New Arrivals'] },
          { title: 'Trending Now', items: ['Pet Sofas', 'Elevated Bowls', 'Calming Beds', 'Cat Condos', 'Chew Toys'] }
        ]
      ),
      holiday: this.buildMenu(
        'holiday',
        [
          { title: 'Decor', items: ['Ornaments', 'Wreaths', 'Garlands', 'Trees', 'Stockings'] },
          { title: 'Entertaining', items: ['Tableware', 'Serveware', 'Bar', 'Linens', 'Centerpieces'] },
          { title: 'Lighting', items: ['String Lights', 'Candles', 'Outdoor Lights', 'Lighted Decor', 'Projectors'] },
          { title: 'Gifting', items: ['Gift Wrap', 'Gift Sets', 'Stocking Stuffers', 'Cards', 'Baskets'] }
        ],
        [
          { title: 'New & Featured', items: ['Holiday 2026', 'Classic Red', 'Winter White', 'Metallics', 'Outdoor Decor'] },
          { title: 'Trending Now', items: ['Cozy Glow', 'Rustic Lodge', 'Scandinavian', 'Minimal Tree', 'Mantel Styling'] }
        ]
      ),
      sale: this.buildMenu(
        'sale',
        [
          { title: 'Deals', items: ['Flash Deals', 'Clearance', 'Under $50', 'Under $100', 'Best Sellers'] },
          { title: 'Room', items: ['Living Room', 'Bedroom', 'Kitchen', 'Outdoor', 'Office'] },
          { title: 'Seasonal', items: ['Spring Refresh', 'Summer Patio', 'Back to School', 'Holiday', 'Year-End'] },
          { title: 'Services', items: ['Protection Plans', 'Assembly', 'Financing', 'Rewards', 'Gift Cards'] }
        ],
        [
          { title: 'New & Featured', items: ['Doorbusters', 'Price Drops', 'Bundle Offers', 'Limited Time', 'Member Deals'] },
          { title: 'Trending Now', items: ['Top Savings', 'Best Value', 'New Discounts', 'Staff Picks', 'Trending Deals'] }
        ]
      )
    };
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

  toggleAccountDropdown(event?: Event): void {
    event?.preventDefault();
    this.showAccountDropdown = !this.showAccountDropdown;
  }

  closeAccountDropdown(): void {
    this.showAccountDropdown = false;
  }

  closeCartPopup(): void {
    this.showCartPopup = false;
  }

  closeHelpWidget(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.showHelpWidget = false;
  }

  closeOverlays(): void {
    this.closeAccountDropdown();
    this.closeCartPopup();
    this.showHelpWidget = false;
    this.showVerifiedPopup = false;
  }

  onCartClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (this.cartCount > 0) {
      this.router.navigate(['/cart']);
      return;
    }

    this.showCartPopup = true;
  }

  goToCartFromPopup(): void {
    this.closeCartPopup();
    this.router.navigate(['/cart']);
  }

  goToDailySalesFromPopup(): void {
    this.closeCartPopup();
    this.router.navigate(['/shop'], { queryParams: { sortBy: 'discount' } });
  }

  toggleHelpWidget(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.showHelpWidget = !this.showHelpWidget;
  }

  toggleVerifiedPopup(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.showVerifiedPopup = !this.showVerifiedPopup;
  }

  goToLiveShopping(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.showHelpWidget = false;
    this.router.navigate(['/contact-support']);
  }

  goToCustomerService(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.showHelpWidget = false;
    this.router.navigate(['/contact-support']);
  }

  prevPromo(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.promoSlides.length) return;
    this.promoIndex = (this.promoIndex - 1 + this.promoSlides.length) % this.promoSlides.length;
  }

  nextPromo(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.promoSlides.length) return;
    this.promoIndex = (this.promoIndex + 1) % this.promoSlides.length;
  }

  goToPromo(index: number, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (index < 0 || index >= this.promoSlides.length) return;
    this.promoIndex = index;
  }

  signOut(): void {
    this.closeAccountDropdown();
    this.authService.logout();
  }

  showFreeShipping(): void {
    Swal.fire({
      title: 'Fast & Free Shipping',
      text: 'Free shipping applies on eligible items over $35. Delivery times vary by seller and location.',
      icon: 'info'
    });
  }

  goQuickHelp(): void {
    this.router.navigate(['/contact-support']);
  }

  showCallUs(): void {
    Swal.fire({
      title: 'Call Us',
      html: '<div style="text-align:left"><div style="font-weight:800;color:#111827;margin-bottom:6px">Customer Service</div><div style="color:#374151">+44 123 456 7890</div><div style="color:#6B7280;margin-top:10px">Available hours are shown in the footer.</div></div>',
      icon: 'info'
    });
  }

  showWeeklyHours(team: string): void {
    const hours = team === 'Shopping Assistance'
      ? 'Mon–Sun: 9:00 AM – 6:00 PM (PKT)'
      : 'Mon–Sun: 9:00 AM – 10:00 PM (PKT)';

    Swal.fire({
      title: `${team} Hours`,
      text: hours,
      icon: 'info'
    });
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

  handleFeatureLinkClick(event: Event, link: { key?: string }): void {
    if (link?.key === 'outdoor-shop') {
      event.preventDefault();
      this.router.navigate(['/outdoor-shop']);
    }
  }
}

