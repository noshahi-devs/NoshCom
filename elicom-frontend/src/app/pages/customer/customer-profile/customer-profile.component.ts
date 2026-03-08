import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-customer-profile',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './customer-profile.component.html',
    styleUrls: ['./customer-profile.component.scss']
})
export class CustomerProfileComponent implements OnInit {
    user = {
        firstName: 'Sharjeel',
        lastName: 'Noshahi',
        email: 'sharjeel@noshahi.com',
        phone: '+92 300 1234567',
        gender: 'Male'
    };

    constructor() { }

    ngOnInit(): void {
    }
}
