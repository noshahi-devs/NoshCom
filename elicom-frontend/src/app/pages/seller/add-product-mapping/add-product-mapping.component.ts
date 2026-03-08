import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProductService } from '../../../services/product.service';
import { StoreProductService } from '../../../services/store-product.service';
import { StoreService } from '../../../services/store.service';
import { AlertService } from '../../../services/alert.service';

@Component({
    selector: 'app-add-product-mapping',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './add-product-mapping.component.html',
    styleUrls: ['./add-product-mapping.component.scss']
})
export class AddProductMappingComponent implements OnInit {
    private productService = inject(ProductService);
    private storeProductService = inject(StoreProductService);
    private storeService = inject(StoreService);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    private alert = inject(AlertService);

    searchQuery: string = '';
    isSearching: boolean = false;
    isCategoriesLoading: boolean = true;
    showResults: boolean = false;
    selectedProduct: any = null;
    searchResults: any[] = [];
    allProductsCatalog: any[] = [];
    categoryTiles: { name: string; count: number; icon: string; tone: string; }[] = [];
    currentStore: any = null;

    product: any = null;
    selectedImage: string = '';
    maxAllowedPrice: number = 0;
    minAllowedPrice: number = 0; // NEW FIELD
    retailPrice: number = 0;
    handlingTime: number = 0;
    maxOrderQty: number = 0;
    sellerNote: string = '';
    isViewOnly: boolean = false;
    currentMappingId: string | null = null;
    private readonly titlePreviewLength = 92;

