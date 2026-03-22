import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface PolicyItem {
    title: string;
    icon: string;
    description: string;
}

@Component({
    selector: 'app-customer-policy',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './customer-policy.component.html',
    styleUrls: ['./customer-policy.component.scss']
})
export class CustomerPolicyComponent implements OnInit {

    policies: PolicyItem[] = [
        {
            title: 'Privacy Policy',
            icon: 'fa-user-shield',
            description: 'Your privacy is important to us. This policy explains how we collect, use, and protect your personal information.'
        },
        {
            title: 'Terms & Conditions',
            icon: 'fa-file-contract',
            description: 'By using World Cart, you agree to our terms and conditions. These govern your use of our platform and services.'
        },
        {
            title: 'Return & Refund Policy',
            icon: 'fa-undo',
            description: 'We offer a flexible return and refund policy. Please ensure items are in their original condition for a full refund.'
        },
        {
            title: 'Cookie Policy',
            icon: 'fa-cookie-bite',
            description: 'We use cookies to enhance your browsing experience. You can manage your cookie preferences in your browser settings.'
        }
    ];

    constructor() { }

    ngOnInit(): void {
    }
}
