import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Product } from '../../core/models';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-product-detail-simple',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-detail-simple.component.html',
  styleUrls: ['./product-detail-simple.component.scss']
})
export class ProductDetailSimpleComponent implements OnInit {
  product: Product | null = null;
  relatedProducts: Product[] = [];
  quantity: number = 1;
  isLoading = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private toastService: ToastService
  ) { }

  ngOnInit(): void {
    this.loadProduct();
    this.loadRelatedProducts();
  }

  private loadProduct(): void {
    const slug = this.route.snapshot.paramMap.get('slug');

    // TODO: Replace with actual API call
    this.product = {
      id: 'prod-1',
      name: 'Premium Wireless Headphones',
      slug: slug || 'premium-wireless-headphones',
      price: 299,
      originalPrice: 399,
      discount: 25,
      rating: 4,
      reviewCount: 245,
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=600&fit=crop&crop=center',
      inStock: true,
      category: 'Electronics',
      description: 'Premium wireless headphones with noise cancellation and superior sound quality.',
      fullDescription: 'Experience premium sound quality with our wireless headphones. Featuring advanced noise cancellation technology, 30-hour battery life, and comfortable over-ear design.'
    };

    this.isLoading = false;
  }

  private loadRelatedProducts(): void {
    // TODO: Replace with actual API call
    this.relatedProducts = [
      {
        id: 'prod-2',
        name: 'Wireless Earbuds Pro',
        slug: 'wireless-earbuds-pro',
        price: 199,
        originalPrice: 249,
        discount: 20,
        rating: 4,
        reviewCount: 156,
        image: 'https://images.unsplash.com/photo-1588423771023-c78a61730421?w=300&h=300&fit=crop&crop=center',
        inStock: true,
        category: 'Electronics'
      },
      {
        id: 'prod-3',
        name: 'Bluetooth Speaker',
        slug: 'bluetooth-speaker',
        price: 89,
        originalPrice: 129,
        discount: 31,
        rating: 4,
        reviewCount: 89,
        image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=300&h=300&fit=crop&crop=center',
        inStock: true,
        category: 'Electronics'
      },
      {
        id: 'prod-4',
        name: 'Phone Case Premium',
        slug: 'phone-case-premium',
        price: 29,
        originalPrice: 39,
        discount: 26,
        rating: 4,
        reviewCount: 234,
        image: 'https://images.unsplash.com/photo-1596436889106-0938ae8f3d4b?w=300&h=300&fit=crop&crop=center',
        inStock: true,
        category: 'Accessories'
      }
    ];
  }

  increaseQuantity(): void {
    if (this.quantity < 10) {
      this.quantity++;
    }
  }

  decreaseQuantity(): void {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  addToCart(): void {
    if (this.product) {
      // TODO: Implement cart service
      console.log('Adding to cart:', {
        product: this.product,
        quantity: this.quantity
      });

      // Navigate to checkout
      this.router.navigate(['/checkout'], {
        queryParams: {
          productId: this.product.id,
          quantity: this.quantity
        }
      });
    }
  }

  addToWishlist(): void {
    if (this.product) {
      // TODO: Implement wishlist service
      console.log('Adding to wishlist:', this.product);
      this.toastService.showSuccess('Product added to wishlist!');
    }
  }

  viewProduct(product: Product | string): void {
    const raw = typeof product === 'string'
      ? product
      : (product?.slug || product?.name || product?.sku || product?.id || '');
    const slug = (raw || '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    if (slug) {
      const queryParams: Record<string, string> = {};
      if (typeof product === 'object' && product) {
        if (product.id) queryParams['id'] = String(product.id);
        if (product.sku) queryParams['sku'] = String(product.sku);
      }
      this.router.navigate(['/product', slug], { queryParams });
      return;
    }

    this.router.navigate(['/shop']);
  }
}
