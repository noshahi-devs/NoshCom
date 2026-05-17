import { Component, OnInit, OnDestroy } from '@angular/core';
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
export class GlobalSettingsComponent implements OnInit, OnDestroy {
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
    showSlaModal = false;

    newPartner: any = { name: '', country: '', contact: '' };
    newWarehouse: any = { location: '', capacity: '', manager: '' };

    selectedPartner: Partner | null = null;
    selectedPartnerSla: any = null;

    ngOnInit() { }

    ngOnDestroy() {
        // Unlock scroll on navigation just in case
        document.documentElement.classList.remove('modal-open');
        document.body.classList.remove('modal-open');
    }

    openPartnerModal() {
        this.showPartnerModal = true;
        document.documentElement.classList.add('modal-open');
        document.body.classList.add('modal-open');
    }

    closePartnerModal() {
        this.showPartnerModal = false;
        document.documentElement.classList.remove('modal-open');
        document.body.classList.remove('modal-open');
    }

    openWarehouseModal() {
        this.showWarehouseModal = true;
        document.documentElement.classList.add('modal-open');
        document.body.classList.add('modal-open');
    }

    closeWarehouseModal() {
        this.showWarehouseModal = false;
        document.documentElement.classList.remove('modal-open');
        document.body.classList.remove('modal-open');
    }

    openSlaModal(partner: Partner) {
        this.selectedPartner = partner;
        this.showSlaModal = true;

        // Generate simulated real-time SLA metrics for maximum realism
        const randomPerformance = (97.8 + Math.random() * 2.1).toFixed(2);
        const randomLoss = (0.01 + Math.random() * 0.03).toFixed(3);
        const randomLatency = Math.floor(120 + Math.random() * 80);

        this.selectedPartnerSla = {
            onTimeDelivery: `${randomPerformance}%`,
            lossRate: `${randomLoss}%`,
            apiLatency: `${randomLatency}ms`,
            contractRenewal: '12 Dec 2026',
            status: partner.isActive ? 'Compliant' : 'Access Suspended'
        };

        // Double-element viewport lock
        document.documentElement.classList.add('modal-open');
        document.body.classList.add('modal-open');
    }

    closeSlaModal() {
        this.showSlaModal = false;
        this.selectedPartner = null;
        this.selectedPartnerSla = null;

        // Release scroll lock
        document.documentElement.classList.remove('modal-open');
        document.body.classList.remove('modal-open');
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
