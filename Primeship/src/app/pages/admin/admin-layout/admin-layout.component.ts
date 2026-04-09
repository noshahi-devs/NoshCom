import { Component, OnInit, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
    selector: 'app-admin-layout',
    standalone: true,
    imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
    templateUrl: './admin-layout.component.html',
    styleUrls: ['./admin-layout.component.scss']
})
export class AdminLayoutComponent implements OnInit {
    sidebarCollapsed = false;
    mobileSidebarOpen = false;
    sellerSidebarExpanded = false;
    isUserDropdownOpen = false;
    isAdminView = false;
    isSellerView = false;
    userEmail = 'portal@primeship.com';
    userFirstName = 'Seller';

    get sellerPortalName(): string {
        return `${this.userFirstName} PS Seller`;
    }

    get profileDisplayName(): string {
        return this.isAdminView ? 'Admin' : this.sellerPortalName;
    }

    get headerProfileLabel(): string {
        return this.isAdminView ? 'User Profile' : this.sellerPortalName;
    }

    get sellerIconOnly(): boolean {
        return this.isSellerView && window.innerWidth > 992 && !this.sellerSidebarExpanded;
    }

    get sidebarToggleIcon(): string {
        const isMobile = window.innerWidth <= 992;

        if (isMobile) {
            return this.mobileSidebarOpen ? 'fa-times' : 'fa-bars';
        }

        if (this.isSellerView) {
            return this.sellerIconOnly ? 'fa-bars' : 'fa-chevron-left';
        }

        return 'fa-indent';
    }

    constructor(
        private router: Router,
        private authService: AuthService,
        private toastService: ToastService
    ) {
        this.updateViewMode();
        this.updateDisplayIdentity();
        this.router.events.pipe(
            filter(event => event instanceof NavigationEnd)
        ).subscribe(() => {
            this.updateViewMode();
            this.updateDisplayIdentity();
            this.mobileSidebarOpen = false;
            this.isUserDropdownOpen = false;
            this.scrollToTop();
        });
    }

    private updateViewMode() {
        const url = this.router.url;
        const isAdmin = this.authService.isAdmin();

        // Only show Admin view if user HAS Admin role AND is on an admin route
        this.isAdminView = url.includes('/admin') && isAdmin;

        // Show Seller view if on a seller route OR if they are a seller trying to access layout
        this.isSellerView = url.includes('/seller') || (!isAdmin && this.authService.isSeller());

        // Double check: if both true (shouldn't happen with strict routes), admin wins on admin routes
        if (this.isAdminView && url.includes('/admin')) {
            this.isSellerView = false;
        }

        if (this.isSellerView) {
            this.sidebarCollapsed = false;
            if (window.innerWidth <= 992) {
                this.sellerSidebarExpanded = false;
            }
        }
    }

    ngOnInit() {
        this.updateDisplayIdentity();
    }

    private updateDisplayIdentity(): void {
        const firstName = (this.authService.getUserFirstName() || '').trim();
        const userEmail = (this.authService.getUserEmail() || localStorage.getItem('userEmail') || '').trim();

        if (firstName) {
            this.userFirstName = firstName;
        }

        if (userEmail) {
            this.userEmail = userEmail;
        }
    }

    onSidebarToggle() {
        const isMobile = window.innerWidth <= 992;
        if (isMobile) {
            this.mobileSidebarOpen = !this.mobileSidebarOpen;
            this.isUserDropdownOpen = false;
            return;
        }

        if (this.isSellerView) {
            this.sellerSidebarExpanded = !this.sellerSidebarExpanded;
            this.isUserDropdownOpen = false;
            return;
        }

        this.sidebarCollapsed = !this.sidebarCollapsed;
        this.isUserDropdownOpen = false;
    }

    toggleUserDropdown(event?: Event) {
        event?.stopPropagation();
        this.isUserDropdownOpen = !this.isUserDropdownOpen;
    }

    closeUserDropdown() {
        this.isUserDropdownOpen = false;
    }

    @HostListener('document:click')
    onDocumentClick() {
        this.closeUserDropdown();
    }

    showNotifications() {
        this.toastService.showInfo('No new notifications at the moment.');
    }

    openProfile() {
        this.closeUserDropdown();
        if (this.isSellerView) {
            this.router.navigate(['/seller/profile']);
            return;
        }
        this.toastService.showInfo('Profile settings are coming soon.');
    }

    logout() {
        this.closeUserDropdown();
        this.authService.logout();
        this.router.navigate(['/auth/login']);
    }

    private scrollToTop(): void {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
}
