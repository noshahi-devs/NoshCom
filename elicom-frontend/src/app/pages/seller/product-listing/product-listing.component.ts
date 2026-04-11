import { Component, OnInit, OnDestroy, HostListener, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { StoreService } from '../../../services/store.service';
import { StoreProductService } from '../../../services/store-product.service';
import { AlertService } from '../../../services/alert.service';
import { CategoryService } from '../../../services/category';

@Component({
    selector: 'app-product-listing',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule],
    templateUrl: './product-listing.component.html',
    styleUrls: ['./product-listing.component.scss']
})
export class ProductListingComponent implements OnInit, OnDestroy {
    private storeService = inject(StoreService);
    private storeProductService = inject(StoreProductService);
    private categoryService = inject(CategoryService);
    private alert = inject(AlertService);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private zone = inject(NgZone);
    protected readonly Math = Math;

    products: any[] = [];
    categoryOptions: string[] = ['All Categories'];
    categoryTiles: Array<{ name: string; count: number; icon: string; tone: string; }> = [];
    filterText: string = '';
    selectedCategory: string = 'All Categories';
    isCategoryDropdownOpen: boolean = false;
    isCategoriesLoading: boolean = true;
    minPriceFilter: number | null = null;
    maxPriceFilter: number | null = null;
    sortOption: string = 'default';
    isLoading: boolean = true;
    currentStore: any = null;
    currentTime: string = '';
    currentDate: string = '';
    hourHandRotation: number = 0;
    minuteHandRotation: number = 0;
    secondHandRotation: number = 0;
    private timer: ReturnType<typeof setInterval> | null = null;

    // Pagination State
    totalProducts: number = 0;
    pageSize: number = 16;
    currentPage: number = 1;

    get totalPages(): number {
        return Math.ceil(this.totalProducts / this.pageSize);
    }

    get skipCount(): number {
        return (this.currentPage - 1) * this.pageSize;
    }

    get filteredProducts() {
        let filtered = [...this.products];
        const search = this.filterText.trim().toLowerCase();

        if (search) {
            filtered = filtered.filter(p =>
                p.title.toLowerCase().includes(search) ||
                p.brand.toLowerCase().includes(search) ||
                p.category.toLowerCase().includes(search) ||
                p.id.toLowerCase().includes(search)
            );
        }

        if (this.selectedCategory !== 'All Categories') {
            filtered = filtered.filter(p => p.category === this.selectedCategory);
        }

        if (this.priceValidationError) {
            return [];
        }

        if (this.minPriceFilter !== null && this.minPriceFilter !== undefined && this.minPriceFilter !== ('' as any)) {
            filtered = filtered.filter(p => Number(p.price) >= Number(this.minPriceFilter));
        }

        if (this.maxPriceFilter !== null && this.maxPriceFilter !== undefined && this.maxPriceFilter !== ('' as any)) {
            filtered = filtered.filter(p => Number(p.price) <= Number(this.maxPriceFilter));
        }

        if (this.sortOption === 'priceLowHigh') {
            filtered.sort((a, b) => Number(a.price) - Number(b.price));
        } else if (this.sortOption === 'priceHighLow') {
            filtered.sort((a, b) => Number(b.price) - Number(a.price));
        } else if (this.sortOption === 'newest') {
            filtered.sort((a, b) => String(b.mappingId || '').localeCompare(String(a.mappingId || '')));
        }

        return filtered;
    }

    get priceValidationError(): string {
        if (this.minPriceFilter !== null && this.maxPriceFilter !== null && Number(this.maxPriceFilter) < Number(this.minPriceFilter)) {
            return 'Max Price cannot be less than Min Price.';
        }
        return '';
    }

    get isCategoryFilterActive(): boolean {
        return this.selectedCategory !== 'All Categories';
    }

    get displayStoreName(): string {
        return (this.currentStore?.name || 'Your Store').toString().trim();
    }

    ngOnInit() {
        this.startClock();
        this.loadCategoryOptions();
        this.loadStoreAndProducts();
    }

