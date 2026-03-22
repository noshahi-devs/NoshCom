import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { StoreService } from '../../../services/store.service';
import { StoreProductService } from '../../../services/store-product.service';
import { AlertService } from '../../../services/alert.service';

@Component({
    selector: 'app-product-listing',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule],
    templateUrl: './product-listing.component.html',
    styleUrls: ['./product-listing.component.scss']
})
export class ProductListingComponent implements OnInit {
    private storeService = inject(StoreService);
    private storeProductService = inject(StoreProductService);
    private alert = inject(AlertService);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);
    protected readonly Math = Math;

    products: any[] = [];
    filterText: string = '';
    isLoading: boolean = true;
    currentStore: any = null;

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
        if (!this.filterText) return this.products;
        const search = this.filterText.toLowerCase();
        return this.products.filter(p =>
            p.title.toLowerCase().includes(search) ||
            p.brand.toLowerCase().includes(search) ||
            p.category.toLowerCase().includes(search) ||
            p.id.toLowerCase().includes(search)
        );
    }

    ngOnInit() {
        this.loadStoreAndProducts();
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
}
