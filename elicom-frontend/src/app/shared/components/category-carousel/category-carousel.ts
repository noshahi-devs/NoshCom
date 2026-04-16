import {
  ChangeDetectorRef,
  Component,
  HostListener,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CategoryService } from '../../../services/category';
import { SearchService } from '../../../services/search.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-category-carousel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './category-carousel.html',
  styleUrls: ['./category-carousel.scss'],
})
export class CategoryCarouselComponent implements OnInit, OnChanges {
  @Input() categories: any[] = [];

  slides: any[][] = [];
  featureCategories: any[] = [];
  currentSlide = 0;
  enableCarousel = false;

  itemsPerRow = 8;
  rows = 2;
  itemsPerSlide = 16;

  private readonly promoLabels = [
    '50% OFF',
    '40% OFF',
    '60% OFF',
    'NEW ARRIVAL',
    'BEST SELLER',
    'LIMITED',
  ];
  private readonly universeCardClasses = [
    'span-3 card-graphite',
    'span-3 card-rose',
    'span-6 card-amber',
    'span-6 card-indigo',
    'span-3 card-emerald',
    'span-3 card-magenta',
  ];
  private readonly universeCardTags = [
    'HOT',
    'NEW',
    'WORK',
    'BEST',
    'PLAY',
    'LIMITED',
  ];
  private readonly universeCardEyebrows = [
    'Enjoy with',
    'Now wear',
    'Work devices',
    'Pet world',
    'Play time',
    'New drop',
  ];

  constructor(
    private adeel: CategoryService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private searchService: SearchService
  ) {}

  ngOnInit(): void {
    this.calculateLayout();
    if (!this.categories || this.categories.length === 0) {
      this.loadMyCategories();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['categories'] && this.categories) {
      this.buildSlides();
      this.cdr.detectChanges();
    }
  }

  loadMyCategories(): void {
    this.adeel.refreshCache();
    this.adeel.getAllCategories(200).subscribe({
      next: (res: any[]) => {
        this.categories = res || [];
        this.buildSlides();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Carousel: category load failure', err);
      },
    });
  }

  @HostListener('window:resize')
  calculateLayout(): void {
    const width = window.innerWidth;

    if (width < 600) {
      this.itemsPerRow = 3;
    } else if (width < 900) {
      this.itemsPerRow = 4;
    } else {
      this.itemsPerRow = 8;
    }

    this.itemsPerSlide = this.itemsPerRow * this.rows;
    this.buildSlides();
    this.cdr.detectChanges();
  }

  buildSlides(): void {
    this.slides = [];
    this.currentSlide = 0;
    this.featureCategories = this.categories.slice(0, 6);

    for (let i = 0; i < this.categories.length; i += this.itemsPerSlide) {
      this.slides.push(this.categories.slice(i, i + this.itemsPerSlide));
    }

    this.enableCarousel = this.slides.length > 1;
  }

  getPromoLabel(index: number): string {
    return this.promoLabels[index] || 'FEATURED';
  }

  getUniverseCardClass(index: number): string {
    return this.universeCardClasses[index] || 'span-3 card-graphite';
  }

  getUniverseCardTag(index: number): string {
    return this.universeCardTags[index] || 'HOT';
  }

  getUniverseCardEyebrow(index: number): string {
    return this.universeCardEyebrows[index] || 'Featured';
  }

  getTrackTransform(): string {
    if (!this.slides.length) {
      return 'translateX(0)';
    }

    return `translateX(-${(this.currentSlide * 100) / this.slides.length}%)`;
  }

  getSlideWidthPercent(): number {
    if (!this.slides.length) {
      return 100;
    }

    return 100 / this.slides.length;
  }

  getCategoryImage(cat: any): string {
    const rawValue =
      cat?.imageUrl ||
      cat?.image ||
      cat?.categoryImage ||
      cat?.categoryImageUrl ||
      cat?.icon ||
      cat?.logo ||
      cat?.picture ||
      cat?.photo ||
      cat?.thumbnail ||
      cat?.fileName ||
      cat?.imageName ||
      '';

    let val = String(rawValue || '').trim();
    if (!val || val === 'string') {
      const seed = cat.id || cat.categoryId || cat.name || 'default';
      return `https://picsum.photos/seed/${seed}/240/240`;
    }

    if (val.startsWith('"') || val.startsWith('\\"')) {
      val = val
        .replace(/^\\"/, '')
        .replace(/\\"$/, '')
        .replace(/^"/, '')
        .replace(/"$/, '')
        .replace(/\\"/g, '');
    }

    if (val.startsWith('[')) {
      val = val
        .replace(/^\[/, '')
        .replace(/\]$/, '')
        .replace(/^"/, '')
        .replace(/"$/, '')
        .replace(/\\"/g, '');
      if (val.includes('","')) {
        val = val.split('","')[0];
      } else if (val.includes(',')) {
        val = val.split(',')[0];
      }
    }

    if (val.startsWith('http://') || val.startsWith('https://')) {
      return val;
    }

    if (val.startsWith('/')) {
      return `${environment.apiUrl}${val}`;
    }

    if (val.includes('/')) {
      return `${environment.apiUrl}/${val}`;
    }

    // PrimeShip category images are usually stored as filenames under uploads.
    return `${environment.apiUrl}/uploads/primeship-products/${val}`;
  }

  handleImageError(event: any, cat: any): void {
    const seed = cat.id || cat.categoryId || cat.name || 'default';
    const fallbackUrl = `https://picsum.photos/seed/${seed}/240/240`;

    if (event.target.src === fallbackUrl) {
      return;
    }
    event.target.src = fallbackUrl;
  }

  onCategoryClick(cat: any): void {
    const term = cat.name;
    this.searchService.setSearchTerm(term);
    this.router.navigate(['/search-result'], { queryParams: { cat: term } });
  }

  next(): void {
    if (this.currentSlide < this.slides.length - 1) {
      this.currentSlide++;
    }
  }

  prev(): void {
    if (this.currentSlide > 0) {
      this.currentSlide--;
    }
  }

  private shuffle<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}
