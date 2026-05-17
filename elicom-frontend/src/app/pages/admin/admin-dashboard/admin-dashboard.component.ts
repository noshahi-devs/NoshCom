import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-admin-dashboard',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './admin-dashboard.component.html',
    styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
    private zone = inject(NgZone);
    private cdr = inject(ChangeDetectorRef);

    // Clock
    currentDate: string = '';
    currentTime: string = '';
    private timer: any;

    stats = [
        { label: 'Total Sellers', value: '1,284', icon: 'fa-users', iconType: 'icon-primary', trend: '12%' },
        { label: 'Pending Approvals', value: '42', icon: 'fa-clock', iconType: 'icon-alt', trend: '' },
        { label: 'Active Products', value: '84,520', icon: 'fa-box', iconType: 'icon-primary', trend: '5.4%' },
        { label: 'Total Revenue', value: '$1.2M', icon: 'fa-chart-pie', iconType: 'icon-alt', trend: '18%' }
    ];

    recentActivities = [
        { type: 'Store Verification', message: 'New enterprise vendor "Tech Haven" has submitted a request for platform onboarding.', time: '2 mins ago', icon: 'fa-store', action: 'Approve' },
        { type: 'Compliance Check', message: 'Vendor "John Doe" uploaded requisite KYC documentation for compliance review.', time: '15 mins ago', icon: 'fa-id-card', action: 'Review' },
        { type: 'Financial Operation', message: 'Automated withdrawal requested: $450.00 from store account "Urban Style".', time: '1 hour ago', icon: 'fa-money-bill-wave', action: 'Process' },
        { type: 'System Integration', message: 'Logistics partner DHL API bridge status has been successfully verified.', time: '3 hours ago', icon: 'fa-network-wired', action: 'Details' }
    ];

    ngOnInit(): void {
        this.startClock();
    }

    ngOnDestroy() {
        if (this.timer) {
            clearInterval(this.timer);
        }
    }

    startClock() {
        this.updateTime();
        this.zone.runOutsideAngular(() => {
            this.timer = setInterval(() => {
                this.zone.run(() => {
                    this.updateTime();
                    this.cdr.markForCheck();
                });
            }, 1000);
        });
    }

    updateTime() {
        const now = new Date();
        const nyDate = new Intl.DateTimeFormat('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            timeZone: 'America/New_York'
        }).format(now);
        const nyTime = new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'America/New_York'
        }).format(now);

        this.currentDate = nyDate.replace(/ /g, '-');
        this.currentTime = nyTime;
    }
}
