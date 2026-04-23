import { Component, OnInit, OnDestroy, HostListener, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductService } from '../../../services/product.service';
import { StoreProductService } from '../../../services/store-product.service';
import { StoreService } from '../../../services/store.service';
import { AlertService } from '../../../services/alert.service';
import { AppPageLoaderService } from '../../../services/app-page-loader.service';
import { CategoryService } from '../../../services/category';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-add-product-mapping',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './add-product-mapping.component.html',
    styleUrls: ['./add-product-mapping.component.scss']
})
export class AddProductMappingComponent implements OnInit, OnDestroy {
    private productService = inject(ProductService);
    private storeProductService = inject(StoreProductService);
    private storeService = inject(StoreService);
    private categoryService = inject(CategoryService);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private alert = inject(AlertService);
    private pageLoader = inject(AppPageLoaderService);
    private zone = inject(NgZone);

    searchQuery: string = '';
    isSearching: boolean = false;
    isCategoriesLoading: boolean = true;
    showResults: boolean = false;
    selectedProduct: any = null;
    searchResults: any[] = [];
    rawSearchResults: any[] = [];
    allProductsCatalog: any[] = [];
    categoryTiles: { name: string; count: number; icon: string; tone: string; }[] = [];
    currentStore: any = null;
    isCategoryDropdownOpen: boolean = false;
    selectedCategoryLabel: string = 'All Category';

    product: any = null;
    selectedImage: string = '';
    maxAllowedPrice: number = 0;
    minAllowedPrice: number = 0; // NEW FIELD
    retailPrice: number = 0;
    handlingTime: number = 1;
    maxOrderQty: number = 1;
    sellerNote: string = '';
    minPriceFilter: number | null = null;
    maxPriceFilter: number | null = null;
    priceValidationError: string = '';
    sortOption: 'relevance' | 'priceLowHigh' | 'priceHighLow' | 'newest' = 'relevance';
    isViewOnly: boolean = false;
    showListingConfig: boolean = true;
    currentMappingId: string | null = null;
    isPublishing: boolean = false;
    private readonly titlePreviewLength = 92;
    private readonly previewCardCount = 10;
    currentDate: string = '';
    currentTime: string = '';
    hourHandRotation = 0;
    minuteHandRotation = 0;
    secondHandRotation = 0;
    private timer: any;

    ngOnInit() {
        this.loadStore();
        this.loadCategoryShowcase();
        this.startClock();

        // Check if we are in view-only mode from listing
        const state = window.history.state;
        if (state && state.product) {
            this.isViewOnly = !!state.viewOnly;
            this.currentMappingId = state.product.mappingId || null;
            this.selectProduct(state.product);

            // If editing/viewing existing mapping
            if (state.product.resellerPrice) {
                this.retailPrice = state.product.resellerPrice;
            }
            if (state.product.stockQuantity) {
                this.maxOrderQty = state.product.stockQuantity;
            } else {
                this.maxOrderQty = 1;
            }
            if (state.product.handlingTime) {
                this.handlingTime = state.product.handlingTime;
            } else {
                this.handlingTime = 1; // Default if not found
            }
        }
    }

    ngOnDestroy(): void {
        if (this.timer) {
            clearInterval(this.timer);
        }
    }

    loadStore() {
        this.storeService.getMyStoreCached().subscribe({
            next: (res) => {
                this.currentStore = (res as any)?.result || res;
                this.cdr.detectChanges();
            }
        });
    }

    get displayStoreName(): string {
        return (this.currentStore?.name || 'Your Store').toString().trim();
    }

