import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Partner {
    id: number;
    name: string;
    country: string;
    contact: string;
    isActive: boolean;
}

interface Warehouse {
    id: number;
    location: string;
    capacity: string;
    manager: string;
    isActive: boolean;
}

@Component({
    selector: 'app-global-settings',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './global-settings.component.html',
    styleUrls: ['./global-settings.component.scss']
})
export class GlobalSettingsComponent implements OnInit {
    partners: Partner[] = [
        { id: 1, name: 'DHL Express', country: 'Global', contact: 'support@dhl.com', isActive: true },
        { id: 2, name: 'FedEx UK', country: 'United Kingdom', contact: 'uk-support@fedex.com', isActive: true },
        { id: 3, name: 'UPS US', country: 'United States', contact: 'us-ops@ups.com', isActive: false }
    ];

    warehouses: Warehouse[] = [
        { id: 1, location: 'London East', capacity: '50,000 SKUs', manager: 'David Wright', isActive: true },
        { id: 2, location: 'New York Port', capacity: '120,000 SKUs', manager: 'Sarah Connor', isActive: true }
    ];

    showPartnerModal = false;
    showWarehouseModal = false;

    newPartner: any = { name: '', country: '', contact: '' };
    newWarehouse: any = { location: '', capacity: '', manager: '' };

    ngOnInit() { }

    openPartnerModal() {
        this.showPartnerModal = true;
    }

    closePartnerModal() {
        this.showPartnerModal = false;
    }

    openWarehouseModal() {
        this.showWarehouseModal = true;
    }

    closeWarehouseModal() {
        this.showWarehouseModal = false;
    }

    addPartner() {
        this.partners.push({
            id: this.partners.length + 1,
            ...this.newPartner,
            isActive: true
        });
        this.closePartnerModal();
        this.newPartner = { name: '', country: '', contact: '' };
    }

    addWarehouse() {
        this.warehouses.push({
            id: this.warehouses.length + 1,
            ...this.newWarehouse,
            isActive: true
        });
        this.closeWarehouseModal();
        this.newWarehouse = { location: '', capacity: '', manager: '' };
    }

    togglePartner(partner: Partner) {
        partner.isActive = !partner.isActive;
    }

    toggleWarehouse(warehouse: Warehouse) {
        warehouse.isActive = !warehouse.isActive;
    }
}
