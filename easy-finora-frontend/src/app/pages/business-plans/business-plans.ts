import { Component } from '@angular/core';
import { NgFor, NgIf, CurrencyPipe } from '@angular/common';

@Component({
    selector: 'app-business-plans',
    imports: [NgFor, NgIf, CurrencyPipe],
    templateUrl: './business-plans.html',
    styleUrl: './business-plans.scss',
})
export class BusinessPlans {

    plans = [
        {
            name: 'Starter',
            price: 99,
            monthlyLimit: 5000,
            features: [
                '5 Withdrawal methods',
                'Basic Support',
                '24-48h processing time',
                'Standard security'
            ],
            popular: false
        },
        {
            name: 'Professional',
            price: 499,
            monthlyLimit: 25000,
            features: [
                'Unlimited withdrawal methods',
                'Priority Support',
                '1-2h processing time',
                'Enhanced security',
                'Dedicated account manager'
            ],
            popular: true
        },
        {
            name: 'Business',
            price: 999,
            monthlyLimit: 100000,
            features: [
                'Unlimited withdrawal methods',
                '24/7 Premium Support',
                'Instant processing',
                'Maximum security',
                'Dedicated account manager',
                'Custom API access'
            ],
            popular: false
        },
        {
            name: 'Enterprise',
            price: null,
            monthlyLimit: null,
            features: [
                'Everything in Business',
                'Custom features',
                'White-label options',
                'SLA guarantee',
                'On-site training'
            ],
            popular: false
        }
    ];
}