    get joinedDateLabel(): string {
        const createdAt = this.currentStore?.createdAt;
        if (!createdAt) return 'Joined Date: --/--/----';
        const formatted = new Intl.DateTimeFormat('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric'
        }).format(new Date(createdAt));
        return `Joined Date: ${formatted}`;
    }

    private startClock(): void {
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

    private updateTime(): void {
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/New_York',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        const dateFormatter = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'America/New_York',
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });

        this.currentTime = formatter.format(now);
        this.currentDate = dateFormatter.format(now).replace(/ /g, '-');

        const ny = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const hours = ny.getHours();
        const minutes = ny.getMinutes();
        const seconds = ny.getSeconds();
        const hours12 = hours % 12;
        this.hourHandRotation = (hours12 + minutes / 60 + seconds / 3600) * 30;
        this.minuteHandRotation = (minutes + seconds / 60) * 6;
        this.secondHandRotation = seconds * 6;
    }

    toggleCategoryDropdown(event?: Event): void {
        event?.stopPropagation();
        this.isCategoryDropdownOpen = !this.isCategoryDropdownOpen;
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent): void {
        const target = event.target as HTMLElement | null;
        if (!target?.closest('.ap-filter-container')) {
            this.isCategoryDropdownOpen = false;
        }
    }

    onSearch() {
        if (!this.searchQuery) {
            this.showResults = false;
            this.rawSearchResults = [];
            return;
        }
        this.isSearching = true;
        this.productService.search(this.searchQuery).subscribe({
            next: (res) => {
                this.isSearching = false;
                console.log('Search Results:', res.result.items);
                this.rawSearchResults = res.result.items.map((p: any) => ({
                    ...p,
                    supplierPriceResolved: this.resolveSupplierPriceValue(p),
                    images: this.parseImages(p.images)
                }));
                this.applySearchFilters();
                this.showResults = true;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Search Error:', err);
                this.isSearching = false;
                this.cdr.detectChanges();
            }
        });
    }

    onCategoryQuickSearch(categoryName: string) {
        this.searchQuery = categoryName === 'All Category' ? '' : categoryName;
        this.selectedCategoryLabel = categoryName;
        this.isCategoryDropdownOpen = false;

        if (categoryName === 'All Category') {
            this.showAllCategoryPreview();
            return;
        }

        this.loadProductsForCategory(categoryName);
    }

    parseImages(imageJson: any): string[] {
        if (Array.isArray(imageJson)) return imageJson;
        try {
            return JSON.parse(imageJson || '[]');
        } catch {
            return ['https://picsum.photos/500/500?text=No+Image'];
        }
    }

    private loadCategoryShowcase() {
        this.isCategoriesLoading = true;
        this.categoryService.refreshCache();
        this.categoryService.getAllCategories().subscribe({
            next: (categories: any[]) => {
                const categoryNames = Array.from(
                    new Set(
                        (categories || [])
                            .map((category: any) => this.normalizeCategoryName(category?.name || category?.categoryName || category?.title))
                            .filter((name): name is string => !!name)
                    )
                );

                this.categoryTiles = categoryNames.length
                    ? this.buildCategoryTiles(categoryNames.map((name) => ({ name, count: 0 })))
                    : this.getFallbackCategoryTiles();

                this.isCategoriesLoading = false;
                this.showAllCategoryPreview();
                this.cdr.detectChanges();
            },
            error: () => {
                this.isCategoriesLoading = false;
                this.categoryTiles = this.getFallbackCategoryTiles();
                this.showAllCategoryPreview();
                this.cdr.detectChanges();
            }
        });
    }

    private applyCategoryFilter(categoryName: string) {
        if (categoryName === 'All Category') {
            this.showAllCategoryPreview();
            return;
        }

        const target = this.normalizeCategoryName(categoryName)?.toLowerCase() || '';

        const filtered = this.allProductsCatalog.filter((item: any) => {
            const cat = this.normalizeCategoryName(item?.categoryName || item?.category?.name || item?.category);
            return !!cat && cat.toLowerCase() === target;
        });

        this.rawSearchResults = filtered.map((p: any) => ({
            ...p,
            supplierPriceResolved: this.resolveSupplierPriceValue(p),
            images: this.parseImages(p.images)
        }));
        this.applySearchFilters();
        this.showResults = true;
    }

    onFiltersChanged(): void {
        if (this.minPriceFilter != null && this.maxPriceFilter != null && Number(this.maxPriceFilter) < Number(this.minPriceFilter)) {
            this.priceValidationError = 'Max Price cannot be less than Min Price.';
            return;
        }

        this.priceValidationError = '';
        this.applySearchFilters();
    }

    clearSearchFilters(): void {
        this.minPriceFilter = null;
        this.maxPriceFilter = null;
        this.priceValidationError = '';
        this.sortOption = 'relevance';
        this.applySearchFilters();
    }

    private applySearchFilters(): void {
        if (this.priceValidationError) {
            return;
        }

        let results = [...this.rawSearchResults];

        if (this.minPriceFilter != null && Number.isFinite(Number(this.minPriceFilter))) {
            const min = Number(this.minPriceFilter);
            results = results.filter(item => this.resolveSupplierPriceValue(item) >= min);
        }

        if (this.maxPriceFilter != null && Number.isFinite(Number(this.maxPriceFilter))) {
            const max = Number(this.maxPriceFilter);
            results = results.filter(item => this.resolveSupplierPriceValue(item) <= max);
        }

        if (this.sortOption === 'priceLowHigh') {
            results.sort((a, b) => this.resolveSupplierPriceValue(a) - this.resolveSupplierPriceValue(b));
        } else if (this.sortOption === 'priceHighLow') {
            results.sort((a, b) => this.resolveSupplierPriceValue(b) - this.resolveSupplierPriceValue(a));
        } else if (this.sortOption === 'newest') {
            results.sort((a, b) => {
                const aTime = new Date(a?.creationTime || a?.createdAt || 0).getTime();
                const bTime = new Date(b?.creationTime || b?.createdAt || 0).getTime();
                return bTime - aTime;
            });
        }

        this.searchResults = results;
    }

    private showAllCategoryPreview(): void {
        const previewSource = (this.categoryTiles.length ? this.categoryTiles : this.getFallbackCategoryTiles())
            .slice(0, this.previewCardCount);

        this.isSearching = false;
        this.rawSearchResults = previewSource.map((tile, index) => ({
            id: `preview-${index + 1}`,
            name: `${tile.name} Featured Preview Product`,
            categoryName: tile.name,
            brandName: 'Preview Catalog',
            supplierPrice: 0,
            supplierPriceResolved: 0,
            images: [`https://picsum.photos/seed/noshcom-preview-${index + 1}/500/500`],
            isPreviewPlaceholder: true
        }));
        this.searchResults = [...this.rawSearchResults];
        this.showResults = true;
        this.priceValidationError = '';
    }

    private loadProductsForCategory(categoryName: string): void {
        this.isSearching = true;
        this.productService.search(categoryName).subscribe({
            next: (res: any) => {
                const items = this.extractItems(res);
                this.rawSearchResults = items
                    .filter((item: any) => {
                        const cat = this.normalizeCategoryName(item?.categoryName || item?.category?.name || item?.category);
                        return !!cat && cat.toLowerCase() === categoryName.toLowerCase();
                    })
                    .map((p: any) => ({
                        ...p,
                        supplierPriceResolved: this.resolveSupplierPriceValue(p),
                        images: this.parseImages(p.images)
                    }));

                this.showResults = true;
                this.isSearching = false;
                this.applySearchFilters();
                this.cdr.detectChanges();
            },
            error: () => {
                this.rawSearchResults = [];
                this.searchResults = [];
                this.showResults = true;
                this.isSearching = false;
                this.cdr.detectChanges();
            }
        });
    }

    private extractItems(res: any): any[] {
        if (Array.isArray(res)) return res;
        if (res?.result?.items && Array.isArray(res.result.items)) return res.result.items;
        if (res?.result && Array.isArray(res.result)) return res.result;
        if (res?.items && Array.isArray(res.items)) return res.items;
        return [];
    }

    private normalizeCategoryName(value: any): string | null {
        const name = (value ?? '').toString().trim();
        return name.length ? name : null;
    }

    private getCategoryIcon(categoryName: string): string {
        const key = categoryName.toLowerCase();
        if (key.includes('electronic') || key.includes('digital') || key.includes('laptop') || key.includes('mobile')) return 'fa-plug';
        if (key.includes('fashion') || key.includes('cloth') || key.includes('dress') || key.includes('wear')) return 'fa-shirt';
        if (key.includes('beauty') || key.includes('cosmetic') || key.includes('skin')) return 'fa-spa';
        if (key.includes('home') || key.includes('kitchen') || key.includes('furniture')) return 'fa-house';
        if (key.includes('sport') || key.includes('fitness') || key.includes('gym')) return 'fa-dumbbell';
        if (key.includes('food') || key.includes('grocery') || key.includes('coffee')) return 'fa-basket-shopping';
        if (key.includes('shoe') || key.includes('footwear')) return 'fa-shoe-prints';
        if (key.includes('jewel') || key.includes('gold')) return 'fa-gem';
        return 'fa-layer-group';
    }

    private buildCategoryTiles(entries: Array<{ name: string; count: number }>): Array<{ name: string; count: number; icon: string; tone: string; }> {
        const tones = ['tone-indigo', 'tone-emerald', 'tone-amber', 'tone-rose', 'tone-sky', 'tone-violet'];
        return entries.map((entry, index) => ({
            name: entry.name,
            count: entry.count,
            icon: this.getCategoryIcon(entry.name),
            tone: tones[index % tones.length]
        }));
    }

    private getFallbackCategoryTiles(): Array<{ name: string; count: number; icon: string; tone: string; }> {
        return this.buildCategoryTiles([
            { name: 'Electronics', count: 0 },
            { name: 'Watches & Jewelry', count: 0 },
            { name: 'Networking Products', count: 0 },
            { name: 'Pets And Dog Food', count: 0 },
            { name: 'Home Improvement', count: 0 },
            { name: 'Laptop Accessories', count: 0 },
            { name: 'Sport & Outdoors', count: 0 },
            { name: 'Home Decor', count: 0 },
            { name: 'Kitchen Accessories', count: 0 },
            { name: 'Office Products', count: 0 },
            { name: 'Baby Accessories', count: 0 },
            { name: 'Hand Made', count: 0 },
            { name: 'Personal Care', count: 0 },
            { name: 'Baby Monitors', count: 0 },
            { name: 'Baby Car Toys', count: 0 },
            { name: 'Bedding And Bath', count: 0 },
            { name: 'Inverter Generator', count: 0 }
        ]);
    }

    getPreviewTitle(value: string): string {
        const text = (value || '').trim();
        if (text.length <= this.titlePreviewLength) return text;
        return `${text.slice(0, this.titlePreviewLength).trimEnd()}...`;
    }

    isTitleTruncated(value: string): boolean {
        return (value || '').trim().length > this.titlePreviewLength;
    }

    private resolveSupplierPriceValue(product: any): number {
        return Number(product?.supplierPrice || 0);
    }

    private getCurrentSupplierPrice(): number {
        return this.resolveSupplierPriceValue(this.product);
    }

    selectProduct(prod: any) {
        if (prod?.isPreviewPlaceholder) {
            this.alert.info('Please select a category to load live supplier products.');
            return;
        }

        const resolvedSupplierPrice = this.resolveSupplierPriceValue(prod);
        const normalizedProduct = {
            ...prod,
            supplierPriceResolved: resolvedSupplierPrice
        };

        this.product = normalizedProduct;
        this.selectedProduct = normalizedProduct;
        this.selectedImage = (normalizedProduct.images && normalizedProduct.images.length > 0) ? normalizedProduct.images[0] : '';
        this.showListingConfig = true;

        // Calculate Min and Max Allowed Prices based on supplier price
        // Min = Supplier Price + 40% (SupplierPrice * 1.40)
        // Max = Supplier Price + 167% (SupplierPrice * 2.67)
        const minAllowedPrice = Number((resolvedSupplierPrice * 1.40).toFixed(2));
        const maxAllowedPrice = Number((resolvedSupplierPrice * 2.67).toFixed(2));

        // Default retail price is min allowed if not already set (e.g. not from existing mapping)
        if (!this.currentMappingId) {
            this.retailPrice = minAllowedPrice;
        }

        this.showResults = false;
        this.minAllowedPrice = minAllowedPrice;
        this.maxAllowedPrice = maxAllowedPrice;
        this.searchQuery = '';
        this.cdr.detectChanges();
    }

    calculatePrice() {
        // No longer used for markup calculation
    }

    selectImage(img: string) {
        this.selectedImage = img;
    }

    cancelSearch() {
        if (this.currentMappingId || this.isViewOnly) {
            this.router.navigate(['/seller/listings']);
            return;
        }
        this.product = null;
        this.selectedProduct = null;
        this.showResults = false;
        this.searchQuery = '';
    }

    publishToStore() {
        if (!this.currentStore) {
            this.alert.error('Store details not loaded. Please try again.');
            return;
        }

        if (this.retailPrice > this.maxAllowedPrice) {
            this.alert.error(`Price exceeds the maximum allowed limit of $${this.maxAllowedPrice}`);
            return;
        }

        const supplierPrice = this.getCurrentSupplierPrice();
        if (this.retailPrice < this.minAllowedPrice) {
            this.alert.error(`Price cannot be lower than the minimum allowed price of $${this.minAllowedPrice}`);
            return;
        }

        if (this.handlingTime > 4 || this.handlingTime <= 0) {
            this.alert.error('Handling Time must be between 1 and 4 days.');
            return;
        }

        if (this.maxOrderQty > 15 || this.maxOrderQty <= 0) {
            this.alert.error('Max Order Quantity must be between 1 and 15 units.');
            return;
        }

        this.isPublishing = true;
        this.cdr.detectChanges();

        const mapping: any = {
            storeId: this.currentStore.id,
            productId: this.product.id,
            resellerPrice: this.retailPrice,
            stockQuantity: this.maxOrderQty,
            handlingTime: this.handlingTime,
            sellerNote: this.sellerNote,
            status: true
        };

        if (this.currentMappingId) {
            mapping.id = this.currentMappingId;
            this.startGlobalLoader();
            this.storeProductService.update(mapping).subscribe({
                next: async () => {
                    this.stopGlobalLoader();
                    this.isPublishing = false;
                    this.cdr.detectChanges();
                    const result = await this.alert.success('Listing updated successfully!');
                    if (!result.isConfirmed) {
                        return;
                    }
                    this.alert.forceCleanup();
                    this.showListingConfig = false;
                    this.router.navigate(['/seller/listings']);
                },
                error: (err) => {
                    this.stopGlobalLoader();
                    this.isPublishing = false;
                    this.cdr.detectChanges();
                    this.alert.error(err?.error?.error?.message || 'Failed to update listing.');
                }
            });
        } else {
            this.startGlobalLoader();
            this.storeProductService.mapProductToStore(mapping).subscribe({
                next: async () => {
                    this.stopGlobalLoader();
                    this.isPublishing = false;
                    this.cdr.detectChanges();
                    try {
                        const publishedId = (mapping?.productId || this.product?.id || '').toString();
                        if (publishedId) {
                            localStorage.setItem('lastPublishedProductId', publishedId);
                        }
                    } catch {
                        // no-op
                    }
                    const result = await this.alert.success('Product mapped to your store successfully!');
                    if (!result.isConfirmed) {
                        return;
                    }
                    this.alert.forceCleanup();
                    this.showListingConfig = false;
                    this.router.navigate(['/seller/listings']);
                },
                error: (err) => {
                    this.stopGlobalLoader();
                    this.isPublishing = false;
                    this.cdr.detectChanges();
                    const errorMsg = err?.error?.error?.message || 'Failed to map product.';
                    if (errorMsg.toLowerCase().includes('already mapped')) {
                        Swal.fire({
                            customClass: {
                                popup: 'sui-swal-popup',
                                confirmButton: 'sui-btn-primary',
                                cancelButton: 'sui-btn-outline'
                            },
                            buttonsStyling: false,
                            title: 'ALREADY LISTED',
                            text: 'This product is already listed in your store. Would you like to update the existing listing with these new details?',
                            icon: 'info',
                            showCancelButton: true,
                            confirmButtonText: 'Update',
                            cancelButtonText: 'Cancel'
                        }).then((result) => {
                            if (result.isConfirmed) {
                                this.updateExistingMapping(mapping);
                            }
                        });
                    } else {
                        this.alert.error(errorMsg);
                    }
                }
            });
        }
    }

    updateExistingMapping(mapping: any) {
        this.startGlobalLoader();
        this.storeProductService.getByStore(this.currentStore.id).subscribe({
            next: (res: any) => {
                const existing = res.result?.items?.find((item: any) => item.productId === mapping.productId) 
                              || res.result?.find((item: any) => item.productId === mapping.productId)
                              || res?.items?.find((item: any) => item.productId === mapping.productId)
                              || res?.find((item: any) => item.productId === mapping.productId);
                              
                if (existing) {
                    mapping.id = existing.id;
                    this.startGlobalLoader();
                    this.storeProductService.update(mapping).subscribe({
                        next: async () => {
                            this.stopGlobalLoader();
                            const result = await this.alert.success('Listing updated successfully!');
                            if (!result.isConfirmed) {
                                return;
                            }
                            this.alert.forceCleanup();
                            this.showListingConfig = false;
                            this.router.navigate(['/seller/listings']);
                        },
                        error: (err) => {
                            this.stopGlobalLoader();
                            this.alert.error(err?.error?.error?.message || 'Failed to update listing.');
                        }
                    });
                } else {
                    this.stopGlobalLoader();
                    this.alert.error('Failed to find existing listing to update.');
                }
            },
            error: () => {
                this.stopGlobalLoader();
                this.alert.error('Failed to fetch existing listing.');
            }
        });
    }

    private startGlobalLoader(): void {
        this.pageLoader.startInitialLoad();
    }

    private stopGlobalLoader(): void {
        this.pageLoader.onNavigationSettled();
        this.pageLoader.markDataArrived();
    }
}
