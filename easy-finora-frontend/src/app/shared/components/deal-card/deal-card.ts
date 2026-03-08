import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface DealProduct {
  image: string;
  hoverImage?: string;
  price: string;
  tag?: string;
  priceText?: string;
}

interface DealCard {
  title: string;
  products: DealProduct[];
}

@Component({
  selector: 'app-deal-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './deal-card.html',
  styleUrls: ['./deal-card.scss']
})
export class DealCardComponent {
  // Static data for now, later replace with API
  dealCards: DealCard[] = [
    {
      title: 'Super Deals',
      products: [
        { image: 'assets/images/dealCard5.webp', hoverImage: 'assets/images/dealCard6.webp', price: '$3.88', priceText: 'Flash Sale' },
        { image: 'assets/images/dealCard1.webp', hoverImage: 'assets/images/dealCard2.jpg', price: '$4.99', priceText: '80% OFF' }
      ]
    },
    {
      title: 'Top Trends',
      products: [
        { image: 'assets/images/dealCard9.webp', price: '$8.09', tag: '#ElegantCasual' },
        { image: 'assets/images/dealCard10.webp', price: '$8.09', tag: '#PartyLooks' }
      ]
    },
    {
      title: 'Brand Zone',
      products: [
        { image: 'assets/images/dealCard3.jpg', hoverImage: 'assets/images/dealCard4.webp', price: '$3.88', priceText: 'Hot Sale' },
        { image: 'assets/images/dealCard7.webp', hoverImage: 'assets/images/dealCard8.webp', price: '$49.58', priceText: '67% OFF' }
      ]
    }
  ];
}
