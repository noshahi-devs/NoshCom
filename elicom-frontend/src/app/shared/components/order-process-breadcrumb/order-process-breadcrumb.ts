import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-order-process-breadcrumb',
  standalone: true,
  imports: [CommonModule],
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
  @Output() stepClick = new EventEmitter<number>();

  private readonly stepIconMap: Record<string, string> = {
    cart: 'fas fa-cart-shopping',
    'place order': 'fas fa-location-dot',
    shipping: 'fas fa-location-dot',
    pay: 'fas fa-credit-card',
    payment: 'fas fa-credit-card',
    'order complete': 'fas fa-circle-check',
    success: 'fas fa-circle-check'
  };

  goToStep(index: number) {
    this.stepClick.emit(index);
  }

  getStepIcon(step: string): string {
    return this.stepIconMap[step.trim().toLowerCase()] || 'fas fa-box-open';
  }
}
