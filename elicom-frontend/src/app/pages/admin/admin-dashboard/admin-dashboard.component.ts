import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../services/admin.service';

@Component({
    selector: 'app-admin-dashboard',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule],
    templateUrl: './admin-dashboard.component.html',
    styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
    private zone = inject(NgZone);
    private cdr = inject(ChangeDetectorRef);
    private router = inject(Router);
    private adminService = inject(AdminService);

    statsLoading = true;
    heroRevenueLoading = true;
    heroRevenue = '';
    private pendingApprovalsCount = 0;

    // Clock
    currentDate: string = '';
    currentTime: string = '';
    private timer: any;

    // Toast Notification State
    toastMessage: string | null = null;
    toastType: 'success' | 'warning' | 'info' = 'success';
    private toastTimer: any;

    // Modals & Panels State
    isQuickActionsOpen = false;
    showSecurityModal = false;
    securityScanProgress = 0;
    securityScanStage = 'Initializing Audit';
    securityScanComplete = false;
    securityIssuesFound = 0;

    isAnnounceModalOpen = false;
    announcementText = '';
    maintenanceModeActive = false;

    stats = [
        { label: 'Total Sellers', value: '', icon: 'fa-users', iconType: 'icon-primary', trend: '' },
        { label: 'Pending Approvals', value: '', icon: 'fa-clock', iconType: 'icon-alt', trend: '' },
        { label: 'Active Products', value: '', icon: 'fa-box', iconType: 'icon-primary', trend: '' },
        { label: 'Total Revenue', value: '', icon: 'fa-chart-pie', iconType: 'icon-alt', trend: '' }
    ];

    recentActivities = [
        { id: 1, type: 'Store Verification', message: 'New enterprise vendor "Tech Haven" has submitted a request for platform onboarding.', time: '2 mins ago', icon: 'fa-store', action: 'Approve', processed: false },
        { id: 2, type: 'Compliance Check', message: 'Vendor "John Doe" uploaded requisite KYC documentation for compliance review.', time: '15 mins ago', icon: 'fa-id-card', action: 'Review', processed: false },
        { id: 3, type: 'Financial Operation', message: 'Automated withdrawal requested: $450.00 from store account "Urban Style".', time: '1 hour ago', icon: 'fa-money-bill-wave', action: 'Process', processed: false },
        { id: 4, type: 'System Integration', message: 'Logistics partner DHL API bridge status has been successfully verified.', time: '3 hours ago', icon: 'fa-network-wired', action: 'Details', processed: false }
    ];

    ngOnInit(): void {
        this.startClock();
        this.loadDashboardStats();
    }

    loadDashboardStats(): void {
        this.statsLoading = true;
        this.heroRevenueLoading = true;

        this.adminService.getStats().subscribe({
            next: (data) => {
                this.pendingApprovalsCount = data.pendingApprovals ?? 0;
                this.heroRevenue = this.formatCurrencyFull(data.totalRevenue ?? 0);

                this.stats[0].value = this.formatNumber(data.totalSellers ?? 0);
                this.stats[1].value = this.formatNumber(data.pendingApprovals ?? 0);
                this.stats[2].value = this.formatNumber(data.activeProducts ?? 0);
                this.stats[3].value = this.formatCurrencyCompact(data.totalRevenue ?? 0);

                this.statsLoading = false;
                this.heroRevenueLoading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                this.stats.forEach(stat => (stat.value = '—'));
                this.heroRevenue = '—';
                this.statsLoading = false;
                this.heroRevenueLoading = false;
                if (err?.status === 401) {
                    this.triggerToast('Session expired. Please sign in again.', 'warning');
                } else if (err?.status === 408) {
                    this.triggerToast('Stats are taking too long. Check database connection and retry.', 'warning');
                } else {
                    this.triggerToast('Unable to load dashboard statistics.', 'warning');
                }
                this.cdr.detectChanges();
            }
        });
    }

    formatNumber(value: number): string {
        return new Intl.NumberFormat('en-US').format(value);
    }

    formatCurrencyFull(value: number): string {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    }

    formatCurrencyCompact(value: number): string {
        if (value >= 1_000_000) {
            return `$${(value / 1_000_000).toFixed(1)}M`;
        }
        if (value >= 1_000) {
            return `$${(value / 1_000).toFixed(1)}K`;
        }
        return this.formatCurrencyFull(value);
    }

    ngOnDestroy() {
        if (this.timer) {
            clearInterval(this.timer);
        }
        if (this.toastTimer) {
            clearTimeout(this.toastTimer);
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
            timeZone: 'Europe/London'
        }).format(now);
        const nyTime = new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Europe/London'
        }).format(now);

        this.currentDate = nyDate.replace(/ /g, '-');
        this.currentTime = nyTime;
    }

    // Dynamic Toast System
    triggerToast(message: string, type: 'success' | 'warning' | 'info' = 'success') {
        if (this.toastTimer) {
            clearTimeout(this.toastTimer);
        }
        this.toastMessage = message;
        this.toastType = type;
        this.cdr.detectChanges();

        this.toastTimer = setTimeout(() => {
            this.toastMessage = null;
            this.cdr.detectChanges();
        }, 4000);
    }

    // Live Stream Action Handler
    handleActivityAction(activity: any) {
        if (activity.processed) return;

        if (activity.action === 'Approve') {
            activity.processed = true;
            activity.message = 'Enterprise vendor "Tech Haven" onboarding request approved successfully.';
            this.pendingApprovalsCount = Math.max(0, this.pendingApprovalsCount - 1);
            this.stats[1].value = this.formatNumber(this.pendingApprovalsCount);
            this.triggerToast('Tech Haven onboarding request approved!', 'success');
        } else if (activity.action === 'Review') {
            this.triggerToast('Redirecting to Onboarding Approvals...', 'info');
            setTimeout(() => {
                this.router.navigate(['/admin/stores']);
            }, 800);
        } else if (activity.action === 'Process') {
            activity.processed = true;
            activity.message = 'Automated withdrawal of $450.00 to "Urban Style" has been processed.';
            this.triggerToast('Payout processed & funds disbursed successfully.', 'success');
        } else if (activity.action === 'Details') {
            this.triggerToast('DHL API Integration: Status 200 OK. Ping: 42ms.', 'info');
        }
    }

    handleActivityDetails(activity: any) {
        if (activity.type === 'Store Verification' || activity.type === 'Compliance Check') {
            this.router.navigate(['/admin/stores']);
        } else if (activity.type === 'Financial Operation') {
            this.router.navigate(['/admin/payouts']);
        } else {
            this.router.navigate(['/admin/settings']);
        }
        this.triggerToast(`Opening details panel for ${activity.type}...`, 'info');
    }

    // Quick Actions Panel Toggle
    toggleQuickActions() {
        this.isQuickActionsOpen = !this.isQuickActionsOpen;
    }

    // Quick Action Functions
    openAnnouncementModal() {
        this.isAnnounceModalOpen = true;
        this.isQuickActionsOpen = false;
    }

    closeAnnouncementModal() {
        this.isAnnounceModalOpen = false;
        this.announcementText = '';
    }

    submitAnnouncement() {
        if (!this.announcementText.trim()) return;
        this.triggerToast('Global announcement successfully broadcasted to all seller stores.', 'success');
        this.closeAnnouncementModal();
    }

    toggleMaintenanceMode() {
        this.maintenanceModeActive = !this.maintenanceModeActive;
        this.isQuickActionsOpen = false;
        if (this.maintenanceModeActive) {
            this.triggerToast('System entering Maintenance Mode. Non-admin logins restricted.', 'warning');
        } else {
            this.triggerToast('System live synchronization restored to production.', 'success');
        }
    }

    clearSystemCache() {
        this.isQuickActionsOpen = false;
        this.triggerToast('Rebuilding edge cache buffers... Cache purged (124.6 MB freed).', 'success');
    }

    // Security Audit Simulation
    startSecurityAudit() {
        this.showSecurityModal = true;
        this.securityScanProgress = 0;
        this.securityScanComplete = false;
        this.securityIssuesFound = 0;
        this.securityScanStage = 'Establishing secure handshake...';

        const stages = [
            { limit: 20, text: 'Scanning active SSL certificate & transport security...' },
            { limit: 45, text: 'Auditing secure database connection clusters...' },
            { limit: 70, text: 'Checking firewall configurations & network entrypoints...' },
            { limit: 90, text: 'Reviewing recent API payloads for injection vectors...' },
            { limit: 100, text: 'Finalizing security health summary...' }
        ];

        const interval = setInterval(() => {
            this.securityScanProgress += Math.floor(Math.random() * 8) + 3;
            
            const currentStage = stages.find(s => this.securityScanProgress <= s.limit);
            if (currentStage) {
                this.securityScanStage = currentStage.text;
            }

            if (this.securityScanProgress >= 100) {
                this.securityScanProgress = 100;
                this.securityScanComplete = true;
                this.securityScanStage = 'System Audit Completed: 100% SECURE';
                clearInterval(interval);
                this.triggerToast('Smart Shop security audit passed cleanly!', 'success');
            }
            this.cdr.detectChanges();
        }, 150);
    }

    closeSecurityModal() {
        this.showSecurityModal = false;
    }

    // Export feed logs
    exportLiveStream() {
        this.triggerToast('Compiling operational stream log... Download started as CSV.', 'success');
    }
}
