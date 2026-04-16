import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Store {
    id: number;
    ownerName: string;
    ownerEmail: string;
    name: string;
    shortDescription: string;
    longDescription: string;
    isActive: boolean;
    createdAt: Date;
    code?: string;
    region?: string;
    postalCode?: string;
    address?: string;
    seaTransitDays?: number;
    airTransitDays?: number;
}

@Component({
    selector: 'app-warehouse',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './warehouse.component.html',
    styleUrls: ['./warehouse.component.scss']
})
export class WarehouseComponent implements OnInit {
    stores: Store[] = [
        {
            id: 1,
            ownerName: 'Arslan Noshahi',
            ownerEmail: 'arslan@noshahi.dev',
            name: 'ABE-2 Eastern Distribution',
            shortDescription: 'Primary east-coast hub for fast-moving electronics and accessories.',
            longDescription: 'This facility manages day-to-day handling for smartphones, laptops, accessories, and other fast-moving technology products.',
            isActive: true,
            createdAt: new Date('2025-10-15'),
            code: 'ABE-2',
            region: 'Pennsylvania',
            postalCode: '18031',
            address: '705 Boulder Dr, Breinigsville, PA 18031',
            seaTransitDays: 4,
            airTransitDays: 1
        },
        {
            id: 2,
            ownerName: 'Adeel Khan',
            ownerEmail: 'adeel@example.com',
            name: 'ABQ-1 Southwest Logistics',
            shortDescription: 'Optimized for appliance fulfillment and scheduled routing.',
            longDescription: 'This warehouse is arranged for large household products including refrigerators, washing machines, kitchen units, and other bulky appliance orders.',
            isActive: false,
            createdAt: new Date('2025-11-20'),
            code: 'ABQ-1',
            region: 'New Mexico',
            postalCode: '87120',
            address: '12945 Ladera Dr NW, Albuquerque, NM 87120',
            seaTransitDays: 6,
            airTransitDays: 3
        },
        {
            id: 3,
            ownerName: 'Sara Ahmed',
            ownerEmail: 'sara@example.com',
            name: 'ACY-1 Atlantic Coast Yard',
            shortDescription: 'Coastal staging for seasonal and promotional stock.',
            longDescription: 'Focused on flexible inbound capacity with fast dock turnaround.',
            isActive: true,
            createdAt: new Date('2025-12-01'),
            code: 'ACY-1',
            region: 'New Jersey',
            postalCode: '08066',
            address: '240 Mantua Grove Rd, West Deptford, NJ 08066',
            seaTransitDays: 5,
            airTransitDays: 2
        },
        {
            id: 4,
            ownerName: 'Umar Farooq',
            ownerEmail: 'umar@example.com',
            name: 'AFW-1 North Texas Freight',
            shortDescription: 'Central US cross-dock for multi-region split shipments.',
            longDescription: 'Handles high-volume pallet receiving and zone-based dispatch.',
            isActive: true,
            createdAt: new Date('2025-12-18'),
            code: 'AFW-1',
            region: 'Texas',
            postalCode: '76131',
            address: '1851 NE Loop 820 Service Rd, Fort Worth, TX 76131',
            seaTransitDays: 7,
            airTransitDays: 4
        },
        {
            id: 5,
            ownerName: 'Hira Noor',
            ownerEmail: 'hira@example.com',
            name: 'BFI-2 Pacific North Node',
            shortDescription: 'Northwest hub for home, lifestyle, and outdoor goods.',
            longDescription: 'Built for mixed SKU handling with temperature zoning.',
            isActive: true,
            createdAt: new Date('2026-01-03'),
            code: 'BFI-2',
            region: 'Washington',
            postalCode: '98032',
            address: '3151 S 192nd St, SeaTac, WA 98032',
            seaTransitDays: 8,
            airTransitDays: 1
        },
        {
            id: 6,
            ownerName: 'Bilal J.',
            ownerEmail: 'bilal@example.com',
            name: 'CLT-3 Southeast Fulfillment',
            shortDescription: 'Fast-turn apparel and beauty dispatch center.',
            longDescription: 'Designed for quick picking and last-mile handoffs.',
            isActive: true,
            createdAt: new Date('2026-01-15'),
            code: 'CLT-3',
            region: 'North Carolina',
            postalCode: '28208',
            address: '2200 Wilkinson Blvd, Charlotte, NC 28208',
            seaTransitDays: 4,
            airTransitDays: 2
        },
        {
            id: 7,
            ownerName: 'Lara S.',
            ownerEmail: 'lara@example.com',
            name: 'DEN-1 Mountain Transit',
            shortDescription: 'Mountain region consolidation for mixed-category orders.',
            longDescription: 'Focused on regional routing and buffer inventory.',
            isActive: false,
            createdAt: new Date('2026-02-01'),
            code: 'DEN-1',
            region: 'Colorado',
            postalCode: '80216',
            address: '4700 Smith Rd, Denver, CO 80216',
            seaTransitDays: 6,
            airTransitDays: 3
        },
        {
            id: 8,
            ownerName: 'Zain Malik',
            ownerEmail: 'zain@example.com',
            name: 'EWR-5 Metro East Intake',
            shortDescription: 'High-throughput receiving for metro east deliveries.',
            longDescription: 'Optimized for short lead-time restock cycles.',
            isActive: true,
            createdAt: new Date('2026-02-14'),
            code: 'EWR-5',
            region: 'New York',
            postalCode: '07114',
            address: '580 Frelinghuysen Ave, Newark, NJ 07114',
            seaTransitDays: 5,
            airTransitDays: 4
        },
        {
            id: 9,
            ownerName: 'Ali Raza',
            ownerEmail: 'ali@example.com',
            name: 'JAX-2 Coastal Express',
            shortDescription: 'Southeast coast distribution for quick replenishment.',
            longDescription: 'Handles mixed-category inventory with rapid cross-dock.',
            isActive: true,
            createdAt: new Date('2026-02-28'),
            code: 'JAX-2',
            region: 'Florida',
            postalCode: '32218',
            address: '2000 Zoo Pkwy, Jacksonville, FL 32218',
            seaTransitDays: 9,
            airTransitDays: 2
        },
        {
            id: 10,
            ownerName: 'Nadia Khan',
            ownerEmail: 'nadia@example.com',
            name: 'LAX-7 West Coast Relay',
            shortDescription: 'West coast relay for electronics and home essentials.',
            longDescription: 'Supports fast coastal handoffs with priority staging.',
            isActive: false,
            createdAt: new Date('2026-03-10'),
            code: 'LAX-7',
            region: 'California',
            postalCode: '90045',
            address: '11111 Aviation Blvd, Los Angeles, CA 90045',
            seaTransitDays: 7,
            airTransitDays: 1
        }
    ];

