import { Component, OnInit, AfterViewInit } from '@angular/core';
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
export class AdminLayoutComponent implements OnInit, AfterViewInit {
    sidebarCollapsed = false;
    mobileSidebarOpen = false;
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
    }

    ngOnInit() {
        this.updateDisplayIdentity();
    }

    ngAfterViewInit() {
        this.initializeSidebarToggle();
    }

    initializeSidebarToggle() {
        const userMenuBtn = document.getElementById('userMenuBtn');
        const userDropdown = document.getElementById('userDropdown');

        if (userMenuBtn && userDropdown) {
            userMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleUserDropdown(userDropdown);
            });
        }

        document.addEventListener('click', (e) => {
            if (userDropdown && !userDropdown.contains(e.target as Node) && userMenuBtn && !userMenuBtn.contains(e.target as Node)) {
                this.closeUserDropdown(userDropdown);
            }
        });
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
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            this.mobileSidebarOpen = !this.mobileSidebarOpen;
            return;
        }
        this.sidebarCollapsed = !this.sidebarCollapsed;
    }

    toggleUserDropdown(userDropdown: HTMLElement) {
        userDropdown.classList.toggle('show');
    }

    closeUserDropdown(userDropdown: HTMLElement) {
        userDropdown.classList.remove('show');
    }

    showNotifications() {
        this.toastService.showInfo('No new notifications at the moment.');
    }

    openProfile() {
        if (this.isSellerView) {
            this.router.navigate(['/seller/profile']);
            return;
        }
        this.toastService.showInfo('Profile settings are coming soon.');
    }

    logout() {
        this.authService.logout();
        this.router.navigate(['/auth/login']);
    }

    private scrollToTop(): void {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }
}
