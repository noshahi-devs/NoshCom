import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { WishlistService } from '../../../core/services/wishlist.service';
import { CartService } from '../../../core/services/cart.service';
import { Observable } from 'rxjs';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-wishlist',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './wishlist.html',
  styleUrl: './wishlist.css',
})
export class WishlistComponent {
  wishlistItems$: Observable<any[]>;

  constructor(
    private wishlistService: WishlistService,
    private cartService: CartService
  ) {
    this.wishlistItems$ = this.wishlistService.wishlistItems$;
  }

  removeFromWishlist(product: any) {
    this.wishlistService.toggleWishlist(product);
    Swal.fire({
      title: 'Removed',
      text: 'Item removed from your favorites.',
      icon: 'info',
      toast: true,
      position: 'top-end',
      timer: 2000,
      showConfirmButton: false
    });
  }

  addToCart(product: any) {
    this.cartService.addToCart(product, 1);
    Swal.fire({
      title: 'Added to Cart',
      text: `${product.name} is now in your cart.`,
      icon: 'success',
      toast: true,
      position: 'top-end',
      timer: 3000,
      showConfirmButton: false
    });
  }

  clearAll() {
    Swal.fire({
      title: 'Clear Wishlist?',
      text: 'Are you sure you want to remove all items?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#f85606',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'Yes, clear it'
    }).then((result: any) => {
      if (result.isConfirmed) {
        this.wishlistService.clearWishlist();
      }
    });
  }
}
