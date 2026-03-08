import { Component, OnInit } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WishlistService } from '../../core/services/wishlist.service';
import { CartService } from '../../core/services/cart.service';

@Component({
    selector: 'app-wishlist',
    standalone: true,
    imports: [CommonModule, CurrencyPipe, RouterLink],
    templateUrl: './wishlist.component.html',
    styleUrl: './wishlist.component.scss'
})
export class WishlistComponent implements OnInit {
    wishlistItems: any[] = [];

    constructor(
        private wishlistService: WishlistService,
        private cartService: CartService
    ) { }

    ngOnInit(): void {
        this.wishlistService.wishlistItems$.subscribe(items => {
            this.wishlistItems = items;
        });
    }

    removeFromWishlist(product: any): void {
        this.wishlistService.toggleWishlist(product);
    }

    moveToCart(product: any): void {
        this.cartService.addToCart(product, 1);
        this.wishlistService.toggleWishlist(product);
    }

    clearAll(): void {
        this.wishlistService.clearWishlist();
    }
}
