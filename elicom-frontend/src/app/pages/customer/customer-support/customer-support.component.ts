import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-customer-support',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './customer-support.component.html',
    styleUrls: ['./customer-support.component.scss']
})
export class CustomerSupportComponent implements OnInit {
    faqs = [
        { question: '1. Delivered but not received', answer: 'Please check with your neighbors or apartment office. If you still can\'t find it, contact customer support with your tracking number.', open: false },
        { question: '2. Where is my order?', answer: 'You can track your order using the tracking number provided in your shipping confirmation email on the courier\'s website.', open: false },
        { question: '3. Why are some items from my order missing?', answer: 'Your items may have been shipped separately. Check your shipping confirmation for multiple tracking numbers.', open: false },
        { question: '4. What if I received a wrong item?', answer: 'Contact our support team immediately with your order number and a photo of the incorrect item received.', open: false },
        { question: '5. How long will it take for my refund to be processed?', answer: 'Refunds are typically processed within 3-5 business days after the returned items are received and inspected.', open: false }
    ];

    categories = [
        { name: 'Hot', hot: true },
        { name: 'Tracking & Delivery', active: true },
        { name: 'Return & Refund' },
        { name: 'Processing' },
        { name: 'Payment' },
        { name: 'Account Issues' },
        { name: 'Pre-sale' },
        { name: 'Legal/Security' }
    ];

    constructor() { }

    ngOnInit(): void {
    }

    toggleFaq(index: number) {
        this.faqs[index].open = !this.faqs[index].open;
    }
}
