import { Component, Input } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-order-process-header',
  standalone: true, // MUST
  imports: [NgIf],   // MUST for *ngIf
  templateUrl: './order-process-header.html',
  styleUrls: ['./order-process-header.scss'],
})
export class OrderProcessHeader {

  @Input() brandName: string = 'SMART CART';

  @Input() country: string = 'Pakistan';
  @Input() province: string = 'Punjab';
  @Input() city: string = 'Lahore';

  @Input() showLocation: boolean = true; // ✅ NEW

  get shippingAddress(): string {
    return `Ship to ${this.country}, ${this.province}, ${this.city}`;
  }
}

