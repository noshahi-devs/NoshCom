import { Component, inject, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CartService, CartItem as CartItemModel } from '../../../services/cart.service';
import Swal from 'sweetalert2';
import { SmartPricePipe } from '../../pipes/smart-price.pipe';

@Component({
  selector: 'app-cart-item',
  standalone: true,
  imports: [CommonModule, RouterLink, SmartPricePipe],
  templateUrl: './cart-item.html',
  styleUrls: ['./cart-item.scss'],
})
export class CartItemComponent implements AfterViewChecked {
  cartService = inject(CartService);

  ngAfterViewChecked() {
    // Set indeterminate state for store checkboxes
    this.getStores().forEach(storeName => {
      const checkbox = document.getElementById('cart-store-' + storeName) as HTMLInputElement;
      if (checkbox) {
        const isPartiallyChecked = this.isAnyStoreItemChecked(storeName) && !this.isStoreChecked(storeName);
        checkbox.indeterminate = isPartiallyChecked;
      }
    });
  }

  // ================= CHECKBOX METHODS =================
  onItemCheckboxChange(item: CartItemModel, event: Event) {
    const checkbox = event.target as HTMLInputElement;
    this.cartService.setItemCheckbox(item.storeProductId, checkbox.checked);
  }

  onStoreCheckboxChange(storeName: string, event: Event) {
    const checkbox = event.target as HTMLInputElement;
    this.cartService.toggleStoreCheckbox(storeName, checkbox.checked);
  }

  onAllCheckboxChange(event: Event) {
    const checkbox = event.target as HTMLInputElement;
    this.cartService.toggleAllCheckbox(checkbox.checked);
  }

  isStoreChecked(storeName: string): boolean {
    return this.cartService.isStoreChecked(storeName);
  }

  isAnyStoreItemChecked(storeName: string): boolean {
    return this.cartService.isAnyStoreItemChecked(storeName);
  }

  isAllChecked(): boolean {
    return this.cartService.isAllChecked();
  }

  getStores(): string[] {
    return this.cartService.getStores();
  }

  getItemsByStore(storeName: string): CartItemModel[] {
    return this.cartService.getItemsByStore(storeName);
  }

  // ================= QUANTITY METHODS =================
  incrementQty(item: CartItemModel) {
    this.cartService.updateQuantity(item.productId, item.size, item.color, item.quantity + 1);
  }

  decrementQty(item: CartItemModel) {
    if (item.quantity > 1) {
      this.cartService.updateQuantity(item.productId, item.size, item.color, item.quantity - 1);
    }
  }

  // ================= FAVORITE =================
  toggleFav(item: CartItemModel) {
    this.cartService.toggleFavorite(item.productId, item.size, item.color);
  }

  // ================= DELETE =================
  removeItem(item: CartItemModel) {
    Swal.fire({
      title: "Are you sure?",
      text: "You will not be able to recover this item!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#DD6B55",
      confirmButtonText: "Yes, delete it!"
    }).then((result) => {
      if (result.isConfirmed) {
        this.cartService.removeItem(item);
        Swal.fire("Deleted!", "Your item has been deleted.", "success");
      }
    });
  }

  // ================= PRICE CALCULATIONS =================
  /** 🔹 Retail Price = Old Price ka total */
  get retailPrice(): number {
    return this.cartService.items()
      .filter(p => p.isChecked)
      .reduce((sum, p) => sum + (p.oldPrice || p.price) * p.quantity, 0);
  }

  /** 🔹 Estimated Price = Asal / Final Price ka total */
  get estimatedPrice(): number {
    return this.cartService.totalPrice;
  }

  /** 🔹 Coupon Value (hardcoded for now, can be from API) */
  get couponValue(): number {
    // This can be fetched from an API or calculated based on promotions
    return 0.00;
  }

  /** 🔹 Promotion (sirf display ke liye) */
  get promotionDiscount(): number {
    return Math.max(
      this.retailPrice - this.estimatedPrice - this.couponValue,
      0
    );
  }

  /** 🔹 Total Saved */
  get totalSaved(): number {
    return this.retailPrice - this.estimatedPrice;
  }

  /** 🔹 Selected Items Count */
  get selectedItemCount(): number {
    return this.cartService.items().filter(p => p.isChecked).length;
  }

  /** 🔹 Reward Points (example: floor of estimated) */
  get rewardPoints(): number {
    return Math.floor(this.estimatedPrice);
  }

  // ================= FREE SHIPPING =================
  freeShippingLimit = 500;

  get remainingForFreeShipping(): number {
    return Math.max(this.freeShippingLimit - this.estimatedPrice, 0);
  }
}
