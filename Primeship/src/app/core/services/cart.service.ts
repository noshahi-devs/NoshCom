import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface CartItem {
    product: any;
    quantity: number;
    size?: string;
    color?: string;
}

@Injectable({
    providedIn: 'root'
})
export class CartService {
    private cartItemsSubject = new BehaviorSubject<CartItem[]>([]);
    public cartItems$ = this.cartItemsSubject.asObservable();

    constructor() {
        this.loadCart();
    }

    private loadCart(): void {
        const savedCart = localStorage.getItem('primeship_cart');
        if (savedCart) {
            const items: CartItem[] = JSON.parse(savedCart);
            const normalized = this.normalizeItems(items);
            this.cartItemsSubject.next(normalized);
        }
    }

    private saveCart(items: CartItem[]): void {
        localStorage.setItem('primeship_cart', JSON.stringify(items));
        this.cartItemsSubject.next(items);
    }

    addToCart(product: any, quantity: number, size?: string, color?: string): void {
        const resolvedId = this.resolveProductId(product);
        if (!resolvedId) {
            console.warn('[CartService] Missing product id. Item not added.', product);
            return;
        }
        product.id = resolvedId;
        const currentItems = this.cartItemsSubject.value;
        const existingItemIndex = currentItems.findIndex(item =>
            item.product.id === product.id &&
            item.size === size &&
            item.color === color
        );

        if (existingItemIndex > -1) {
            currentItems[existingItemIndex].quantity += quantity;
        } else {
            currentItems.push({ product, quantity, size, color });
        }

        this.saveCart([...currentItems]);
    }

    removeFromCart(index: number): void {
        const currentItems = this.cartItemsSubject.value;
        currentItems.splice(index, 1);
        this.saveCart([...currentItems]);
    }

    updateQuantity(index: number, quantity: number): void {
        const currentItems = this.cartItemsSubject.value;
        if (quantity > 0) {
            currentItems[index].quantity = quantity;
            this.saveCart([...currentItems]);
        }
    }

    clearCart(): void {
        this.saveCart([]);
    }

    setCartItems(items: CartItem[]): void {
        const normalized = this.normalizeItems(items);
        this.saveCart(normalized);
    }

    private normalizeItems(items: CartItem[]): CartItem[] {
        return (items || []).filter(item => {
            const resolvedId = this.resolveProductId(item.product);
            if (!resolvedId) return false;
            item.product.id = resolvedId;
            return true;
        });
    }

    private resolveProductId(product: any): string | null {
        const emptyGuid = '00000000-0000-0000-0000-000000000000';
        const guidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
        const candidates = [
            product?.productId,
            product?.ProductId,
            product?.id,
            product?.storeProductId
        ].map(v => (v ?? '').toString()).filter(v => v);

        for (const c of candidates) {
            if (c === emptyGuid) continue;
            if (guidRegex.test(c)) return c;
        }
        return null;
    }

    getCartTotal(): number {
        return this.cartItemsSubject.value.reduce((total, item) => {
            const rawPrice = item.product?.supplierPrice ?? item.product?.purchasePrice ?? item.product?.price ?? 0;
            const normalizedPrice = this.toNumber(rawPrice);
            const normalizedQty = this.toNumber(item.quantity);
            return total + (normalizedPrice * normalizedQty);
        }, 0);
    }

    getCartCount(): number {
        return this.cartItemsSubject.value.reduce((count, item) =>
            count + item.quantity, 0
        );
    }

    private toNumber(value: unknown): number {
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : 0;
        }

        if (typeof value === 'string') {
            // Handle values like "$1,299.50" safely.
            const cleaned = value.replace(/[^0-9.-]/g, '');
            const parsed = Number(cleaned);
            return Number.isFinite(parsed) ? parsed : 0;
        }

        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
}
