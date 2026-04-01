import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap, of, switchMap, catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { StorageService } from './storage.service';
import { environment } from '../../environments/environment';

export interface CartItem {
    id?: string; // Backend Guid if available
    productId: string;
    storeProductId: string;
    storeId: string;
    storeName: string;
    name: string;
    price: number;
    oldPrice: number;
    discount: number;
    quantity: number;
    image: string;
    size: string;
    color: string;
    isChecked: boolean;
    isFavorite: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class CartService {
    private http = inject(HttpClient);
    private authService = inject(AuthService);
    private storage = inject(StorageService);
    private baseUrl = `${environment.apiUrl}/api/services/app/Cart`;

    private cartItems = signal<CartItem[]>([]);
    private showCartTrigger = signal<number>(0);
    private consumedCartTrigger = 0;
    private pendingDeletes = new Set<string>(); // Track items being deleted to prevent reappearing during sync

    // Public exposures
    items = this.cartItems.asReadonly();
    cartAutoOpen = this.showCartTrigger.asReadonly();

    consumeAutoOpenTrigger(trigger: number): boolean {
        if (trigger <= 0 || trigger === this.consumedCartTrigger) {
            return false;
        }
        this.consumedCartTrigger = trigger;
        return true;
    }

    constructor() {
        if (this.authService.isAuthenticated) {
            this.refreshFromBackend().subscribe();
        }

        this.authService.isAuthenticated$.subscribe(isAuth => {
            if (isAuth) {
                this.refreshFromBackend().subscribe();
            } else {
                this.cartItems.set([]);
            }
        });
    }

    private normalizeBackendItem(item: any): CartItem {
        const product = item?.storeProduct?.product;
        const store = item?.storeProduct?.store;
        const imageSource =
            item?.imageUrl ||
            item?.productImage ||
            product?.imageUrl ||
            product?.images ||
            item?.image ||
            '';

        const cartItem: CartItem = {
            id: item?.id,
            productId: item?.productId || item?.storeProduct?.productId || product?.id || '',
            storeProductId: item?.storeProductId || item?.storeProduct?.id || '',
            storeId: item?.storeId || store?.id || item?.storeProduct?.storeId || '',
            storeName: item?.storeName || store?.name || 'Unknown Store',
            name: item?.productName || item?.productTitle || product?.name || 'Product',
            price: Number(item?.price || 0),
            oldPrice: Number(item?.originalPrice ?? item?.price ?? 0),
            discount: Number(item?.resellerDiscountPercentage || 0),
            quantity: Number(item?.quantity || 1),
            image: this.extractImageUrl(imageSource),
            size: item?.size || '',
            color: item?.color || '',
            isChecked: true,
            isFavorite: false
        };

        return cartItem;
    }

    private mergeCartItems(items: CartItem[]): CartItem[] {
        const merged = new Map<string, CartItem>();

        for (const item of items) {
            const key = [
                item.storeProductId || item.productId,
                item.storeName?.trim().toLowerCase() || '',
                item.size?.trim().toLowerCase() || '',
                item.color?.trim().toLowerCase() || ''
            ].join('__');

            const existing = merged.get(key);
            if (!existing) {
                merged.set(key, { ...item });
                continue;
            }

            merged.set(key, {
                ...existing,
                id: existing.id || item.id,
                name: existing.name || item.name,
                image: existing.image || item.image,
                quantity: existing.quantity + item.quantity,
                // Keep the latest/valid unit price for display.
                price: item.price || existing.price,
                oldPrice: Math.max(existing.oldPrice || 0, item.oldPrice || 0, item.price || 0, existing.price || 0),
                discount: Math.max(existing.discount || 0, item.discount || 0),
                isChecked: existing.isChecked || item.isChecked,
                isFavorite: existing.isFavorite || item.isFavorite
            });
        }

        return Array.from(merged.values());
    }

    private extractImageUrl(source: any): string {
        if (!source) return '';

        if (Array.isArray(source)) {
            return source.find((x) => typeof x === 'string' && x.trim().length > 0) || '';
        }

        if (typeof source === 'string') {
            const trimmed = source.trim();
            if (!trimmed) return '';

            // JSON array string
            if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || trimmed.includes('","')) {
                try {
                    const parsed = JSON.parse(trimmed);
                    if (Array.isArray(parsed)) {
                        return parsed.find((x) => typeof x === 'string' && x.trim().length > 0) || '';
                    }
                } catch {
                    // fall through
                }
            }

            // Delimited string
            if (trimmed.includes(',')) {
                return trimmed.split(',').map(s => s.trim()).find(Boolean) || trimmed;
            }
            if (trimmed.includes('|')) {
                return trimmed.split('|').map(s => s.trim()).find(Boolean) || trimmed;
            }
            if (trimmed.includes(';')) {
                return trimmed.split(';').map(s => s.trim()).find(Boolean) || trimmed;
            }

            return trimmed;
        }

        return '';
    }

