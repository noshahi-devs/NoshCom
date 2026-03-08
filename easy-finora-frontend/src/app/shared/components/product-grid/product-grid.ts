import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-product-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-grid.html',
  styleUrls: ['./product-grid.scss']
})
export class ProductGridComponent {

  @Input() products: any[] = [];

  visibleCount = 25;

  get visibleProducts(): any[] {
    return this.products.slice(0, this.visibleCount);
  }

  get showViewMore(): boolean {
    return this.products.length > this.visibleCount;
  }

  viewMore() {
    this.visibleCount += 25;
  }
}
 