    ngOnDestroy() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    loadStoreAndProducts() {
        this.isLoading = true;
        this.storeService.getMyStoreCached().subscribe({
            next: (res) => {
                this.currentStore = (res as any)?.result || res;
                if (this.currentStore) {
                    this.loadMappings();
                } else {
                    this.isLoading = false;
                    this.cdr.detectChanges();
                }
            },
            error: () => {
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    loadMappings() {
        if (!this.currentStore) return;
        
        this.isLoading = true;
        const input = {
            storeId: this.currentStore.id,
            maxResultCount: this.pageSize,
            skipCount: this.skipCount
        };

        this.storeProductService.getPagedByStore(input).subscribe({
            next: (res) => {
                this.totalProducts = res.result.totalCount;
                this.products = res.result.items.map((sp: any) => ({
                    ...sp,
                    mappingId: sp.id,
                    id: sp.productId,
                    title: sp.productName,
                    price: sp.resellerPrice,
                    image: this.parseFirstImage(sp.productImage),
                    category: sp.categoryName || 'General',
                    brand: sp.brandName || 'Generic'
                }));
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Fetch Mappings Error:', err);
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    onPageChange(page: number) {
        if (page < 1 || page > this.totalPages) return;
        this.currentPage = page;
        this.loadMappings();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    onNextPage() {
        if (this.currentPage < this.totalPages) {
            this.onPageChange(this.currentPage + 1);
        }
    }

    onPrevPage() {
        if (this.currentPage > 1) {
            this.onPageChange(this.currentPage - 1);
        }
    }

    toggleCategoryDropdown(event?: Event): void {
        event?.stopPropagation();
        this.isCategoryDropdownOpen = !this.isCategoryDropdownOpen;
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
        const target = event.target as HTMLElement | null;
        if (!target?.closest('.listing-category-filter')) {
            this.isCategoryDropdownOpen = false;
        }
    }

    onCategorySelect(categoryName: string): void {
        this.selectedCategory = categoryName;
        this.isCategoryDropdownOpen = false;
    }

    clearListingFilters() {
        this.filterText = '';
        this.selectedCategory = 'All Categories';
        this.minPriceFilter = null;
        this.maxPriceFilter = null;
        this.sortOption = 'default';
        this.isCategoryDropdownOpen = false;
    }

    parseFirstImage(imageJson: string): string {
        try {
            const images = JSON.parse(imageJson || '[]');
            return images.length > 0 ? images[0] : 'https://picsum.photos/500/500?text=No+Image';
        } catch {
            return 'https://picsum.photos/500/500?text=No+Image';
        }
    }

    smartTruncate(text: string, maxLength: number = 80): string {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    toggleActive(event: Event, type: 'heart' | 'cart') {
        event.stopPropagation();
        const target = event.currentTarget as HTMLElement;
        target.classList.toggle('active');
    }

    editProduct(p: any, event: Event) {
        event.stopPropagation();
        this.navigateToMapping(p, false);
    }

    viewProduct(p: any) {
        this.navigateToMapping(p, true);
    }

    private navigateToMapping(p: any, viewOnly: boolean) {
        // Prepare product object for the edit/view mapping page
        const productData = {
            id: p.productId,
            mappingId: p.mappingId,
            name: p.productName,
            categoryName: p.categoryName,
            brandName: p.brandName,
            supplierPrice: p.supplierPrice || (p.resellerPrice / 1.25), // Fallback if not in DTO
            resellerPrice: p.resellerPrice,
            stockQuantity: p.stockQuantity,
            handlingTime: p.handlingTime,
            images: this.parseImages(p.productImage)
        };

        this.router.navigate(['/seller/add-product'], {
            state: {
                product: productData,
                viewOnly: viewOnly
            }
        });
    }

    parseImages(imageJson: string): string[] {
        try {
            return JSON.parse(imageJson || '[]');
        } catch {
            return [];
        }
    }

    private loadCategoryOptions() {
        this.isCategoriesLoading = true;
        this.categoryService.refreshCache();
        this.categoryService.getAllCategories().subscribe({
            next: (categoriesResponse: any[]) => {
                const categories = Array.from(
                    new Set(
                        (categoriesResponse || [])
                            .map((category: any) => this.normalizeCategoryName(category?.name || category?.categoryName || category?.title))
                            .filter((value: string | null): value is string => !!value)
                    )
                ).sort((a, b) => a.localeCompare(b));

                this.categoryOptions = categories.length ? ['All Categories', ...categories] : this.getFallbackCategoryOptions();
                this.categoryTiles = this.buildCategoryTiles(this.categoryOptions.filter(category => category !== 'All Categories'));
                this.isCategoriesLoading = false;
                this.cdr.detectChanges();
            },
            error: () => {
                this.categoryOptions = this.getFallbackCategoryOptions();
                this.categoryTiles = this.buildCategoryTiles(this.categoryOptions.filter(category => category !== 'All Categories'));
                this.isCategoriesLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    private extractItems(res: any): any[] {
        return res?.result?.items || res?.items || res?.result || [];
    }

    private normalizeCategoryName(value: any): string | null {
        const name = (value ?? '').toString().trim();
        return name.length ? name : null;
    }

    private buildCategoryTiles(categories: string[]): Array<{ name: string; count: number; icon: string; tone: string; }> {
        const tones = ['tone-indigo', 'tone-emerald', 'tone-amber', 'tone-rose', 'tone-sky', 'tone-violet'];
        return categories.map((name, index) => ({
            name,
            count: 0,
            icon: this.getCategoryIcon(name),
            tone: tones[index % tones.length]
        }));
    }

    private getFallbackCategoryOptions(): string[] {
        return [
            'All Categories',
            'Electronics',
            'Watches & Jewelry',
            'Networking Products',
            'Pets And Dog Food',
            'Home Improvement',
            'Laptop Accessories',
            'Sport & Outdoors',
            'Home Decor',
            'Kitchen Accessories',
            'Office Products',
            'Baby Accessories',
            'Hand Made',
            'Personal Care',
            'Baby Monitors',
            'Baby Car Toys',
            'Bedding And Bath',
            'Inverter Generator'
        ];
    }

    private getCategoryIcon(categoryName: string): string {
        const key = categoryName.toLowerCase();
        if (key.includes('electronic') || key.includes('digital') || key.includes('laptop') || key.includes('mobile')) return 'fa-plug';
        if (key.includes('fashion') || key.includes('cloth') || key.includes('dress') || key.includes('wear')) return 'fa-shirt';
        if (key.includes('beauty') || key.includes('cosmetic') || key.includes('skin') || key.includes('personal care')) return 'fa-spa';
        if (key.includes('home') || key.includes('kitchen') || key.includes('furniture')) return 'fa-house';
        if (key.includes('sport') || key.includes('fitness') || key.includes('gym')) return 'fa-dumbbell';
        if (key.includes('food') || key.includes('grocery') || key.includes('coffee') || key.includes('pet')) return 'fa-basket-shopping';
        if (key.includes('shoe') || key.includes('footwear')) return 'fa-shoe-prints';
        if (key.includes('jewel') || key.includes('gold') || key.includes('watch')) return 'fa-gem';
        return 'fa-layer-group';
    }

    private startClock() {
        this.updateTime();
        this.zone.runOutsideAngular(() => {
            this.timer = setInterval(() => {
                this.zone.run(() => {
                    this.updateTime();
                    this.cdr.markForCheck();
                });
            }, 1000);
        });
    }

    private updateTime() {
        const now = new Date();
        this.currentTime = new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        }).format(now);

        this.currentDate = new Intl.DateTimeFormat('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }).format(now).replace(/ /g, '-');

        const hours = now.getHours() % 12;
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();

        this.hourHandRotation = (hours * 30) + (minutes * 0.5) + (seconds * (0.5 / 60));
        this.minuteHandRotation = (minutes * 6) + (seconds * 0.1);
        this.secondHandRotation = seconds * 6;
    }
}