    refreshFromBackend(): Observable<CartItem[]> {
        const userId = this.getUserId();
        if (!userId || !this.authService.isAuthenticated) {
            this.cartItems.set([]);
            return of([]);
        }

        console.log('[CartService] Refreshing cart for user:', userId);
        return this.http.get<any>(`${this.baseUrl}/GetCartItems`, { params: { userId: userId.toString() } }).pipe(
            map((res: any) => {
                const results = res?.result || [];
                const parsedItems = results.map((x: any) => this.normalizeBackendItem(x));
                const mergedItems = this.mergeCartItems(parsedItems);
                // Filter out any items that are pending deletion or have 0 qty
                return mergedItems.filter(i => {
                    const key = `${i.storeProductId}_${i.size}_${i.color}`;
                    return i.quantity > 0 && !this.pendingDeletes.has(key);
                });
            }),
            tap((items) => {
                console.log('[CartService] Loaded items:', items.length);
                this.cartItems.set(items);
            }),
            catchError(err => {
                console.error('[CartService] Failed to load cart from backend', err);
                return throwError(() => err);
            })
        );
    }

    get totalItems() {
        return this.cartItems().reduce((acc, item) => acc + item.quantity, 0);
    }

    get totalPrice() {
        return this.cartItems().reduce((acc, item) => acc + (item.isChecked ? item.price * item.quantity : 0), 0);
    }

    // MAIN ADD TO CART FUNCTION
    addToCart(product: any, quantity: number = 1, size: string = '', color: string = '', image: string = ''): Observable<any> {
        const spid = product.storeProductId || product.id || product.productId;
        console.log('[CartService] Adding to cart. ProductID:', spid, 'Qty:', quantity);

        // Backend-first persistence
        if (this.authService.isAuthenticated) {
            const userId = this.getUserId();
            const payload = {
                userId: userId,
                storeProductId: spid,
                quantity: quantity,
                size: size,
                color: color,
                imageUrl: image
            };
            
            console.log('[CartService] POST /AddToCart payload:', payload);
            
            return this.http.post(`${this.baseUrl}/AddToCart`, payload).pipe(
                switchMap(() => this.refreshFromBackend()),
                tap(() => {
                    this.showCartTrigger.update(v => v + 1);
                    console.log('[CartService] AddToCart success and refreshed');
                }),
                catchError(err => {
                    console.error('[CartService] POST /AddToCart failed:', err);
                    return throwError(() => err);
                })
            );
        }

        // Guest fallback in-memory only
        console.log('[CartService] Guest mode: adding to local signal');
        const current = this.cartItems();
        const existingIndex = current.findIndex(i => i.storeProductId === spid && i.size === size && i.color === color);

        if (existingIndex > -1) {
            const updated = [...current];
            updated[existingIndex].quantity += quantity;
            this.cartItems.set(updated.filter(i => i.quantity > 0));
        } else {
            this.cartItems.set([...current, {
                productId: product.productId || product.id,
                storeProductId: spid,
                storeId: product.storeId || product.store?.id || '',
                storeName: product.store?.storeName || product.storeName || 'Unknown Store',
                name: product.title || product.productName || 'Product',
                price: product.store?.price ?? product.price ?? 0,
                oldPrice: product.store?.resellerPrice ?? product.originalPrice ?? 0,
                discount: product.store?.resellerDiscountPercentage ?? product.resellerDiscountPercentage ?? 0,
                quantity,
                image: image || (product.images ? product.images[0] : ''),
                size,
                color,
                isChecked: true,
                isFavorite: false
            }]);
        }
        this.showCartTrigger.update(v => v + 1);

        return of({ success: true, message: 'Added in memory (Guest mode)' });
    }

    // BACKEND SYNC - kept for compatibility
    syncWithBackend(): Observable<any> {
        return this.refreshFromBackend();
    }

    private getUserId(): number {
        const userId = this.storage.getItem('userId') || JSON.parse(this.storage.getItem('currentUser') || '{}').id;
        return Number(userId);
    }

