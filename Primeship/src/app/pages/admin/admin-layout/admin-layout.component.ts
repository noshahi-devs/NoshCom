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
        const sidebarToggleBtn = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.querySelector('.main-content');
        const userMenuBtn = document.getElementById('userMenuBtn');
        const userDropdown = document.getElementById('userDropdown');

        if (sidebarToggleBtn && sidebar && mainContent) {
            sidebarToggleBtn.addEventListener('click', () => {
                this.toggleSidebar(sidebar as HTMLElement, mainContent as HTMLElement, sidebarToggleBtn as HTMLElement);
            });
        }

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

    toggleSidebar(sidebar: HTMLElement, mainContent: HTMLElement, toggleBtn: HTMLElement) {
        const toggleIcon = toggleBtn.querySelector('.toggle-icon');
        this.sidebarCollapsed = !this.sidebarCollapsed;

        if (this.sidebarCollapsed) {
            sidebar.classList.add('collapsed');
            mainContent.classList.add('sidebar-collapsed');
        } else {
            sidebar.classList.remove('collapsed');
            mainContent.classList.remove('sidebar-collapsed');
        }

        // Mobile Sidebar Support
        sidebar.classList.toggle('show');
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
}
