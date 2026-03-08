import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-checkout-product',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './checkout-product.html',
  styleUrls: ['./checkout-product.scss']
})
export class CheckoutProduct {

  // Product list
  @Input() products: any[] = [
    {
      shopName: 'STARTSHIPPER',
      imageUrl: 'assets/images/2.webp',
      price: 10.01,
      oldPrice: 31.19,
      discount: 68,
      quantity: 1
    },
    {
      shopName: 'SHEIN',
      imageUrl: 'assets/images/3.webp',
      price: 12.5,
      oldPrice: 25.99,
      discount: 52,
      quantity: 1
    },
    {
      shopName: 'SHEIN',
      imageUrl: 'assets/images/3.webp',
      price: 12.5,
      oldPrice: 25.99,
      discount: 52,
      quantity: 1
    }
    // aur products yahan add kar sakte ho
  ];

  // Qty increase/decrease
  incrementQty(product: any) {
    product.quantity++;
  }

  decrementQty(product: any) {
    if (product.quantity > 1) product.quantity--;
  }

  // Total price per product
  getTotalPrice(product: any): number {
    return parseFloat((product.price * product.quantity).toFixed(2));
  }

  // Shipping info (single div)
  standardShipping: string = "$3.99 (Arrives between Jan 26 - Jan 29, 66.9% are ≤ 6 business days, Est. arrival: before Valentine's)";
  onTimeDelivery: string = "On-Time Delivery Service: FREE";
}
