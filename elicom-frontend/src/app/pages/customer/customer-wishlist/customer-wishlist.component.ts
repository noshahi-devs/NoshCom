import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-customer-wishlist',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './customer-wishlist.component.html',
    styleUrls: ['./customer-wishlist.component.scss']
})
export class CustomerWishlistComponent implements OnInit {
    activeTab: 'items' | 'boards' = 'items';

    categories = [
        'All', 'Women Apparel', 'Kids', 'Men', 'Home & Living', 'Shoes',
        'Underwear & Sleepwear', 'Beauty & Health', 'Sports & Outdoor',
        'Baby', 'Apparel Accessories', 'Jewelry & Watches', 'Tools & Home Improvement',
        'Bags & Luggage', 'Home Textile', 'Toys & Games', 'Cell Phone & Accessories',
        'Office & School Supplies', 'Pet Supplies', 'Electronics', 'Automotive'
    ];

    activeCategory = 'All';

    constructor() { }

    ngOnInit(): void {
    }

    setTab(tab: 'items' | 'boards') {
        this.activeTab = tab;
    }

    setCategory(cat: string) {
        this.activeCategory = cat;
    }
}
