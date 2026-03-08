import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class WishlistService {
    private wishlistItemsSubject = new BehaviorSubject<any[]>([]);
    public wishlistItems$ = this.wishlistItemsSubject.asObservable();

    constructor() {
        this.loadWishlist();
    }

    private loadWishlist(): void {
        const savedWishlist = localStorage.getItem('primeship_wishlist');
        if (savedWishlist) {
            try {
                this.wishlistItemsSubject.next(JSON.parse(savedWishlist));
            } catch (e) {
                console.error('Error parsing wishlist from localStorage', e);
                this.wishlistItemsSubject.next([]);
            }
        }
    }

    private saveWishlist(items: any[]): void {
        localStorage.setItem('primeship_wishlist', JSON.stringify(items));
        this.wishlistItemsSubject.next(items);
    }

    toggleWishlist(product: any): void {
        const currentItems = this.wishlistItemsSubject.value;
        const index = currentItems.findIndex(item => item.id === product.id || item.name === product.name);

        if (index > -1) {
            // Remove if exists
            currentItems.splice(index, 1);
        } else {
            // Add if not exists
            currentItems.push(product);
        }

        this.saveWishlist([...currentItems]);
    }

    isInWishlist(productIdOrName: string): boolean {
        return this.wishlistItemsSubject.value.some(item => item.id === productIdOrName || item.name === productIdOrName);
    }

    getWishlistCount(): number {
        return this.wishlistItemsSubject.value.length;
    }

    clearWishlist(): void {
        this.saveWishlist([]);
    }
}