    updateQuantity(productId: string, size: string, color: string, newQty: number) {
        const currentItems = this.cartItems();
        const itemIndex = currentItems.findIndex(i => i.productId === productId && i.size === size && i.color === color);
        if (itemIndex === -1) return;

        const item = currentItems[itemIndex];
        
        if (newQty <= 0) {
            this.removeItem(item);
            return;
        }

        if (newQty === item.quantity) return;

        // --- Optimistic Local Update ---
        const updatedItems = [...currentItems];
        updatedItems[itemIndex] = { ...item, quantity: newQty };
        this.cartItems.set(updatedItems);

        if (!this.authService.isAuthenticated) {
            return; // Already updated locally
        }

        const userId = this.getUserId();
        if (!userId) return;

        if (newQty > item.quantity) {
            const delta = newQty - item.quantity;
            this.http.post(`${this.baseUrl}/AddToCart`, {
                userId,
                storeProductId: item.storeProductId,
                quantity: delta,
                size: item.size || '',
                color: item.color || ''
            }).pipe(
                switchMap(() => this.refreshFromBackend())
            ).subscribe();
            return;
        }

        // Decreasing quantity logic - calculate delta (negative)
        const delta = newQty - item.quantity;
        this.http.post(`${this.baseUrl}/AddToCart`, {
            userId,
            storeProductId: item.storeProductId,
            quantity: delta, // Send negative delta to decrement
            size: item.size || '',
            color: item.color || ''
        }).pipe(
            switchMap(() => this.refreshFromBackend())
        ).subscribe();
    }

    removeItem(target: CartItem | string, size: string = '', color: string = '') {
        const item = typeof target === 'string'
            ? this.cartItems().find(i => i.productId === target && i.size === size && i.color === color)
            : target;

        if (!item) return;

        const deleteKey = `${item.storeProductId}_${item.size}_${item.color}`;
        this.pendingDeletes.add(deleteKey);

        // Local immediate update for responsive UI
        this.cartItems.set(this.cartItems().filter(i => 
            !(i.storeProductId === item.storeProductId && i.size === item.size && i.color === item.color)
        ));

        // Backend update
        if (this.authService.isAuthenticated) {
            const userId = this.getUserId();
            
            this.http.post(`${this.baseUrl}/AddToCart`, {
                userId: userId,
                storeProductId: item.storeProductId,
                quantity: -item.quantity,
                size: item.size || '',
                color: item.color || ''
            }).pipe(
                switchMap(() => this.refreshFromBackend()),
                tap(() => {
                    // Once refreshed and presumably synced, we can remove from pending
                    this.pendingDeletes.delete(deleteKey);
                }),
                catchError(err => {
                    this.pendingDeletes.delete(deleteKey);
                    return throwError(() => err);
                })
            ).subscribe();
        } else {
            this.pendingDeletes.delete(deleteKey);
        }
    }

    clearCart() {
        // Local
        this.cartItems.set([]);

        // Backend
        if (this.authService.isAuthenticated) {
            this.http.delete(`${this.baseUrl}/ClearCart`, {
                params: { userId: this.getUserId().toString() }
            }).pipe(
                switchMap(() => this.refreshFromBackend())
            ).subscribe();
        }
    }

    // Checkbox logic should use storeProductId because size/color can be empty
    setItemCheckbox(storeProductId: string, checked: boolean) {
        const current = this.cartItems();
        const updated = current.map(item => {
            if (item.storeProductId === storeProductId) {
                return { ...item, isChecked: checked };
            }
            return item;
        });
        this.cartItems.set(updated);
    }

    toggleStoreCheckbox(storeName: string, checked: boolean) {
        const current = this.cartItems();
        const updated = current.map(item => {
            if (item.storeName === storeName) {
                return { ...item, isChecked: checked };
            }
            return item;
        });
        this.cartItems.set(updated);
    }

    toggleAllCheckbox(checked: boolean) {
        const current = this.cartItems();
        const updated = current.map(item => ({ ...item, isChecked: checked }));
        this.cartItems.set(updated);
    }

    getStores(): string[] {
        const stores = new Set(this.cartItems().map(item => item.storeName));
        return Array.from(stores);
    }

    isStoreChecked(storeName: string): boolean {
        const storeItems = this.cartItems().filter(item => item.storeName === storeName);
        return storeItems.length > 0 && storeItems.every(item => item.isChecked);
    }

    isAnyStoreItemChecked(storeName: string): boolean {
        return this.cartItems().filter(item => item.storeName === storeName).some(item => item.isChecked);
    }

    isAllChecked(): boolean {
        const items = this.cartItems();
        return items.length > 0 && items.every(item => item.isChecked);
    }

    getItemsByStore(storeName: string): CartItem[] {
        return this.cartItems().filter(item => item.storeName === storeName);
    }

    toggleFavorite(productId: string, size: string, color: string) {
        const current = this.cartItems();
        const updated = current.map(item => {
            if (item.productId === productId && item.size === size && item.color === color) {
                return { ...item, isFavorite: !item.isFavorite };
            }
            return item;
        });
        this.cartItems.set(updated);
    }
}
