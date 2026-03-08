import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Address {
    id: number;
    isDefault: boolean;
    name: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    zip: string;
}

@Component({
    selector: 'app-customer-address',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './customer-address.component.html',
    styleUrls: ['./customer-address.component.scss']
})
export class CustomerAddressComponent implements OnInit {
    addresses: Address[] = [
        { id: 1, isDefault: true, name: 'Sharjeel Noshahi', phone: '+92 300 1234567', address: '123 Main Street, Phase 5', city: 'Lahore', state: 'Punjab', zip: '54000' },
        { id: 2, isDefault: false, name: 'Sharjeel Noshahi', phone: '+92 300 7654321', address: '456 Business Road, Gulberg', city: 'Lahore', state: 'Punjab', zip: '54000' }
    ];

    constructor() { }

    ngOnInit(): void {
    }

    setDefault(id: number) {
        this.addresses.forEach(a => a.isDefault = a.id === id);
    }

    deleteAddress(id: number) {
        this.addresses = this.addresses.filter(a => a.id !== id);
    }
}
