import { AfterViewInit, Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import Swal from 'sweetalert2';
import { Header } from '../../../shared/header/header';

@Component({
    selector: 'app-customer-layout',
    standalone: true,
    imports: [CommonModule, RouterModule, Header],
    templateUrl: './customer-layout.component.html',
    styleUrl: './customer-layout.component.scss'
})
export class CustomerLayoutComponent implements OnInit, AfterViewInit {
    @ViewChild('sidebarRef') sidebarRef?: ElementRef<HTMLElement>;

    userName: string = 'Customer';
    isSidebarCollapsed: boolean = true;
    sidebarStickyTop: number = 124;

    menuGroups = [
        {
            title: 'Account',
            items: [
                { label: 'Dashboard', path: '/customer/dashboard', icon: 'fa-table-cells' },
                { label: 'My Profile', path: '/customer/profile', icon: 'fa-user' },
                { label: 'Customer Service', path: '/customer/support', icon: 'fa-headset' }
            ]
        },
        {
            title: 'Orders',
            items: [
                { label: 'All Orders', path: '/customer/orders', icon: 'fa-box' },
                { label: 'Pending', path: '/customer/orders/Pending', icon: 'fa-clock' },
                { label: 'Shipped', path: '/customer/orders/Shipped', icon: 'fa-truck' },
                { label: 'Delivered', path: '/customer/orders/Delivered', icon: 'fa-check-double' },
                { label: 'Cancelled', path: '/customer/orders/Cancelled', icon: 'fa-xmark' },
                { label: 'Return', path: '/customer/orders/Return', icon: 'fa-rotate-left' }
            ]
        }
    ];

    constructor(
        private router: Router,
        private authService: AuthService
    ) { }

    ngAfterViewInit(): void {
        setTimeout(() => this.updateSidebarStickyTop());
    }

    toggleSidebar() {
        this.isSidebarCollapsed = !this.isSidebarCollapsed;
    }

    ngOnInit(): void {
        this.authService.currentUser$.subscribe(user => {
            if (user) {
                this.userName = user.name
                    ? `${user.name}${user.surname ? ' ' + user.surname : ''}`
                    : (user.userName || 'Customer');

                setTimeout(() => this.updateSidebarStickyTop());
            }
        });
    }

    @HostListener('window:resize')
    onWindowResize(): void {
        this.updateSidebarStickyTop();
    }

    logout() {
        Swal.fire({
            title: 'Logout',
            text: 'Are you sure you want to sign out?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, logout',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#000000',
            cancelButtonColor: '#d33'
        }).then((result) => {
            if (result.isConfirmed) {
                this.authService.logout();
                this.router.navigate(['/']);
                Swal.fire({
                    title: 'Signed Out',
                    text: 'You have been logged out successfully.',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
            }
        });
    }

    private updateSidebarStickyTop(): void {
        if (typeof window === 'undefined' || !this.sidebarRef?.nativeElement || window.innerWidth <= 1200) {
            this.sidebarStickyTop = 124;
            return;
        }

        const sidebarHeight = this.sidebarRef.nativeElement.offsetHeight;
        const viewportHeight = window.innerHeight;
        const minTop = 124;
        const viewportPadding = 8;
        const bottomLockedTop = viewportHeight - sidebarHeight - viewportPadding;

        this.sidebarStickyTop = Math.max(minTop, bottomLockedTop);
    }
}
