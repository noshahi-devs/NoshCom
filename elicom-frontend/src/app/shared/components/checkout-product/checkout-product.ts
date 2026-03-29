import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CartService, CartItem } from '../../../services/cart.service';
import { SmartPricePipe } from '../../pipes/smart-price.pipe';

@Component({
  selector: 'app-checkout-product',
  standalone: true,
  imports: [CommonModule, SmartPricePipe],
  templateUrl: './checkout-product.html',
  styleUrls: ['./checkout-product.scss']
})
export class CheckoutProduct {
  cartService = inject(CartService);
  fallbackImage =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Crect width='160' height='160' rx='16' fill='%23edf1f7'/%3E%3Cpath d='M54 58h52a8 8 0 0 1 8 8v28a8 8 0 0 1-8 8H54a8 8 0 0 1-8-8V66a8 8 0 0 1 8-8Z' fill='%23d7deea'/%3E%3Ccircle cx='64' cy='70' r='7' fill='%23b8c3d7'/%3E%3Cpath d='m56 93 14-14 11 11 8-8 15 15H56Z' fill='%2394a3b8'/%3E%3C/svg%3E";

  get products(): CartItem[] {
    // Explicitly using the CartItem type to avoid 'unknown' errors
    return (this.cartService.items() as CartItem[]).filter((item: CartItem) => item.isChecked);
  }

  // Qty increase/decrease
  incrementQty(product: CartItem) {
    this.cartService.updateQuantity(product.productId, product.size, product.color, product.quantity + 1);
  }

  decrementQty(product: CartItem) {
    if (product.quantity > 1) {
      this.cartService.updateQuantity(product.productId, product.size, product.color, product.quantity - 1);
    }
  }

  onImageError(event: Event) {
    const image = event.target as HTMLImageElement;
    if (image && image.src !== this.fallbackImage) {
      image.src = this.fallbackImage;
    }
  }

  // Shipping info (single div)
  standardShipping: string = "$3.99 — Expect your package in 3-5 business days. Rest assured, your order will be handled with extra care and shipped promptly!";
}
