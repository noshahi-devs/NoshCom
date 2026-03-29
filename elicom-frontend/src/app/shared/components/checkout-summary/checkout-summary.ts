import { CommonModule } from '@angular/common';
import { Component, inject, Input, Output, EventEmitter } from '@angular/core';
import { CartService, CartItem } from '../../../services/cart.service';
import { CheckoutProduct } from '../checkout-product/checkout-product';
import { SmartPricePipe } from '../../pipes/smart-price.pipe';

@Component({
  selector: 'app-checkout-summary',
  standalone: true,
  imports: [CommonModule, CheckoutProduct, SmartPricePipe],
  templateUrl: './checkout-summary.html',
  styleUrl: './checkout-summary.scss',
})
export class CheckoutSummary {
  cartService = inject(CartService);

  @Input() disablePlaceOrder: boolean = false;
  @Input() showPlaceOrder: boolean = true;
  @Output() placeOrder = new EventEmitter<void>();

  readonly PLATFORM_TAX_RATE = 0; // 0%
  readonly DELIVERY_RATE = 0; // 0%

  get itemsCount(): number {
    return (this.cartService.items() as CartItem[])
      .filter(i => i.isChecked)
      .reduce((acc, i) => acc + i.quantity, 0);
  }

  get retailPrice(): number {
    return (this.cartService.items() as CartItem[])
      .filter(p => p.isChecked)
      .reduce((sum, p) => sum + (p.oldPrice || p.price) * p.quantity, 0);
  }

  get subtotal(): number {
    return this.cartService.totalPrice;
  }

  get totalSavings(): number {
    return Math.max(this.retailPrice - this.subtotal, 0);
  }

  get deliveryCharges(): number {
    if (this.subtotal <= 0) return 0;
    return parseFloat((this.subtotal * this.DELIVERY_RATE).toFixed(2));
  }

  get platformTax(): number {
    if (this.subtotal <= 0) return 0;
    return parseFloat((this.subtotal * this.PLATFORM_TAX_RATE).toFixed(2));
  }

  get orderTotal(): number {
    return parseFloat((this.subtotal + this.deliveryCharges + this.platformTax).toFixed(2));
  }
}
