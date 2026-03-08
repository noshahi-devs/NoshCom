import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-customer-history',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './customer-history.component.html',
    styleUrls: ['./customer-history.component.scss']
})
export class CustomerHistoryComponent implements OnInit {
    viewedItems = [
        { name: 'Elegant Silk Dress', price: 45.00, image: 'https://images.unsplash.com/photo-1539109132381-31a15b2c6a63?auto=format&fit=crop&w=300&q=80', date: 'Viewed 2 hours ago' },
        { name: 'Casual Cotton T-Shirt', price: 15.00, image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=300&q=80', date: 'Viewed yesterday' },
        { name: 'Woolen Winter Coat', price: 89.00, image: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=300&q=80', date: 'Viewed 3 days ago' }
    ];

    constructor() { }

    ngOnInit(): void {
    }
}
