import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-order-process-breadcrumb',
  standalone: true,
  imports: [CommonModule],   // ✅ REQUIRED
  templateUrl: './order-process-breadcrumb.html',
  styleUrl: './order-process-breadcrumb.scss',
})
export class OrderProcessBreadcrumb {

  @Input() steps: string[] = [
    'Cart',
    'Place Order',
    'Pay',
    'Order Complete',
  ];

  @Input() activeStep: number = 0;
}
