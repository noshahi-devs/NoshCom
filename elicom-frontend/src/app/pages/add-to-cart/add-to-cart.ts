import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderProcessHeader } from '../../shared/components/order-process-header/order-process-header';
import { OrderProcessBreadcrumb } from '../../shared/components/order-process-breadcrumb/order-process-breadcrumb';
import { CartItem } from '../../shared/components/cart-item/cart-item';
import { ProductCard } from '../../shared/components/product-card/product-card';
import { ProductService, GlobalMarketplaceProduct } from '../../services/product';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-add-to-cart',
  standalone: true,
  imports: [
    CommonModule,
    OrderProcessHeader,
    OrderProcessBreadcrumb,
    CartItem,
    ProductCard
  ],
  templateUrl: './add-to-cart.html',
  styleUrl: './add-to-cart.scss',
})
export class AddToCart implements OnInit {
  private productService = inject(ProductService);
  private cdr = inject(ChangeDetectorRef);

  brand = 'World Cart';
  address = 'Ship to Twnhs, 2841 E Waltann Ln Unit 1';
  products: any[] = [];
  suggestionText = 'You might like to fill it with';

  ngOnInit(): void {
    this.productService.getGlobalMarketplaceProducts().subscribe({
      next: (res) => {
        this.products = res.map(p => ({
          ...p,
          id: p.id,
          productId: p.productId,
          title: p.productName,
          price: p.price,
          image: this.getFirstImage(p),
          hoverImage: this.getSecondImage(p),
          shop: p.storeName,
          discount: 25,
          reviewCount: 45,
          trends: 'assets/images/trends.png'
        }));
        this.cdr.detectChanges();
      }
    });
  }

  getFirstImage(product: any): string {
    const imageStr = product.productImage;
    const name = (product.productName || '').toLowerCase();

    // Specific Overrides for broken data
    if (name.includes('hair removel') || name.includes('hair removal') || name.includes('hair remover') || name.includes('epilator')) {
      return 'https://picsum.photos/seed/beauty1/300/400';
    }
    if (name.includes('laptop bag')) {
      return 'https://picsum.photos/seed/bag1/300/400';
    }

    if (!imageStr || imageStr === 'string' || imageStr.trim() === '') {
      return `https://picsum.photos/seed/${product.id}/300/400`;
    }

    // Parse JSON array if it's a string
    let images: string[] = [];
    try {
      if (typeof imageStr === 'string' && imageStr.startsWith('[')) {
        images = JSON.parse(imageStr);
      } else if (typeof imageStr === 'string') {
        images = imageStr.split(',').map(s => s.trim());
      } else if (Array.isArray(imageStr)) {
        images = imageStr;
      }
    } catch (e) {
      images = imageStr.split(',').map((s: string) => s.trim());
    }

    if (images.length === 0 || images[0] === 'string' || images[0] === '') {
      return `https://picsum.photos/seed/${product.id}/300/400`;
    }

    const img = images[0];
    if (img.includes('cdn.elicom.com')) {
      const seed = img.split('/').pop() || 'p1';
      return `https://picsum.photos/seed/${seed}/300/400`;
    }

    if (!img.startsWith('http')) {
      return `${environment.apiUrl}/images/products/${img}`;
    }
    return img;
  }

  getSecondImage(product: any): string {
    const imageStr = product.productImage;
    const name = (product.productName || '').toLowerCase();

    // Specific Overrides for hover
    if (name.includes('hair removel') || name.includes('hair removal') || name.includes('hair remover') || name.includes('epilator')) {
      return 'https://picsum.photos/seed/beauty2/300/400';
    }
    if (name.includes('laptop bag')) {
      return 'https://picsum.photos/seed/tech-bag/300/400';
    }

    if (!imageStr || imageStr === 'string' || imageStr.trim() === '') {
      return `https://picsum.photos/seed/${product.id}_hover/300/400`;
    }

    // Parse JSON array if it's a string
    let images: string[] = [];
    try {
      if (typeof imageStr === 'string' && imageStr.startsWith('[')) {
        images = JSON.parse(imageStr);
      } else if (typeof imageStr === 'string') {
        images = imageStr.split(',').map(s => s.trim());
      } else if (Array.isArray(imageStr)) {
        images = imageStr;
      }
    } catch (e) {
      images = imageStr.split(',').map((s: string) => s.trim());
    }

    const parts = images.filter((p: string) => p !== '' && p !== 'string');

    if (parts.length > 1) {
      const img = parts[1];
      if (img.includes('cdn.elicom.com')) {
        const seed = img.split('/').pop() || 'p2';
        return `https://picsum.photos/seed/${seed}/300/400`;
      }
      if (!img.startsWith('http')) {
        return `${environment.apiUrl}/images/products/${img}`;
      }
      return img;
    }

    // Fallback hover for single-image products
    const firstImg = parts[0] || '';
    const seed = (firstImg.includes('http') ? (firstImg.split('/').pop() || 'px') : firstImg) + '_hover';
    return `https://picsum.photos/seed/${seed}/300/400`;
  }
}
