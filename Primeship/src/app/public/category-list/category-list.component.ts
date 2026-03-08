import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
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
        <!-- Breadcrumbs -->
        <nav class="breadcrumb-nav">
          <a routerLink="/">Home</a>
          <i class="pi pi-chevron-right"></i>
          <span>All Categories</span>
        </nav>

        <div class="page-header">
          <h1>Global <span>Marketplace</span> Categories</h1>
          <p>Explore our curated collections from trusted vendors worldwide.</p>
        </div>

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
                <span class="count">{{ cat.productCount }} Products</span>
                <i class="pi pi-arrow-right"></i>
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
      padding: 4rem 0;
      min-height: 80vh;
      background: #f8fafc;
    }

    .container {
      max-width: 1300px;
      margin: 0 auto;
      padding: 0 24px;
    }

    .breadcrumb-nav {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 2rem;
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

    .page-header {
      margin-bottom: 4rem;
      text-align: center;
    }

    .page-header h1 {
      font-size: 3rem;
      font-weight: 800;
      color: #1e293b;
      margin-bottom: 1rem;
      letter-spacing: -1px;
    }

    .page-header h1 span {
      background: linear-gradient(135deg, var(--primary) 0%, #ff6b35 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .page-header p {
      font-size: 1.125rem;
      color: #64748b;
      max-width: 600px;
      margin: 0 auto;
    }

    .categories-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 2.5rem;
    }

    .category-card {
      background: #fff;
      border-radius: 24px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      border: 1px solid rgba(0,0,0,0.05);
    }

    .category-card:hover {
      transform: translateY(-12px);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
    }

    .category-image {
      height: 240px;
      position: relative;
      overflow: hidden;
      background: #f1f5f9;
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
      background: rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s;
      backdrop-filter: blur(4px);
    }

    .category-card:hover .category-overlay {
      opacity: 1;
    }

    .view-btn {
      color: #fff;
      font-weight: 700;
      font-size: 1.1rem;
      padding: 12px 24px;
      border: 2px solid #fff;
      border-radius: 30px;
    }

    .category-info {
      padding: 2rem;
    }

    .category-info h3 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 0.75rem;
    }

    .category-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: var(--primary);
    }

    .category-meta .count {
      font-weight: 600;
      font-size: 0.95rem;
      color: #64748b;
    }

    .category-meta i {
      font-size: 1.25rem;
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
  `]
})
export class CategoryListComponent implements OnInit {
  categories: CategoryWithCount[] = [];
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
      products: this.publicService.getProducts()
    }).subscribe({
      next: ({ categories, products }) => {
        this.categories = (categories || []).map(cat => ({
          ...cat,
          productCount: (products || []).filter(p =>
            p.categoryId === cat.id ||
            (p.categoryName && cat.name && p.categoryName.toLowerCase() === cat.name.toLowerCase())
          ).length
        }));
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


  onCategoryClick(cat: CategoryDto): void {
    this.router.navigate(['/category', cat.slug]);
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
