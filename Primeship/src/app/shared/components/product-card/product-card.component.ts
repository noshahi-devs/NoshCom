import { Component, Input } from '@angular/core';
import { Product } from '../../../core/models';
import { CartService } from '../../../core/services/cart.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-product-card',
  standalone: false,
  template: `
    <div class="product-card">
      <img [src]="product.image" [alt]="product.name" class="product-image">
      <h3>{{ product.name }}</h3>
      <p-rating [ngModel]="product.rating" [readonly]="true"></p-rating>
      <app-price
        [price]="product.originalPrice || product.price"
        [salePrice]="product.originalPrice ? product.price : undefined">
      </app-price>
      <button pButton label="Add to Cart" icon="pi pi-shopping-cart" (click)="handleAddToCart()"></button>
    </div>
  `,
  styles: [`
    .product-card {
      border: 1px solid #ddd;
      padding: 1rem;
      border-radius: 4px;
      text-align: center;
    }
    .product-image {
      max-width: 100%;
      height: auto;
      margin-bottom: 1rem;
    }
  `]
})
export class ProductCardComponent {
  @Input() product!: Product;

  constructor(
    private cartService: CartService,
    private toastService: ToastService
  ) { }

  handleAddToCart(): void {
    if (!this.product) {
      this.toastService.showError('Product data is missing.');
      return;
    }
    this.cartService.addToCart(this.product, 1);
    this.toastService.showSuccess(`${this.product.name} added to cart!`);
  }
}
