import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-admin-dashboard',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './admin-dashboard.component.html',
    styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
    stats = [
        { label: 'Total Sellers', value: '1,284', icon: 'fa-users', color: '#4f46e5', trend: '+12%' },
        { label: 'Pending Approvals', value: '42', icon: 'fa-clock', color: '#f59e0b', trend: 'High Priority' },
        { label: 'Active Products', value: '84,520', icon: 'fa-box', color: '#10b981', trend: '+5.4%' },
        { label: 'Total Revenue', value: '$1.2M', icon: 'fa-chart-pie', color: '#3b82f6', trend: '+18%' }
    ];

    recentActivities = [
        { type: 'store', message: 'New store "Tech Haven" applied for approval', time: '2 mins ago', icon: 'fa-store', color: '#4f46e5' },
        { type: 'kyc', message: 'John Doe submitted KYC documents', time: '15 mins ago', icon: 'fa-id-card', color: '#f59e0b' },
        { type: 'payout', message: 'Withdrawal request of $450 from "Urban Style"', time: '1 hour ago', icon: 'fa-money-bill-wave', color: '#10b981' },
        { type: 'logistics', message: 'DHL integration status updated to Active', time: '3 hours ago', icon: 'fa-truck', color: '#3b82f6' }
    ];

    ngOnInit(): void { }
}
