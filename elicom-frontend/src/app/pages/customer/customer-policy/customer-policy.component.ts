import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-customer-policy',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './customer-policy.component.html',
    styleUrls: ['./customer-policy.component.scss']
})
export class CustomerPolicyComponent implements OnInit {
    policies = [
        { title: 'Return Policy', icon: 'fa-undo', description: 'Everything you need to know about returns and replacements.' },
        { title: 'Refund Policy', icon: 'fa-money-bill-wave', description: 'How and when you will receive your money back.' },
        { title: 'Coupon Policy', icon: 'fa-ticket-alt', description: 'Rules and limitations for using promotional codes.' },
        { title: 'Bonus Point Policy', icon: 'fa-coins', description: 'Earn and spend points on your favorite items.' },
        { title: 'Privacy Policy', icon: 'fa-lock', description: 'How we protect your personal data and privacy.' },
        { title: 'Terms & Conditions', icon: 'fa-file-contract', description: 'The legal agreement for using our platform.' }
    ];

    constructor() { }

    ngOnInit(): void {
    }
}
