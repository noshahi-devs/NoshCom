import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-product-gallery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-gallery.html',
  styleUrls: ['./product-gallery.scss']
})
export class ProductGallery {

  images: string[] = [
    'assets/images/card_3.jpg',
    'assets/images/2.webp',
    'assets/images/3.webp',
    'assets/images/4.webp',
    'assets/images/1.webp',
    'assets/images/card_4.webp'
  ];

  activeIndex = 0;

  selectImage(index: number) {
    this.activeIndex = index;
  }

  prevImage() {
    this.activeIndex =
      (this.activeIndex - 1 + this.images.length) % this.images.length;
  }

  nextImage() {
    this.activeIndex =
      (this.activeIndex + 1) % this.images.length;
  }
}
