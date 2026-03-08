import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-customer-shipping',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './customer-shipping.component.html',
    styleUrls: ['./customer-shipping.component.scss']
})
export class CustomerShippingComponent implements OnInit {
    states = ['ALABAMA', 'ALASKA', 'ARIZONA', 'ARKANSAS', 'CALIFORNIA', 'COLORADO', 'CONNECTICUT', 'DELAWARE', 'FLORIDA', 'GEORGIA'];

    constructor() { }

    ngOnInit(): void {
    }
}
