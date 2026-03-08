import { Component, OnInit } from '@angular/core';
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
            name: 'Main Electronic Hub',
            shortDescription: 'Primary warehouse for consumer electronics.',
            longDescription: 'This warehouse handles all small to medium-sized consumer electronics including smartphones, laptops, and accessories.',
            isActive: true,
            createdAt: new Date('2025-10-15')
        },
        {
            id: 2,
            ownerName: 'Adeel Khan',
            ownerEmail: 'adeel@example.com',
            name: 'Home Appliance Depot',
            shortDescription: 'Large appliance storage and distribution.',
            longDescription: 'Specialized facility for refrigerators, washing machines, and other heavy home appliances with specialized loading docks.',
            isActive: false,
            createdAt: new Date('2025-11-20')
        }
    ];

    selectedStore: Store | null = null;
    isEditing = false;

    ngOnInit() {
        // Init any warehouse specific logic
    }

    get activeStoresCount(): number {
        return this.stores.filter(s => s.isActive).length;
    }

    get inactiveStoresCount(): number {
        return this.stores.filter(s => !s.isActive).length;
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
}
