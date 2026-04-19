import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { EMPTY, Observable, forkJoin } from 'rxjs';
import { catchError, expand, map, reduce } from 'rxjs/operators';
import { PublicService } from '../../core/services/public.service';
import { CategoryDto } from '../../core/services/category.service';

interface CategoryWithCount extends CategoryDto {
  productCount: number;
}

@Component({
  selector: 'app-category-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="category-list-page animate-fade">
      <div class="container">
        <nav class="breadcrumb-nav">
          <a routerLink="/">Home</a>
          <i class="pi pi-chevron-right"></i>
          <span>All Categories</span>
        </nav>

        <section class="category-hero">
          <div class="hero-copy">
            <span class="hero-eyebrow">Marketplace directory</span>
            <h1>Global <span>Marketplace</span> Categories</h1>
            <p>Explore curated collections from trusted vendors worldwide and jump straight into the categories that are trending right now.</p>

            <div class="hero-actions">
              <button class="hero-primary" type="button" (click)="scrollToCategories()">
                Browse categories
              </button>
              <a class="hero-secondary" routerLink="/">
                Back to home
              </a>
            </div>

            <div class="hero-stats">
              <div class="hero-stat">
                <strong>{{ categories.length || 0 }}</strong>
                <span>Categories</span>
              </div>
              <div class="hero-stat">
                <strong>{{ totalProducts }}</strong>
                <span>Products</span>
              </div>
              <div class="hero-stat">
                <strong>{{ featuredCategories.length || 0 }}</strong>
                <span>Featured now</span>
              </div>
            </div>
          </div>

          <aside class="hero-panel">
            <div class="hero-panel-top">
              <span class="hero-panel-kicker">Trending now</span>
              <h2>Quick category snapshot</h2>
              <p>These picks are based on the current catalog and give the page a faster, fuller first impression.</p>
            </div>

            <div class="hero-chip-cloud" *ngIf="featuredCategories.length > 0; else heroPanelEmpty">
              <button
                class="hero-chip"
                type="button"
                *ngFor="let cat of featuredCategories"
                (click)="onCategoryClick(cat)"
              >
                <span class="hero-chip-name">{{ cat.name }}</span>
                <span class="hero-chip-count">{{ cat.productCount }}</span>
              </button>
            </div>

            <ng-template #heroPanelEmpty>
              <div class="hero-panel-empty">
                <i class="pi pi-compass"></i>
                <p>Loading category highlights...</p>
              </div>
            </ng-template>
          </aside>
        </section>

        <div class="categories-grid-wrap" id="category-grid">
          <div class="categories-grid" *ngIf="!isLoading; else loader">
          <div class="category-card shadow-premium" *ngFor="let cat of categories" (click)="onCategoryClick(cat)">
            <div class="category-image">
              <img [src]="cat.imageUrl || getDefaultImage(cat.name)" 
                   [alt]="cat.name"
                   (error)="handleImageError($event, cat.name)">
              <div class="category-overlay">
                <span class="view-btn">Browse Collection</span>
              </div>
            </div>
            <div class="category-info">
              <h3>{{ cat.name }}</h3>
              <div class="category-meta">
                <i class="pi pi-arrow-right"></i>
              </div>
              </div>
            </div>
          </div>
          </div>

        <ng-template #loader>
          <div class="loader-container interactive-loader">
            <div class="luxury-loader">
              <div class="loader-ring"></div>
              <div class="loader-ring"></div>
              <div class="loader-ring"></div>
              <i class="pi pi-compass loader-icon"></i>
            </div>
            <div class="loader-text-wrap">
              <p class="loader-msg">{{ loadingMessage }}</p>
              <div class="loader-progress">
                <div class="progress-bar"></div>
              </div>
            </div>
          </div>
        </ng-template>

        <div class="no-data" *ngIf="!isLoading && categories.length === 0">
          <i class="pi pi-inbox"></i>
          <h3>No Categories Found</h3>
          <p>We're currently updating our catalog. Please check back soon.</p>
          <button class="btn-premium" routerLink="/">Return Home</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .category-list-page {
      padding: 2rem 0 4rem;
      min-height: 80vh;
      position: relative;
      overflow: hidden;
      background:
        radial-gradient(circle at top left, rgba(16, 185, 129, 0.12), transparent 28%),
        radial-gradient(circle at top right, rgba(255, 176, 101, 0.12), transparent 24%),
        linear-gradient(180deg, #f8fbfd 0%, #f4f8fb 100%);
    }

    .category-list-page::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(255, 255, 255, 0.48) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.42) 1px, transparent 1px);
      background-size: 62px 62px;
      mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.18), transparent 78%);
      pointer-events: none;
    }

    .container {
      max-width: 1300px;
      margin: 0 auto;
      padding: 0 24px;
      position: relative;
      z-index: 1;
    }

    .breadcrumb-nav {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 1.2rem;
      font-size: 14px;
      color: #64748b;
    }

    .breadcrumb-nav a {
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
      transition: opacity 0.2s;
    }

    .breadcrumb-nav a:hover {
      opacity: 0.8;
    }

    .category-hero {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.92fr);
      gap: 18px;
      align-items: stretch;
      margin-bottom: 2rem;
    }

    .hero-copy,
    .hero-panel {
      border: 1px solid rgba(214, 229, 236, 0.92);
      border-radius: 30px;
      background: rgba(255, 255, 255, 0.88);
      box-shadow: 0 22px 50px rgba(31, 41, 55, 0.08);
      backdrop-filter: blur(12px);
    }

    .hero-copy {
      position: relative;
      overflow: hidden;
      padding: 2rem 2rem 1.75rem;
    }

    .hero-copy::after {
      content: '';
      position: absolute;
      right: -80px;
      top: -70px;
      width: 240px;
      height: 240px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(16, 185, 129, 0.16), transparent 68%);
      pointer-events: none;
    }

    .hero-eyebrow {
      display: inline-flex;
      align-items: center;
      min-height: 30px;
      padding: 0 12px;
      border-radius: 999px;
      border: 1px solid rgba(16, 185, 129, 0.2);
      background: rgba(236, 253, 245, 0.9);
      color: #0f766e;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      margin-bottom: 1rem;
      position: relative;
      z-index: 1;
    }

    .hero-copy h1 {
      position: relative;
      z-index: 1;
      font-size: clamp(2.25rem, 4vw, 4.1rem);
      font-weight: 800;
      color: #1e293b;
      margin: 0 0 1rem;
      letter-spacing: -0.06em;
      line-height: 0.95;
    }

    .hero-copy h1 span {
      background: linear-gradient(135deg, #10b981 0%, #f59e0b 55%, #f97316 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .hero-copy p {
      position: relative;
      z-index: 1;
      font-size: clamp(1rem, 1.35vw, 1.125rem);
      line-height: 1.75;
      color: #5b6f7f;
      max-width: 720px;
      margin: 0;
    }

    .hero-actions {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-top: 1.5rem;
    }

    .hero-primary,
    .hero-secondary {
      min-height: 46px;
      padding: 0 18px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 800;
      text-decoration: none;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
    }

    .hero-primary {
      border: 0;
      color: #ffffff;
      background: linear-gradient(135deg, #10b981 0%, #0f766e 100%);
      box-shadow: 0 16px 30px rgba(16, 185, 129, 0.24);
    }

    .hero-secondary {
      border: 1px solid rgba(16, 185, 129, 0.2);
      color: #0f766e;
      background: rgba(255, 255, 255, 0.88);
    }

    .hero-primary:hover,
    .hero-secondary:hover {
      transform: translateY(-2px);
      box-shadow: 0 18px 28px rgba(31, 41, 55, 0.08);
    }

    .hero-stats {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-top: 1.6rem;
    }

    .hero-stat {
      padding: 1rem 1rem 0.95rem;
      border-radius: 18px;
      border: 1px solid rgba(219, 230, 236, 0.95);
      background: linear-gradient(180deg, rgba(250, 253, 255, 0.96), rgba(241, 248, 251, 0.96));
      box-shadow: 0 10px 18px rgba(31, 41, 55, 0.05);
    }

    .hero-stat strong {
      display: block;
      color: #0f172a;
      font-size: clamp(1.4rem, 2vw, 2rem);
      line-height: 1;
      font-weight: 900;
      letter-spacing: -0.04em;
    }

    .hero-stat span {
      display: block;
      margin-top: 6px;
      color: #64748b;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .hero-panel {
      padding: 1.5rem;
      display: grid;
      align-content: start;
      gap: 1rem;
      min-height: 100%;
      background:
        radial-gradient(circle at top left, rgba(16, 185, 129, 0.12), transparent 34%),
        radial-gradient(circle at bottom right, rgba(249, 115, 22, 0.1), transparent 28%),
        rgba(255, 255, 255, 0.9);
    }

    .hero-panel-top h2 {
      margin: 0.4rem 0 0.5rem;
      color: #0f172a;
      font-size: 1.25rem;
      font-weight: 800;
      letter-spacing: -0.04em;
    }

    .hero-panel-top p {
      margin: 0;
      color: #64748b;
      line-height: 1.7;
      font-size: 0.95rem;
    }

    .hero-panel-kicker {
      display: inline-flex;
      align-items: center;
      min-height: 28px;
      padding: 0 11px;
      border-radius: 999px;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.16);
      color: #0f766e;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .hero-chip-cloud {
      display: grid;
      gap: 10px;
    }

    .hero-chip {
      border: 1px solid rgba(214, 229, 236, 0.95);
      border-radius: 18px;
      padding: 0.9rem 1rem;
      background: linear-gradient(180deg, #ffffff 0%, #f8fbfc 100%);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      cursor: pointer;
      box-shadow: 0 10px 18px rgba(31, 41, 55, 0.05);
      transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
    }

    .hero-chip:hover {
      transform: translateY(-2px);
      border-color: rgba(16, 185, 129, 0.28);
      box-shadow: 0 14px 22px rgba(31, 41, 55, 0.08);
    }

    .hero-chip-name {
      color: #0f172a;
      font-size: 13px;
      font-weight: 800;
      text-align: left;
    }

    .hero-chip-count {
      min-width: 34px;
      height: 34px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(16, 185, 129, 0.1);
      color: #0f766e;
      font-size: 12px;
      font-weight: 800;
      flex-shrink: 0;
    }

    .hero-panel-empty {
      min-height: 180px;
      display: grid;
      place-items: center;
      text-align: center;
      border-radius: 20px;
      border: 1px dashed rgba(16, 185, 129, 0.2);
      background: rgba(236, 253, 245, 0.42);
      color: #4b6474;
      gap: 10px;
      padding: 1.5rem;
    }

    .hero-panel-empty i {
      font-size: 1.4rem;
      color: #10b981;
    }

    .hero-panel-empty p {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 600;
    }

    .categories-grid-wrap {
      margin-top: 0.5rem;
    }

    .categories-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.35rem;
    }

    .category-card {
      background: #fff;
      border-radius: 26px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      border: 1px solid rgba(214, 229, 236, 0.95);
      box-shadow: 0 18px 34px rgba(31, 41, 55, 0.07);
    }

    .category-card:hover {
      transform: translateY(-10px);
      box-shadow: 0 26px 52px -14px rgba(16, 24, 40, 0.18);
      border-color: rgba(16, 185, 129, 0.22);
    }

    .category-image {
      height: 220px;
      position: relative;
      overflow: hidden;
      background: linear-gradient(135deg, #eef5f7 0%, #dbe9ee 100%);
    }

    .category-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 0.6s;
    }

    .category-card:hover .category-image img {
      transform: scale(1.1);
    }

    .category-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(3, 7, 18, 0.08), rgba(3, 7, 18, 0.48));
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s;
      backdrop-filter: blur(6px);
    }

    .category-card:hover .category-overlay {
      opacity: 1;
    }

    .view-btn {
      color: #fff;
      font-weight: 700;
      font-size: 1rem;
      padding: 11px 22px;
      border: 1px solid rgba(255, 255, 255, 0.8);
      border-radius: 30px;
      background: rgba(255, 255, 255, 0.12);
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.14);
    }

    .category-info {
      padding: 1.35rem 1.4rem 1.45rem;
    }

    .category-info h3 {
      font-size: 1.22rem;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 0.55rem;
    }

    .category-meta {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      margin-top: 0.35rem;
      color: var(--primary);
    }

    .category-meta .count {
      font-weight: 600;
      font-size: 0.95rem;
      color: #64748b;
    }

    .category-meta i {
      font-size: 1.25rem;
      width: 30px;
      height: 30px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: rgba(16, 185, 129, 0.12);
      color: #0f766e;
      transition: transform 0.3s;
    }

    .category-card:hover .category-meta i {
      transform: translateX(8px);
    }

    /* Interactive Loader Styles */
    .loader-container {
      padding: 8rem 0;
      text-align: center;
      background: #fff;
      border-radius: 32px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.05);
      border: 1px solid rgba(248, 86, 6, 0.05);
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .luxury-loader {
      position: relative;
      width: 100px;
      height: 100px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 2.5rem;
    }

    .loader-ring {
      position: absolute;
      border: 2px solid var(--primary);
      border-radius: 50%;
      opacity: 0;
      animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
    }

    .loader-ring:nth-child(2) { animation-delay: 0.5s; }
    .loader-ring:nth-child(3) { animation-delay: 1s; }

    @keyframes pulse-ring {
      0% { transform: scale(0.3); opacity: 0.8; }
      100% { transform: scale(1.5); opacity: 0; }
    }

    .loader-icon {
      font-size: 2.5rem;
      color: var(--primary);
      filter: drop-shadow(0 0 10px rgba(248, 86, 6, 0.3));
      animation: bounce-rotate 3s ease-in-out infinite;
    }

    @keyframes bounce-rotate {
      0%, 100% { transform: translateY(0) rotate(0); }
      50% { transform: translateY(-10px) rotate(15deg); }
    }

    .loader-text-wrap {
      max-width: 300px;
    }

    .loader-msg {
      font-size: 1.25rem;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 1.5rem;
      height: 1.5em;
      transition: all 0.5s;
    }

    .loader-progress {
      width: 200px;
      height: 4px;
      background: #f1f5f9;
      border-radius: 2px;
      overflow: hidden;
      margin: 0 auto;
    }

    .progress-bar {
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, var(--primary), #ff916a);
      animation: progress-slide 1.5s infinite linear;
      transform-origin: 0% 50%;
    }

    @keyframes progress-slide {
      0% { transform: translate(-100%); }
      100% { transform: translate(100%); }
    }

    .no-data {
      padding: 6rem;
      text-align: center;
      background: #fff;
      border-radius: 24px;
    }

    .no-data i {
      font-size: 4rem;
      color: #cbd5e1;
      margin-bottom: 2rem;
    }

    @media (max-width: 1024px) {
      .category-hero {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 768px) {
      .category-list-page {
        padding-top: 1rem;
      }

      .hero-copy,
      .hero-panel {
        border-radius: 22px;
      }

      .hero-copy {
        padding: 1.5rem;
      }

      .hero-stats {
        grid-template-columns: 1fr;
      }

      .categories-grid {
        grid-template-columns: 1fr;
      }

      .category-image {
        height: 210px;
      }
    }
  `]
})
export class CategoryListComponent implements OnInit {
  categories: CategoryWithCount[] = [];
  featuredCategories: CategoryWithCount[] = [];
  totalProducts = 0;
  isLoading = true;
  loadingMessage = 'Loading categories...';
  private messageInterval: any;
  private readonly loadingMessages = [
    'Loading categories...',
    'Finding top items...',
    'Best products for you...',
    'Checking latest stocks...',
    'Getting things ready...',
    'Almost there...'
  ];


  constructor(
    private publicService: PublicService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.isLoading = true;
    this.startLoadingMessages();
    forkJoin({
      categories: this.publicService.getCategories(),
      products: this.loadAllProductsForStats()
    }).subscribe({
      next: ({ categories, products }) => {
        const allProducts = this.deduplicateProducts(products || []);
        const mappedCategories = (categories || []).map(cat => ({
          ...cat,
          productCount: allProducts.filter(p =>
            p.categoryId === cat.id ||
            (p.categoryName && cat.name && p.categoryName.toLowerCase() === cat.name.toLowerCase())
          ).length
        }));
        this.categories = mappedCategories;
        this.featuredCategories = [...mappedCategories].sort((a, b) => b.productCount - a.productCount).slice(0, 4);
        this.totalProducts = allProducts.length;
        this.isLoading = false;
        this.stopLoadingMessages();
      },
      error: (err) => {
        console.error('CategoryListComponent: Error fetching data', err);
        this.isLoading = false;
        this.stopLoadingMessages();
      }
    });
  }

  ngOnDestroy(): void {
    this.stopLoadingMessages();
  }

  private startLoadingMessages(): void {
    let index = 0;
    this.messageInterval = setInterval(() => {
      index = (index + 1) % this.loadingMessages.length;
      this.loadingMessage = this.loadingMessages[index];
    }, 2500);
  }

  private stopLoadingMessages(): void {
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
    }
  }

  private loadAllProductsForStats(pageSize: number = 100): Observable<any[]> {
    return this.publicService.getProducts('', 0, pageSize).pipe(
      map((items) => ({ items: items || [], skip: 0 })),
      expand((page) => {
        if (page.items.length < pageSize) {
          return EMPTY;
        }
        const nextSkip = page.skip + pageSize;
        return this.publicService.getProducts('', nextSkip, pageSize).pipe(
          map((items) => ({ items: items || [], skip: nextSkip })),
          catchError(() => EMPTY)
        );
      }),
      reduce((all, page) => all.concat(page.items), [] as any[])
    );
  }

  private deduplicateProducts(products: any[]): any[] {
    const seen = new Set<string>();
    const unique: any[] = [];

    (products || []).forEach((product) => {
      const key = (
        product?.id ||
        product?.productId ||
        product?.sku ||
        product?.name
      )?.toString()?.trim();

      if (!key || seen.has(key)) {
        return;
      }

      seen.add(key);
      unique.push(product);
    });

    return unique;
  }


  onCategoryClick(cat: CategoryDto): void {
    this.router.navigate(['/category', cat.slug]);
  }

  scrollToCategories(): void {
    const target = document.getElementById('category-grid');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  handleImageError(event: any, name: string): void {
    const img = event.target;
    img.src = `https://placehold.co/600x400/f85606/ffffff?text=${encodeURIComponent(name)}`;
    // Prevent infinite loop if placeholder also fails
    img.onerror = null;
  }

  getDefaultImage(name: string): string {
    const defaults: { [key: string]: string } = {
      'Electronics': 'assets/images/61+DG4Np+zL._AC_SX425_.jpg',
      'Fashion': 'assets/images/71NpF4JP7HL._AC_SY879_.jpg',
      'Beauty': 'assets/images/81BrD6Y4ieL._AC_SX425_.jpg',
      'Home': 'assets/images/81jgetrp87L._AC_SX679_.jpg',
      'Sports': 'assets/images/81ec6uY7eML._AC_SX425_.jpg',
      'Accessories': 'assets/images/61BKAbqOL5L._AC_SX679_.jpg'
    };

    for (const key in defaults) {
      if (name && name.toLowerCase().includes(key.toLowerCase())) return defaults[key];
    }
    return `https://placehold.co/600x400/f85606/ffffff?text=${encodeURIComponent(name || 'Category')}`;
  }
}
