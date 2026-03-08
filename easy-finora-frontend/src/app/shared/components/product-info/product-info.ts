import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
  imports: [CommonModule, FormsModule],
  templateUrl: './product-info.html',
  styleUrls: ['./product-info.scss']
})

export class ProductInfo implements OnInit {

  product = {
    title: "Women's Mid Rise Straight Leg Denim Pants - Non Stretch Classic Washed Button Fly Zipper",
    description: 'Premium quality denim pants',
    sku: 'S225090998294825844',
    reviewCount: 1000,
    priceNow: 10.11,
    priceOld: 13.97,
    discount: 34
  };

  rating = 4;
 
  // COLORS
  colors = [
    { src: 'assets/images/1.webp', name: 'Black', active: true },
    { src: 'assets/images/2.webp', name: 'Red', active: false, hot: true },
    { src: 'assets/images/3.webp', name: 'Dark Grey', active: false }
  ];

  selectedColorName: string = 'Black';

  selectColor(selected: any) {
    this.colors.forEach(c => c.active = false);
    selected.active = true;
    this.selectedColorName = selected.name;
  }

  // SIZES
  sizes = ['S', 'M', 'L', 'XL'];
  selectedSize: string = '';

  // QTY & FAV
  quantity = 1;
  fav = false;

  // AD SLOT (API se aa sakta hai ya null)
  adBanner: { text: string; brand: string } | null = null;

  ngOnInit(): void {
    // simulate API
    this.adBanner = {
      text: 'Pay now, in 4 payments of $4.46, or pay over time with monthly financing.',
      brand: 'Klarna'
    };

    // agar ad na ho:
    // this.adBanner = null;
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
    alert(`Added ${this.quantity} item(s) of size ${this.selectedSize}`);
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
