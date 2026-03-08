import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { StoreService } from '../../../services/store.service';
import { filter } from 'rxjs/operators';

@Component({
    selector: 'app-seller-layout',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './seller-layout.component.html',
    styles: [`
        .bg-danger-glass {
            background: rgba(220, 38, 38, 0.4) !important;
            border: 1px solid rgba(255, 255, 255, 0.2) !important;
        }
        .bg-white-10 {
            background: rgba(255, 255, 255, 0.1);
        }
        .bg-danger-soft {
            background: rgba(255, 255, 255, 0.9) !important;
        }
    `],
    styleUrls: ['./seller-layout.component.scss']
})
export class SellerLayoutComponent implements OnInit {
    private router = inject(Router);
    private authService = inject(AuthService);
    private storeService = inject(StoreService);

    isSidebarCollapsed = true;
    showOrderMenu = true;
    showWithdrawMenu = true;
    showStatsMenu = false;
    currentUser: any = null;
    currentStore: any = null;
    showProfileModal = false;
    isStoreLoading = false;
    isProfileLoading = false;
    showCountryMenu = false;

    countryOptions = [
        { name: 'United States', flagUrl: 'https://flagcdn.com/w40/us.png' },
        { name: 'Pakistan', flagUrl: 'https://flagcdn.com/w40/pk.png' },
        { name: 'UK', flagUrl: 'https://flagcdn.com/w40/gb.png' },
        { name: 'Dubai', flagUrl: 'https://flagcdn.com/w40/ae.png' }
    ];
    selectedCountry = this.countryOptions[0];

    ngOnInit() {
        this.currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        this.showOrderMenu = this.isOrderRoute(this.router.url);
        this.showWithdrawMenu = this.isWithdrawRoute(this.router.url);
        this.showStatsMenu = this.isStatsRoute(this.router.url);
        this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe((event: any) => {
            const url = event.urlAfterRedirects || event.url;
            if (this.isOrderRoute(url)) {
                this.showOrderMenu = true;
            }
            if (this.isWithdrawRoute(url)) {
                this.showWithdrawMenu = true;
            }
            if (this.isStatsRoute(url)) {
                this.showStatsMenu = true;
            }
        });
        this.loadMyStore();
    }

    loadMyStore() {
        this.isStoreLoading = true;
        this.storeService.getMyStoreCached(true).subscribe({
            next: (res: any) => {
                this.currentStore = res?.result || res;
                this.isStoreLoading = false;
            },
            error: (err) => {
                console.error('Failed to load store in layout:', err);
                this.isStoreLoading = false;
            }
        });
    }

    toggleSidebar() {
        this.isSidebarCollapsed = !this.isSidebarCollapsed;
    }

    toggleOrderMenu() {
        this.showOrderMenu = !this.showOrderMenu;
    }

    toggleWithdrawMenu() {
        this.showWithdrawMenu = !this.showWithdrawMenu;
    }

    toggleStatsMenu() {
        this.showStatsMenu = !this.showStatsMenu;
    }

    isOrderRoute(url?: string): boolean {
        const current = (url || this.router.url || '').toLowerCase();
        return current.includes('/seller/orders');
    }

    isWithdrawRoute(url?: string): boolean {
        const current = (url || this.router.url || '').toLowerCase();
        return current.includes('/seller/finances/wallet') || current.includes('/seller/finances/payouts');
    }

    isStatsRoute(url?: string): boolean {
        const current = (url || this.router.url || '').toLowerCase();
        return current.includes('/seller/stats');
    }

    openProfileModal() {
        this.showProfileModal = true;
        this.isProfileLoading = true;

        // Fetch fresh user info only when modal opens
        this.authService.getCurrentLoginInformations().subscribe({
            next: (res: any) => {
                if (res?.result?.user) {
                    const user = res.result.user;
                    this.currentUser = {
                        id: user.id,
                        userName: user.userName,
                        emailAddress: user.emailAddress,
                        name: user.name,
                        surname: user.surname,
                        roleNames: user.roleNames || []
                    };
                    // Optional: Update storage so avatar initials/name update globally
                    localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                }
                this.isProfileLoading = false;
            },
            error: (err) => {
                console.error('Failed to fetch profile info:', err);
                this.isProfileLoading = false;
            }
        });
    }

    closeProfileModal() {
        this.showProfileModal = false;
    }

    toggleCountryMenu(event?: MouseEvent) {
        event?.stopPropagation();
        this.showCountryMenu = !this.showCountryMenu;
    }

    selectCountry(country: { name: string; flagUrl: string }, event?: MouseEvent) {
        event?.stopPropagation();
        this.selectedCountry = country;
        this.showCountryMenu = false;
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: MouseEvent) {
        const target = event.target as HTMLElement | null;
        if (!target) return;
        if (!target.closest('.country-dropdown')) {
            this.showCountryMenu = false;
        }
    }

    @HostListener('document:keydown.escape')
    onEscapeKey() {
        this.showCountryMenu = false;
    }

    logout() {
        this.authService.logout();
    }

    getDisplayName(): string {
        // Priority 1: KYC Full Name
        if (this.currentStore?.kyc?.fullName) {
            return this.currentStore.kyc.fullName;
        }
        // Priority 2: User profile name
        if (this.currentUser) {
            const firstName = this.currentUser.name || '';
            const lastName = this.currentUser.surname || '';
            const fullName = (firstName + ' ' + lastName).trim();
            return fullName || 'Seller Admin';
        }
        return 'Seller Admin';
    }

    getInitials(): string {
        const name = this.getDisplayName();
        if (!name || name === 'Seller Admin') return 'SA';

        const parts = name.split(' ').filter(p => p.length > 0);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        } else if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }
        return 'SA';
    }
}
