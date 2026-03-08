import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface DealProduct {
  image: string;
  hoverImage?: string;
  price: string;
  tag?: string;
  priceText?: string;
  id?: string;
  storeProductId?: string;
}

interface DealCard {
  title: string;
  products: DealProduct[];
}

@Component({
  selector: 'app-deal-card',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './deal-card.html',
  styleUrls: ['./deal-card.scss']
})
export class DealCardComponent implements OnChanges {
  @Input() products: any[] = [];
  private readonly localImageGroups: { image: string; hoverImage?: string }[][] = [
    [
      { image: '/assets/images/dealCard1.webp', hoverImage: '/assets/images/dealCard7.webp' },
      { image: '/assets/images/dealCard2.jpg', hoverImage: '/assets/images/dealCard8.webp' }
    ],
    [
      { image: '/assets/images/dealCard3.jpg', hoverImage: '/assets/images/dealCard9.webp' },
      { image: '/assets/images/dealCard4.webp', hoverImage: '/assets/images/dealCard10.webp' }
    ],
    [
      { image: '/assets/images/dealCard5.webp', hoverImage: '/assets/images/dealCard1.webp' },
      { image: '/assets/images/dealCard6.webp', hoverImage: '/assets/images/dealCard2.jpg' }
    ]
  ];

  dealCards: DealCard[] = [
    { title: 'Super Deals', products: [] },
    { title: 'Top Trends', products: [] },
    { title: 'Brand Zone', products: [] }
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['products'] && this.products && this.products.length > 0) {
      this.generateDynamicDeals();
    }
  }

  generateDynamicDeals() {
    // We need 6 products total (2 per card)
    const pool = [...this.products].sort(() => 0.5 - Math.random());

    // 1. Super Deals (lowest prices)
    const superDeals = [...this.products]
      .sort((a, b) => a.price - b.price)
      .slice(0, 2);

    // 2. Top Trends (random mix or based on category)
    const trends = pool.filter(p => !superDeals.includes(p)).slice(0, 2);

    // 3. Brand Zone (whatever is left)
    const brands = pool.filter(p => !superDeals.includes(p) && !trends.includes(p)).slice(0, 2);

    this.dealCards[0].products = superDeals.map((p, i) => this.mapToDeal(p, 0, i, 'Flash Sale'));
    this.dealCards[1].products = trends.map((p, i) => this.mapToDeal(p, 1, i, '', '#' + (p.categoryName || 'Trendy').replace(/\s/g, '')));
    this.dealCards[2].products = brands.map((p, i) => this.mapToDeal(
      p,
      2,
      i,
      (p.resellerDiscountPercentage > 0 ? p.resellerDiscountPercentage + '% OFF' : 'Hot Sale')
    ));
  }

  mapToDeal(p: any, cardIndex: number, productIndex: number, priceText: string = '', tag: string = ''): DealProduct {
    const localImages = this.getLocalImages(cardIndex, productIndex);
    return {
      image: localImages.image,
      hoverImage: localImages.hoverImage,
      price: '$' + (p.price || 0).toFixed(2),
      priceText: priceText,
      tag: tag,
      id: p.productId,
      storeProductId: p.storeProductId || p.id
    };
  }

  getLocalImages(cardIndex: number, productIndex: number): { image: string; hoverImage?: string } {
    const group = this.localImageGroups[cardIndex] || this.localImageGroups[0];
    return group[productIndex % group.length] || { image: '/assets/images/card_1.jpg' };
  }

  getFallbackImage(cardIndex: number, productIndex: number): string {
    return this.getLocalImages(cardIndex, productIndex).image;
  }

  onImgError(event: Event, cardIndex: number, productIndex: number): void {
    const target = event.target as HTMLImageElement;
    if (!target || target.dataset['fallback'] === '1') return;
    target.dataset['fallback'] = '1';
    target.src = this.getFallbackImage(cardIndex, productIndex);
  }

  onHoverImgError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (!target) return;
    target.style.display = 'none';
  }
}
