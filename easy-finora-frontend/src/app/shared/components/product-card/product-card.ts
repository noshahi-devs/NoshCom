import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-card.html',
  styleUrl: './product-card.scss',
})
export class ProductCard {

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
}