    selectedStore: Store | null = null;
    isEditing = false;
    currentTimeDisplay = '';
    currentDateDisplay = '';
    hourHandRotation = 0;
    minuteHandRotation = 0;
    secondHandRotation = 0;
    private clockTimer: ReturnType<typeof setInterval> | null = null;

    ngOnInit() {
        this.updateClock();
        this.clockTimer = setInterval(() => this.updateClock(), 1000);
    }

    ngOnDestroy() {
        if (this.clockTimer) {
            clearInterval(this.clockTimer);
            this.clockTimer = null;
        }
    }

    get activeStoresCount(): number {
        return this.stores.filter(s => s.isActive).length;
    }

    get inactiveStoresCount(): number {
        return this.stores.filter(s => !s.isActive).length;
    }

    get activationRate(): number {
        if (!this.stores.length) return 0;
        return Math.round((this.activeStoresCount / this.stores.length) * 100);
    }

    get latestStoreName(): string {
        if (!this.stores.length) return 'No stores yet';
        return [...this.stores]
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
            ?.name || 'No stores yet';
    }

    editStore(store: Store) {
        this.selectedStore = { ...store };
        this.isEditing = true;
    }

    createNewStore() {
        this.selectedStore = {
            id: 0,
            ownerName: '',
            ownerEmail: '',
            name: '',
            shortDescription: '',
            longDescription: '',
            isActive: true,
            createdAt: new Date()
        };
        this.isEditing = true;
    }

    saveStore() {
        if (this.selectedStore) {
            if (this.selectedStore.id === 0) {
                this.selectedStore.id = this.stores.length + 1;
                this.stores.push(this.selectedStore);
            } else {
                const index = this.stores.findIndex(s => s.id === this.selectedStore?.id);
                if (index !== -1) {
                    this.stores[index] = this.selectedStore;
                }
            }
            this.isEditing = false;
            this.selectedStore = null;
        }
    }

    publishAndNotify(store: Store) {
        store.isActive = true;
        alert(`Store "${store.name}" published for user: ${store.ownerName}. Notification sent to ${store.ownerEmail}`);
    }

    toggleStoreStatus(store: Store) {
        store.isActive = !store.isActive;
    }

    getStoreCode(store: Store): string {
        return store.code?.trim() || `WH-${String(store.id).padStart(2, '0')}`;
    }

    getStoreRegion(store: Store): string {
        return store.region?.trim() || 'Regional Hub';
    }

    getStorePostalCode(store: Store): string {
        return store.postalCode?.trim() || '00000';
    }

    getStoreAddress(store: Store): string {
        return store.address?.trim() || 'Address details will be assigned after warehouse activation.';
    }

    getSeaTransitDays(store: Store): number {
        return store.seaTransitDays ?? 30;
    }

    getAirTransitDays(store: Store): number {
        return store.airTransitDays ?? 8;
    }

    private updateClock() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();

        this.currentTimeDisplay = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        this.currentDateDisplay = now.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }).replace(/ /g, '-');

        this.hourHandRotation = ((hours % 12) + minutes / 60) * 30;
        this.minuteHandRotation = (minutes + seconds / 60) * 6;
        this.secondHandRotation = seconds * 6;
    }
}
