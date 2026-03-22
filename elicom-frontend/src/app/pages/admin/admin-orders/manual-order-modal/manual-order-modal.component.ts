import { Component, OnInit, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { StoreService } from '../../../../services/store.service';
import { StoreProductService } from '../../../../services/store-product.service';
import { OrderService, CreateManualOrderDto } from '../../../../services/order.service';
import { AlertService } from '../../../../services/alert.service';

@Component({
    selector: 'app-manual-order-modal',
    standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule],
    templateUrl: './manual-order-modal.component.html',
    styleUrls: ['./manual-order-modal.component.scss']
})
export class ManualOrderModalComponent implements OnInit {
    @Output() close = new EventEmitter<void>();
    @Output() orderCreated = new EventEmitter<void>();

    private fb = inject(FormBuilder);
    private storeService = inject(StoreService);
    private storeProductService = inject(StoreProductService);
    private orderService = inject(OrderService);
    private alertService = inject(AlertService);

    orderForm: FormGroup;
    stores: any[] = [];
    products: any[] = [];
    loading = false;
    submitting = false;

    constructor() {
        this.orderForm = this.fb.group({
            storeId: ['', Validators.required],
            storeProductId: ['', Validators.required],
            quantity: [1, [Validators.required, Validators.min(1)]],
            recipientName: ['', Validators.required],
            recipientEmail: ['', [Validators.required, Validators.email]],
            recipientPhone: ['', Validators.required],
            shippingAddress: ['', Validators.required],
            city: ['', Validators.required],
            state: ['', Validators.required],
            country: ['USA', Validators.required],
            postalCode: ['', Validators.required],
            overridePrice: [null],
            notes: ['']
        });
    }

    ngOnInit() {
        this.loadStores();
    }

    loadStores() {
        this.loading = true;
        this.storeService.getStoreLookup().subscribe({
            next: (res) => {
                const payload = res?.result ?? res;
                this.stores = Array.isArray(payload?.items) ? payload.items : (Array.isArray(payload) ? payload : []);
                this.loading = false;
            },
            error: (err) => {
                console.error('Failed to load stores', err);
                this.loading = false;
            }
        });
    }

    onStoreChange() {
        const storeId = this.orderForm.get('storeId')?.value;
        this.products = [];
        this.orderForm.patchValue({ storeProductId: '' });

        if (storeId) {
            this.loading = true;
            this.storeProductService.getByStore(storeId).subscribe({
                next: (res) => {
                    const payload = res?.result ?? res;
                    this.products = Array.isArray(payload?.items) ? payload.items : (Array.isArray(payload) ? payload : []);
                    console.log('ManualOrderModal: Products loaded', this.products);
                    this.loading = false;
                },
                error: (err) => {
                    console.error('Failed to load products', err);
                    this.loading = false;
                }
            });
        }
    }

    onProductChange() {
        const productId = this.orderForm.get('storeProductId')?.value;
        if (productId) {
            const selectedProduct = this.products.find(p => p.id === productId);
            if (selectedProduct) {
                this.orderForm.patchValue({
                    overridePrice: selectedProduct.resellerPrice || 0
                });
            }
        }
    }

    randomizeBuyer() {
        const commonNames = ['James Smith', 'Maria Garcia', 'Robert Johnson', 'Patricia Miller', 'Michael Brown', 'Linda Davis', 'William Rodriguez', 'Elizabeth Martinez', 'David Hernandez', 'Jennifer Lopez'];
        const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'San Jose'];
        const states = ['NY', 'CA', 'IL', 'TX', 'AZ', 'PA', 'TX', 'CA', 'TX', 'CA'];
        
        const randomIndex = Math.floor(Math.random() * commonNames.length);
        const name = commonNames[randomIndex];
        const email = name.toLowerCase().replace(' ', '.') + Math.floor(Math.random() * 1000) + '@example.com';
        const phone = '+1 ' + Math.floor(Math.random() * 900 + 100) + '-' + Math.floor(Math.random() * 900 + 100) + '-' + Math.floor(Math.random() * 9000 + 1000);
        
        const addressNum = Math.floor(Math.random() * 9000 + 100);
        const streets = ['Oak St', 'Maple Ave', 'Washington Blvd', 'Lakeview Dr', 'Parkway Dr', 'Main St', 'Highland Ave', 'Broad St'];
        const address = `${addressNum} ${streets[Math.floor(Math.random() * streets.length)]}`;
        
        const cityIndex = Math.floor(Math.random() * cities.length);

        this.orderForm.patchValue({
            recipientName: name,
            recipientEmail: email,
            recipientPhone: phone,
            shippingAddress: address,
            city: cities[cityIndex],
            state: states[cityIndex],
            postalCode: Math.floor(Math.random() * 90000 + 10000).toString()
        });
    }

    onSubmit() {
        if (this.orderForm.invalid) {
            this.orderForm.markAllAsTouched();
            return;
        }

        this.submitting = true;
        const formValue = this.orderForm.value;
        
        this.orderService.createManualOrder(formValue).subscribe({
            next: () => {
                this.alertService.success('Manual order created successfully with System Credit.');
                this.submitting = false;
                this.orderCreated.emit();
            },
            error: (err) => {
                const message = err?.error?.error?.message || err?.error?.message || err?.message || 'Failed to create manual order';
                this.alertService.error(message);
                this.submitting = false;
            }
        });
    }
}
