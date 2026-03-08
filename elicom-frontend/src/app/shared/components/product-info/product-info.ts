import { Component, Input, OnInit, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { ProductDetailDto } from '../../../services/product';
import { CartService } from '../../../services/cart.service';
import Swal from 'sweetalert2';
import { environment } from '../../../../environments/environment';

export type AccordionType = 'desc' | 'sizefit' | null;
export type SizeTabType = 'product' | 'body';

interface Feature {
  icon: string;
  label: string;
}

interface Detail {
  key: string;
  value: string;
}

interface SizeRow {
  eu: string;
  size: string;
  length: number;
  waist: number;
  hip: number;
  inseam?: number;
}

@Component({
  selector: 'app-product-info',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './product-info.html',
  styleUrls: ['./product-info.scss']
})
export class ProductInfo implements OnInit {

  @Input() productData?: ProductDetailDto;
  @Output() colorSelected = new EventEmitter<string>();

  private cartService = inject(CartService);
  private authService = inject(AuthService);

  product = {
    title: "",
    description: '',
    sku: '',
    reviewCount: 0,
    priceNow: 0,
    priceOld: 0,
    discount: 0,
    brand: 'Noshahi'
  };

  rating = 5;

  // LARGE IMAGE CLICK
  scrollToGallery() {
    const gallery = document.getElementById('gallery');
    if (gallery) {
      gallery.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // COLORS
  colors: any[] = [];
  selectedColorName: string = '';

  selectColor(selected: any) {
    this.colors.forEach(c => c.active = false);
    selected.active = true;
    this.selectedColorName = selected.name;
    // Emit the image path for the gallery to update
    this.colorSelected.emit(selected.src);
  }

  // SIZES
  sizes: string[] = [];
  selectedSize: string = '';

  // QTY & FAV
  quantity = 1;
  fav = false;
  showMobileCartCta = false;

  // AD SLOT (API se aa sakta hai ya null)
  adBanner: { text: string; brand: string } | null = null;

  getImage(img: string): string {
    if (!img || img === 'string' || img.trim() === '') {
      return `https://picsum.photos/seed/${this.productData?.productId || 'p'}/300/400`;
    }

    // Clean malformed strings from API (Same logic as Grid/Gallery)
    let val = this.normalizeImageValue(img);

    // If a URL exists anywhere in the string, prefer it
    const urlMatch = val.match(/https?:\/\/[^\s"'<>]+/i);
    if (urlMatch) return urlMatch[0];

    // Broken CDN Fix (MUST BE BEFORE http CHECK)
    if (val.includes('cdn.elicom.com')) {
      const seed = val.split('/').pop() || 'p1';
      return `https://picsum.photos/seed/${seed}/100/100`;
    }

    if (val.startsWith('http')) return val;
    return `${environment.apiUrl}/images/products/${val}`;
  }

  private normalizeImageValue(img: string): string {
    let val = (img || '').trim();
    if (!val) return '';

    val = val
      .replace(/^\["/, '')
      .replace(/"\]$/, '')
      .replace(/^"/, '')
      .replace(/"$/, '')
      .replace(/\\"/g, '');

    if (val.includes('","')) {
      val = val.split('","')[0];
    } else if (val.includes(',')) {
      val = val.split(',')[0];
    }

    return val.trim();
  }

  ngOnInit(): void {
    if (this.productData) {
      this.product = {
        title: this.productData.title,
        description: this.productData.description,
        sku: this.productData.productId.substring(0, 8),
        reviewCount: 1250,
        priceNow: this.productData.store.price,
        priceOld: this.productData.store.resellerPrice,
        discount: this.productData.store.resellerDiscountPercentage,
        brand: (this.productData as any).brand || this.productData.store.storeName || 'Noshahi'
      };

      const firstImg = (this.productData.images && this.productData.images.length > 0)
        ? this.productData.images[0] : '';
      const colorPreview = this.getImage(firstImg);

      if (this.productData.colorOptions) {
        this.colors = this.productData.colorOptions.map((c, i) => ({
          name: c,
          src: colorPreview, // Use current product image as color preview for now
          active: i === 0,
          hot: i === 0
        }));
        this.selectedColorName = this.colors[0]?.name;
      }

      // Size UI removed; keep sizes empty to avoid selection requirement
      this.sizes = [];

      this.shippingData.seller.name = this.productData.store.storeName;
      if (this.details[11]) this.details[11].value = this.product.sku;
      if (this.details[8]) this.details[8].value = this.selectedColorName;
    }

    this.adBanner = {
      text: `Pay now, in 4 payments of $${(this.product.priceNow / 4).toFixed(2)}, or pay over time with monthly financing.`,
      brand: 'Klarna'
    };
  }

  // METHODS
  selectSize(size: string) {
    this.selectedSize = size;
  }

  toggleFav() {
    this.fav = !this.fav;
  }

  incrementQty() {
    this.quantity++;
  }

  decrementQty() {
    if (this.quantity > 1) this.quantity--;
  }

  addToCart() {
    // 1. Validate Login
    if (!this.authService.isAuthenticated) {
      Swal.fire({
        icon: 'warning',
        title: 'Login Required',
        text: 'Please login to add items to your cart',
        showCancelButton: true,
        confirmButtonText: 'Login Now',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#3085d6', // Brand color ideally
        cancelButtonColor: '#d33'
      }).then((result) => {
        if (result.isConfirmed) {
          // Open global auth modal
          this.authService.openAuthModal();
        }
      });
      return;
    }

    // 2. Add to Cart
    // Use the first image from gallery or a fallback for the cart thumbnail
    const image = (this.productData?.images && this.productData.images.length > 0)
      ? this.getImage(this.productData.images[0])
      : this.getImage('');

    console.log('[ProductInfo] Adding to cart:', this.productData, this.quantity);
    this.cartService.addToCart(
      this.productData,
      this.quantity,
      this.selectedSize,
      this.selectedColorName,
      image
    ).subscribe({
      next: () => {
        // Show success message
        Swal.fire({
          title: "Added to Cart!",
          text: "Item has been added to your shopping bag.",
          icon: "success",
          timer: 2000,
          showConfirmButton: false
        });
        this.showMobileCartCta = true;
      },
      error: (err) => {
        console.error('[ProductInfo] Add to cart failed:', err);
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Failed to sync with your account cart.',
        });
      }
    });
    // Optionally trigger side cart here if header effect misses it
  }


  shippingData = {
    location: 'Phoenix, ARIZONA, United States',

    shipping: {
      free: true,
      minOrder: 29,
      estimatedFrom: 'Dec 3',
      estimatedTo: 'Dec 9',
      onTimePercentage: 73
    },

    returnPolicy: {
      freeReturn: true,
      days: 7
    },

    security: {
      safePayments: true,
      privacyProtection: true
    },

    seller: {
      name: 'Noshahi Essence',
      fulfilledBy: 'Noshahi'
    }
  };

  // Accordion initially closed
  activeAccordion: 'desc' | 'sizefit' | null = null;

  toggleAccordion(section: 'desc' | 'sizefit') {
    this.activeAccordion = this.activeAccordion === section ? null : section;
  }

  // ---------- DESCRIPTION DATA ----------
  features: Feature[] = [
    { icon: 'assets/images/comportable.png', label: 'Comfortable' },
    { icon: 'assets/images/breathabla.png', label: 'Breathable' },
    { icon: 'assets/images/soft.png', label: 'Soft' },
    { icon: 'assets/images/skin friendly.png', label: 'Skin-friendly' }
  ];

  elasticity = {
    icon: 'assets/images/aerro.png',
    text: 'Medium Stretch'
  };

  details: Detail[] = [
    { key: 'Occasion', value: 'Daily' },
    { key: 'Festivals', value: 'Independence Day' },
    { key: 'Details', value: 'Button, Pocket, Raw Hem, Ripped, Zipper' },
    { key: 'Lined For Added Warmth', value: 'No' },
    { key: 'Pattern Type', value: 'Plain' },
    { key: 'Style', value: 'Casual' },
    { key: 'Closure Type', value: 'Zipper Fly' },
    { key: 'Body', value: 'Unlined' },
    { key: 'Color', value: 'Black' },
    { key: 'Type', value: 'Skinny' },
    { key: 'Jeans Style', value: 'Curvy' },
    { key: 'SKU', value: 'S225090998294825844' }
  ];

  // ---------- SIZE & FIT ----------
  countries = ['EU', 'BR', 'DE', 'AU', 'SG', 'UK', 'JP', 'MX', 'IT', 'FR', 'US', 'ES'];
  selectedCountry: string = 'EU';

  modelInfo = {
    size: 'S (EU: 36)',
    height: 66.9,
    bust: 34.3,
    waist: 26.4,
    hips: 42.1,
    image: 'https://i.pravatar.cc/100?img=5'
  };

  // Tabs
  activeTab: 'product' | 'body' = 'product';

  // Tables
  productTable: SizeRow[] = [
    { eu: '34', size: 'XS', length: 36.2, waist: 24.4, hip: 32.7, inseam: 13 },
    { eu: '36', size: 'S', length: 36.6, waist: 26, hip: 34.3, inseam: 14 },
    { eu: '38', size: 'M', length: 37, waist: 27.6, hip: 35.8, inseam: 15 },
    { eu: '40/42', size: 'L', length: 37.6, waist: 29.9, hip: 38.2, inseam: 16 }
  ];

  bodyTable: SizeRow[] = [
    { eu: '34', size: 'XS', length: 36.2, waist: 24.4, hip: 32.7 },
    { eu: '36', size: 'S', length: 36.6, waist: 26, hip: 34.3 },
    { eu: '38', size: 'M', length: 37, waist: 27.6, hip: 35.8 },
    { eu: '40/42', size: 'L', length: 37.6, waist: 29.9, hip: 38.2 }
  ];

  // Methods
  changeCountry(c: string) {
    this.selectedCountry = c;
    // TODO: API call or logic to update productTable/bodyTable based on country
  }

  switchTab(tab: 'product' | 'body') {
    this.activeTab = tab;
  }

}
