import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ProductGridComponent } from '../../shared/components/product-grid/product-grid';
import { SearchService } from '../../services/search.service';
import { CategoryService } from '../../services/category';
import { catchError, map, of } from 'rxjs';

@Component({
  selector: 'app-search-result',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductGridComponent],
  templateUrl: './search-result.html',
  styleUrl: './search-result.scss',
})
export class SearchResult implements OnInit {
  filterData: any = {};
  categoryTitle: string = '';
  isSidebarLoading: boolean = true;
  showCategoryModal = false;

  availableCategories: string[] = [];
  availableColors: string[] = [];
  availableSizes: string[] = [];
  availableTypes: string[] = [];
  availableFits: string[] = [];
  availableLengths: string[] = [];
  priceRange = { min: 0, max: 10000 };
  selectedCategoryLabel = '';
  minPriceInput = '';
  maxPriceInput = '';
  isMaxPriceInvalid = false;

  constructor(
    private route: ActivatedRoute,
    private searchService: SearchService,
    private categoryService: CategoryService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit() {
    // 1. Listen for route params (category links + free text search)
    this.route.queryParams.subscribe(params => {
      const category = params['cat'] || params['category'];
      const query = params['q'];

      if (category) {
        this.categoryTitle = category;
        this.selectedCategoryLabel = category;
        this.filterData = { ...this.filterData, category, search: '' };
        this.searchService.setSearchTerm(category);
      } else if (query) {
        this.categoryTitle = query;
        this.selectedCategoryLabel = '';
        this.filterData = { ...this.filterData, search: query, category: '' };
        this.searchService.setSearchTerm(query);
      } else {
        this.categoryTitle = '';
        this.selectedCategoryLabel = '';
        this.filterData = { ...this.filterData, category: '', search: '' };
      }
    });

    // Also handle dynamic search terms
    this.searchService.searchTerm$.subscribe(term => {
      if (term && term !== this.categoryTitle) {
        this.categoryTitle = term;
        this.filterData = { ...this.filterData, search: term, category: '' };
      }
    });

    this.loadAllCategories();
  }

  loadAllCategories() {
    this.categoryService.getHomepageCategories()
      .pipe(
        map((cats: any[]) => {
          if (!Array.isArray(cats)) return [];
          return cats
            .map(c => this.normalizeCategoryName(c?.name))
            .filter((name): name is string => !!name)
            .sort((a, b) => a.localeCompare(b));
        }),
        catchError(() => of([]))
      )
      .subscribe((categories: string[]) => {
        if (categories.length > 0) {
          this.availableCategories = categories;
        }
        this.isSidebarLoading = false;
        this.cdr.detectChanges();
      });
  }

  onProductsLoaded(products: any[]) {
    // Derive filters from actually loaded products in this category
    const colors = new Set<string>();
    const sizes = new Set<string>();
    const types = new Set<string>();
    const fits = new Set<string>();
    const lengths = new Set<string>();
    const categories = new Set<string>();

    let min = Infinity;
    let max = -Infinity;

    products.forEach(p => {

      // Dynamic Attributes (Check standard fields and potential custom properties)
      const raw = p as any;
      if (raw.color) colors.add(raw.color);
      if (raw.size) sizes.add(raw.size);
      if (raw.type) types.add(raw.type);
      if (raw.fit) fits.add(raw.fit);
      if (raw.length) lengths.add(raw.length);
      const categoryName = this.normalizeCategoryName(raw.categoryName || raw.category?.name || raw.category);
      if (categoryName) categories.add(categoryName);

      if (p.price < min) min = p.price;
      if (p.price > max) max = p.price;
    });

    if (categories.size > 0) {
      const merged = new Set<string>([...this.availableCategories, ...Array.from(categories)]);
      this.availableCategories = Array.from(merged).sort((a, b) => a.localeCompare(b));
    }
    this.availableColors = Array.from(colors).sort();
    this.availableSizes = Array.from(sizes).sort();
    this.availableTypes = Array.from(types).sort();
    this.availableFits = Array.from(fits).sort();
    this.availableLengths = Array.from(lengths).sort();

    if (min !== Infinity) {
      this.priceRange = { min: Math.floor(min), max: Math.ceil(max) };
    }

    this.cdr.detectChanges();
  }

  private normalizeCategoryName(value: any): string | null {
    const name = (value ?? '').toString().trim();
    return name.length > 0 ? name : null;
  }

  toggleCategoryModal() {
    this.showCategoryModal = !this.showCategoryModal;
  }

  closeCategoryModal() {
    this.showCategoryModal = false;
  }

  selectCategory(category: string | null) {
    this.selectedCategoryLabel = category || '';
    this.filterData = {
      ...this.filterData,
      category: category || ''
    };
    this.categoryTitle = category || '';
    this.showCategoryModal = false;
  }

  onPriceInput(type: 'min' | 'max', event: Event) {
    const input = event.target as HTMLInputElement;
    const digitsOnly = input.value.replace(/\D/g, '');
    input.value = digitsOnly;

    if (type === 'min') {
      this.minPriceInput = digitsOnly;
    } else {
      this.maxPriceInput = digitsOnly;
    }

    this.applyPriceFilter();
  }

  private applyPriceFilter() {
    const min = this.minPriceInput ? Number(this.minPriceInput) : 0;
    const max = this.maxPriceInput ? Number(this.maxPriceInput) : 10000;
    this.isMaxPriceInvalid = this.maxPriceInput !== '' && max < min;

    this.filterData = {
      ...this.filterData,
      price: { min, max }
    };
  }

  /* SORTING Logic */
  showSortDropdown = false;

  toggleSortDropdown(event?: Event) {
    event?.stopPropagation();
    this.showSortDropdown = !this.showSortDropdown;
  }

  onSortChange(value: string) {
    this.filterData = { ...this.filterData, sort: value };
    this.showSortDropdown = false;
  }

  getSortLabel(value: string): string {
    const map: any = {
      'recommended': 'Recommended',
      'newest': 'Newest',
      'price-low': 'Price: Low to High',
      'price-high': 'Price: High to Low'
    };
    return map[value] || 'Recommended';
  }
}