    ngOnInit() {
        this.loadStore();
        this.loadCategoryShowcase();

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
            }
        }
    }

    loadStore() {
        this.storeService.getMyStoreCached().subscribe({
            next: (res) => {
                this.currentStore = (res as any)?.result || res;
            }
        });
    }

    onSearch() {
        if (!this.searchQuery) {
            this.showResults = false;
            return;
        }
        this.isSearching = true;
        this.productService.search(this.searchQuery).subscribe({
            next: (res) => {
                this.isSearching = false;
                console.log('Search Results:', res.result.items);
                this.searchResults = res.result.items.map((p: any) => ({
                    ...p,
                    supplierPriceResolved: this.resolveSupplierPriceValue(p),
                    images: this.parseImages(p.images)
                }));
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
        this.searchQuery = categoryName;

        if (!this.allProductsCatalog.length) {
            this.isSearching = true;
            this.productService.getAll().subscribe({
                next: (res: any) => {
                    this.allProductsCatalog = this.extractItems(res);
                    this.applyCategoryFilter(categoryName);
                    this.isSearching = false;
                    this.cdr.detectChanges();
                },
                error: () => {
                    this.searchResults = [];
                    this.showResults = true;
                    this.isSearching = false;
                    this.cdr.detectChanges();
                }
            });
            return;
        }

        this.applyCategoryFilter(categoryName);
        this.cdr.detectChanges();
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
        this.productService.getAll().subscribe({
            next: (res: any) => {
                const items = this.extractItems(res);
                this.allProductsCatalog = items;
                const counts = new Map<string, number>();

                items.forEach((item: any) => {
                    const category = this.normalizeCategoryName(item?.categoryName || item?.category?.name || item?.category);
                    if (!category) return;
                    counts.set(category, (counts.get(category) || 0) + 1);
                });

                const tones = ['tone-indigo', 'tone-emerald', 'tone-amber', 'tone-rose', 'tone-sky', 'tone-violet'];
                this.categoryTiles = Array.from(counts.entries())
                    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
                    .map(([name, count], index) => ({
                        name,
                        count,
                        icon: this.getCategoryIcon(name),
                        tone: tones[index % tones.length]
                    }));

                this.isCategoriesLoading = false;
                this.cdr.detectChanges();
            },
            error: () => {
                this.isCategoriesLoading = false;
                this.categoryTiles = [];
                this.cdr.detectChanges();
            }
        });
    }

    private applyCategoryFilter(categoryName: string) {
        const target = this.normalizeCategoryName(categoryName)?.toLowerCase() || '';

        const filtered = this.allProductsCatalog.filter((item: any) => {
            const cat = this.normalizeCategoryName(item?.categoryName || item?.category?.name || item?.category);
            return !!cat && cat.toLowerCase() === target;
        });

        this.searchResults = filtered.map((p: any) => ({
            ...p,
            supplierPriceResolved: this.resolveSupplierPriceValue(p),
            images: this.parseImages(p.images)
        }));
        this.showResults = true;
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

    getPreviewTitle(value: string): string {
        const text = (value || '').trim();
        if (text.length <= this.titlePreviewLength) return text;
        return `${text.slice(0, this.titlePreviewLength).trimEnd()}...`;
    }

    isTitleTruncated(value: string): boolean {
        return (value || '').trim().length > this.titlePreviewLength;
    }

    private resolveSupplierPriceValue(product: any): number {
        const supplierPrice = Number(product?.supplierPrice || 0);
        const resellerMaxPrice = Number(product?.resellerMaxPrice || 0);
        const discountPercentage = Math.max(0, Math.min(100, Number(product?.discountPercentage || 0)));

        if (resellerMaxPrice > 0) {
            const discountedFromMax = Number(
                (resellerMaxPrice - (resellerMaxPrice * discountPercentage / 100)).toFixed(2)
            );

            if (discountPercentage > 0) {
                return Math.max(0, discountedFromMax);
            }

            if (supplierPrice > 0 && supplierPrice <= resellerMaxPrice) {
                return Number(supplierPrice.toFixed(2));
            }

            return Number(resellerMaxPrice.toFixed(2));
        }

        return Number(Math.max(0, supplierPrice).toFixed(2));
    }

    private getCurrentSupplierPrice(): number {
        return this.resolveSupplierPriceValue(this.product);
    }

    selectProduct(prod: any) {
        const resolvedSupplierPrice = this.resolveSupplierPriceValue(prod);
        const normalizedProduct = {
            ...prod,
            supplierPriceResolved: resolvedSupplierPrice
        };

        this.product = normalizedProduct;
        this.selectedProduct = normalizedProduct;
        this.selectedImage = (normalizedProduct.images && normalizedProduct.images.length > 0) ? normalizedProduct.images[0] : '';

        // Calculate Min and Max Allowed Prices
        // Min = Supplier Price + 40% (SupplierPrice * 1.40)
        // Max = Supplier Price + 167% (SupplierPrice * 2.67) 
        const minAllowedPrice = Number((resolvedSupplierPrice * 1.40).toFixed(2));
        const maxAllowedPrice = Number((resolvedSupplierPrice * 2.67).toFixed(2));

        // Default retail price is supplier price if not already set (e.g. not from existing mapping)
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

        const mapping: any = {
            storeId: this.currentStore.id,
            productId: this.product.id,
            resellerPrice: this.retailPrice,
            stockQuantity: this.maxOrderQty,
            sellerNote: this.sellerNote,
            status: true
        };

        if (this.currentMappingId) {
            mapping.id = this.currentMappingId;
            this.alert.loading('UPDATING LISTING...');
            this.storeProductService.update(mapping).subscribe({
                next: () => {
                    this.alert.success('Listing updated successfully!');
                    this.router.navigate(['/seller/listings']);
                },
                error: (err) => {
                    this.alert.error(err?.error?.error?.message || 'Failed to update listing.');
                }
            });
        } else {
            this.alert.loading('PUBLISHING TO STORE...');
            this.storeProductService.mapProductToStore(mapping).subscribe({
                next: () => {
                    this.alert.success('Product mapped to your store successfully!');
                    this.router.navigate(['/seller/listings']);
                },
                error: (err) => {
                    this.alert.error(err?.error?.error?.message || 'Failed to map product.');
                }
            });
        }
    }
}
