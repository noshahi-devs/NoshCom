import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-price',
  standalone: false,
  template: `
    <div class="price-container">
      <span class="current-price" *ngIf="salePrice">{{ salePrice | currency }}</span>
      <span class="current-price" *ngIf="!salePrice">{{ price | currency }}</span>
      <span class="original-price" *ngIf="salePrice">{{ price | currency }}</span>
    </div>
  `,
  styles: [`
    .price-container {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0.5rem 0;
    }
    .current-price {
      font-weight: bold;
      font-size: 1.2rem;
      color: #e74c3c;
    }
    .original-price {
      text-decoration: line-through;
      color: #7f8c8d;
      font-size: 1rem;
    }
  `]
})
export class PriceComponent {
  @Input() price!: number;
  @Input() salePrice?: number;
}
