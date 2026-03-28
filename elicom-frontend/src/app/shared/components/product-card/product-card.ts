import { Component, Input, inject, ChangeDetectorRef } from '@angular/core';
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
  private cdr = inject(ChangeDetectorRef);

  @Input() products: any[] = [];

  favoriteKeys = new Set<string>();
  burstingFavoriteKeys = new Set<string>();

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

  stopCardClick(event: Event) {
    event.stopPropagation();
  }

  quickView(event: Event, product: any) {
    event.stopPropagation();
    this.goToDetail(product);
  }

  getBadgeLabel(product: any): string {
    if (product.discount || product.resellerDiscountPercentage) {
      return 'SALE';
    }

    return 'NEW';
  }

  getRating(product: any): number {
    return Math.max(1, Math.min(5, Number(product.rating || 5)));
  }

  getReviewCount(product: any): number {
    return Number(product.reviewCount || 128);
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

  isFavorite(product: any): boolean {
    return this.favoriteKeys.has(this.getProductKey(product));
  }

  isHeartBursting(product: any): boolean {
    return this.burstingFavoriteKeys.has(this.getProductKey(product));
  }

  toggleFavorite(event: Event, product: any): void {
    event.preventDefault();
    event.stopPropagation();

    const key = this.getProductKey(product);
    const willBeFavorite = !this.favoriteKeys.has(key);

    if (willBeFavorite) {
      this.favoriteKeys.add(key);
      this.burstingFavoriteKeys.add(key);
      window.setTimeout(() => {
        this.burstingFavoriteKeys.delete(key);
        this.cdr.detectChanges();
      }, 900);
    } else {
      this.favoriteKeys.delete(key);
      this.burstingFavoriteKeys.delete(key);
    }

    this.cdr.detectChanges();
  }

  getHeartBurstPieces(): number[] {
    return [1, 2, 3, 4, 5, 6];
  }

  private getProductKey(product: any): string {
    return ((product.storeProductId || product.id || product.productId || product.title) as string).toString();
  }

  goToDetail(product: any) {
    const pId = product.productId || product.id || 'unknown';
    const sPId = product.storeProductId || product.id || 'unknown';
    this.router.navigate(['/product-detail', pId, sPId]);
  }
}
