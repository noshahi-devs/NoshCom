import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProductListingComponent } from './product-listing.component';
import { StoreService } from '../../../services/store.service';
import { StoreProductService } from '../../../services/store-product.service';
import { AlertService } from '../../../services/alert.service';
import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';

describe('ProductListingComponent', () => {
    // Initialize Test Environment if not already done
    try {
        TestBed.initTestEnvironment(
            BrowserDynamicTestingModule,
            platformBrowserDynamicTesting()
        );
    } catch {
        // Already initialized
    }
    let component: ProductListingComponent;
    let fixture: ComponentFixture<ProductListingComponent>;
    let mockStoreService: any;
    let mockStoreProductService: any;
    let mockAlertService: any;
    let mockRouter: any;

    const mockStore = { id: 'store-123', name: 'Test Store' };
    const mockMappedProducts = {
        result: {
            items: [
                {
                    productId: 'p1',
                    productName: 'Real Product 1',
                    resellerPrice: 100,
                    productImage: '["https://img1.jpg"]',
                    categoryName: 'Electronics',
                    brandName: 'BrandA'
                },
                {
                    productId: 'p2',
                    productName: 'Gadget 2',
                    resellerPrice: 50,
                    productImage: '[]',
                    categoryName: 'Toys',
                    brandName: 'BrandB'
                }
            ]
        }
    };

    beforeEach(async () => {
        mockStoreService = {
            getMyStore: vi.fn(() => of({ result: mockStore }))
        };
        mockStoreProductService = {
            getByStore: vi.fn(() => of(mockMappedProducts))
        };
        mockAlertService = {
            error: vi.fn(),
            success: vi.fn(),
            loading: vi.fn()
        };
        mockRouter = {
            navigate: vi.fn()
        };

        await TestBed.configureTestingModule({
            imports: [ProductListingComponent],
            providers: [
                { provide: StoreService, useValue: mockStoreService },
                { provide: StoreProductService, useValue: mockStoreProductService },
                { provide: AlertService, useValue: mockAlertService },
                { provide: Router, useValue: mockRouter }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(ProductListingComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should load store and products on init', () => {
        fixture.detectChanges(); // ngOnInit

        expect(mockStoreService.getMyStore).toHaveBeenCalled();
        expect(mockStoreProductService.getByStore).toHaveBeenCalledWith('store-123');
        expect(component.products.length).toBe(2);
        expect(component.products[0].title).toBe('Real Product 1');
        expect(component.isLoading).toBe(false);
    });

    it('should handle empty store result', () => {
        mockStoreService.getMyStore = vi.fn(() => of({ result: null }));
        fixture.detectChanges();

        expect(component.isLoading).toBe(false);
        expect(component.products.length).toBe(0);
    });

    it('should parse images correctly', () => {
        const image = component.parseFirstImage('["https://test.jpg"]');
        expect(image).toBe('https://test.jpg');

        const fallback = component.parseFirstImage('invalid-json');
        expect(fallback).toContain('No+Image');
    });

    it('should filter products by title', () => {
        fixture.detectChanges();
        component.filterText = 'Real';
        expect(component.filteredProducts.length).toBe(1);
        expect(component.filteredProducts[0].title).toBe('Real Product 1');
    });

    it('should filter products by brand', () => {
        fixture.detectChanges();
        component.filterText = 'BrandB';
        expect(component.filteredProducts.length).toBe(1);
        expect(component.filteredProducts[0].title).toBe('Gadget 2');
    });

    it('should handle error when fetching mappings', () => {
        mockStoreProductService.getByStore = vi.fn(() => throwError(() => new Error('API Error')));
        fixture.detectChanges();

        expect(component.isLoading).toBe(false);
        expect(component.products.length).toBe(0);
    });

    it('should navigate to product details when viewProduct is called', () => {
        fixture.detectChanges();
        const p = component.products[0];
        component.viewProduct(p);

        expect(mockRouter.navigate).toHaveBeenCalledWith(['/seller/add-product'], expect.objectContaining({
            state: expect.objectContaining({
                product: expect.objectContaining({ id: 'p1' }),
                viewOnly: true
            })
        }));
    });
});
