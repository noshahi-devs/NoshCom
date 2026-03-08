import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-cart-item',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cart-item.html',
  styleUrls: ['./cart-item.scss'],
})
export class CartItem {

  // ================= SHOP =================
  shop = {
    name: 'STARSHIPPER',
    selected: true,
  };

  // ================= PRODUCTS (API READY) =================
  products = [
    {
      id: 1,
      title: 'STARSHIPPER EZwear Black Slant Pocket Ripped Skinny Jeans',
      brand: 'STARSHIPPER EZwear',
      image: 'assets/images/card_3.jpg',
      price: 10.99, 
      oldPrice: 30.59,
      qty: 1,
      color: 'Black',
      size: 'S',
      selected: true,
      soldOut: true, 
      fav: false,
      showDeleteConfirm: false,
    },
    {
      id: 2,
      title: 'Another Product Title',
      brand: 'Another Brand',
      image: 'assets/images/card_4.jpg',
      price: 15.99, 
      oldPrice: 35.59,
      qty: 6,
      color: 'Yellow',
      size: 'L',
      selected: true,
      soldOut: true, 
      fav: false,
      showDeleteConfirm: false,
    },
    {
      id: 3,
      title: 'STARSHIPPER EZwear Red Slant Pocket Ripped Skinny Jeans',
      brand: 'STARSHIPPER EZwear',
      image: 'assets/images/card_2.jpg',
      price: 10.99, 
      oldPrice: 30.59,
      qty: 3,
      color: 'Red',
      size: 'M',
      selected: true,
      soldOut: true, 
      fav: false,
      showDeleteConfirm: false,
    }
  ];

  // ================= COUPON (API READY) =================
  // API se ayega, agar coupon na ho → 0
  couponValue: number = 12.00;

  // ================= SELECT =================
  get allSelected(): boolean {
    return this.products.length > 0 && this.products.every(p => p.selected);
  }

  toggleAll(checked: boolean) {
    this.shop.selected = checked;
    this.products.forEach(p => p.selected = checked);
  }

  toggleShop(checked: boolean) {
    this.shop.selected = checked;
    this.products.forEach(p => p.selected = checked);
  }


  toggleProduct(p: any, checked: boolean) {
    p.selected = checked;
    this.shop.selected = this.products.every(x => x.selected);
  }

  // ================= FAVORITE =================
  toggleFav(p: any) {
    p.fav = !p.fav;
  }

  // ================= DELETE =================
  openDelete(p: any) {
    p.showDeleteConfirm = true;
  }

  cancelDelete(p: any) {
    p.showDeleteConfirm = false;
  }

  confirmDelete(id: number) {
    this.products = this.products.filter(p => p.id !== id);
  }

  // =====================================================
  // ================= PRICE LOGIC (CORRECT) =============
  // =====================================================

  /** 🔹 Retail Price = Old Price ka total */
  get retailPrice(): number {
    return this.products
      .filter(p => p.selected)
      .reduce((sum, p) => sum + (p.oldPrice || p.price) * p.qty, 0);
  }

  /** 🔹 Estimated Price = Asal / Final Price ka total */
  get estimatedPrice(): number {
    return this.products
      .filter(p => p.selected)
      .reduce((sum, p) => sum + p.price * p.qty, 0);
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
    return this.products.filter(p => p.selected).length;
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
