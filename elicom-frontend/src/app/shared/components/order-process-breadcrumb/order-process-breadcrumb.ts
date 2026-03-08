import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-order-process-breadcrumb',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-process-breadcrumb.html',
  styleUrl: './order-process-breadcrumb.scss',
})
export class OrderProcessBreadcrumb {
  private router = inject(Router);

  @Input() steps: string[] = [
    'Cart',
    'Place Order',
    'Pay',
    'Order Complete',
  ];

  @Input() activeStep: number = 0;
  @Output() stepClick = new EventEmitter<number>();

  goToStep(index: number) {
    this.stepClick.emit(index);
  }
}
