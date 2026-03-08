import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { CartService } from '../../../services/cart.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-card.html',
  styleUrl: './product-card.scss',
})
export class ProductCard {
  private router = inject(Router);
  private cartService = inject(CartService);

  @Input() products: any[] = [];

  // Feature toggles
  showShopName = true;
  showTrends = true;
  showDiscount = true;
  showRating = true;
  showSold = true;
  showCouponPrice = true;
  showShipping = true;


  rating = 3;
  // View More
  visibleCount = 25;

  get visibleProducts(): any[] {
    return this.products.slice(0, this.visibleCount);
  }

  get showViewMore(): boolean {
    return this.products.length > this.visibleCount;
  }

  viewMore() {
    this.visibleCount += 25;
  }

  // Helper for coupon price
  couponPrice(product: any): number {
    if (!product.couponDiscount) return product.price;
    return +(product.price - product.couponDiscount).toFixed(2);
  }

  addToCart(event: Event, product: any) {
    event.stopPropagation();

    this.cartService.addToCart(product).subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: 'Added to Cart',
          text: `${product.title || 'Product'} has been added to your cart`,
          timer: 1500,
          showConfirmButton: false
        });
      },
      error: (err) => {
        console.error(err);
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Failed to add item to cart',
        });
      }
    });
  }

  goToDetail(product: any) {
    const pId = product.productId || product.id || 'unknown';
    const sPId = product.storeProductId || product.id || 'unknown';
    this.router.navigate(['/product-detail', pId, sPId]);
  }
}
