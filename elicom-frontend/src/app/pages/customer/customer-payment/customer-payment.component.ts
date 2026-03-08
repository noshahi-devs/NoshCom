import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-customer-payment',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './customer-payment.component.html',
    styleUrls: ['./customer-payment.component.scss']
})
export class CustomerPaymentComponent implements OnInit {

    constructor() { }

    ngOnInit(): void {
    }
}
