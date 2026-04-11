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
            name: 'Tech Fulfillment Center',
            shortDescription: 'Core storage and dispatch point for electronics inventory.',
            longDescription: 'This facility manages day-to-day handling for smartphones, laptops, accessories, and other fast-moving technology products.',
            isActive: true,
            createdAt: new Date('2025-10-15')
        },
        {
            id: 2,
            ownerName: 'Adeel Khan',
            ownerEmail: 'adeel@example.com',
            name: 'Home Essentials Warehouse',
            shortDescription: 'Dedicated storage and routing space for home appliances.',
            longDescription: 'This warehouse is arranged for large household products including refrigerators, washing machines, kitchen units, and other bulky appliance orders.',
            isActive: false,
            createdAt: new Date('2025-11-20')
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
