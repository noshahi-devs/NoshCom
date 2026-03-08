import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-admin-settings',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './settings.component.html',
    styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
    platformSettings = {
        name: 'Prime Ship Global',
        contactEmail: 'support@primeship.com',
        supportPhone: '+1 (555) 000-1111',
        maintenanceMode: false,
        currency: 'USD'
    };

    adminProfile = {
        name: 'Adeel Admin',
        email: 'admin@primeship.com',
        role: 'Super Administrator',
        lastLogin: new Date()
    };

    constructor() { }

    ngOnInit(): void { }

    savePlatformSettings() {
        console.log('Saving platform settings:', this.platformSettings);
        // Add toast logic here
    }

    saveProfile() {
        console.log('Saving profile:', this.adminProfile);
    }
}
