import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { WithdrawService } from '../../../../core/services/withdraw.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
    selector: 'app-withdraw-approval',
    standalone: true,
    imports: [CommonModule, DatePipe, CurrencyPipe],
    templateUrl: './withdraw-approval.component.html',
    styleUrl: './withdraw-approval.component.scss',
})
export class WithdrawApprovalComponent implements OnInit {

    withdrawals: any[] = [];
    isLoading = false;
    totalCount = 0;
    statusFilter: 'all' | 'pending' | 'approved' | 'rejected' = 'all';

    constructor(
        private withdrawService: WithdrawService,
        private toastService: ToastService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.fetchHistory();
    }

    fetchHistory() {
        this.isLoading = true;
        this.cdr.detectChanges();

        this.withdrawService.getAllWithdrawRequests(0, 1000).subscribe({
            next: (res: any) => {
                this.withdrawals = res?.result?.items ?? [];
                this.totalCount = res?.result?.totalCount ?? 0;
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('WithdrawApproval: Failed to load requests', err);
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    get filteredWithdrawals(): any[] {
        return this.withdrawals.filter((w) => this.matchesStatus(w?.status));
    }

    setStatusFilter(filter: 'all' | 'pending' | 'approved' | 'rejected') {
        this.statusFilter = filter;
    }

    private matchesStatus(status: unknown): boolean {
        if (this.statusFilter === 'all') return true;
        return this.normalizeStatus(status) === this.statusFilter;
    }

    public normalizeStatus(status: unknown): 'pending' | 'approved' | 'rejected' | '' {
        const normalized = String(status ?? '').trim().toLowerCase();
        if (normalized === 'reject') return 'rejected';
        if (normalized === 'pending' || normalized === 'approved' || normalized === 'rejected') {
            return normalized;
        }
        return '';
    }

    formatEmail(email: string): string {
        if (!email) return 'Unknown';
        return email.replace('GP_', '');
    }

    approve(withdrawal: any) {
        const remarks = prompt('Enter Approval Remarks:', 'Approved & Processed');
        if (remarks === null) return;
        
        const proof = prompt('Enter Payment Reference/Proof URL (Optional):', '');

        this.isLoading = true;
        this.withdrawService.approveWithdraw(withdrawal.id, remarks, proof || '').subscribe({
            next: () => {
                this.toastService.showSuccess('Withdrawal approved and marked as processed.');
                this.fetchHistory();
            },
            error: (err) => {
                this.toastService.showError(err.error?.error?.message || 'Failed to approve');
                this.isLoading = false;
            }
        });
    }

    reject(withdrawal: any) {
        const remarks = prompt('Enter Reason for Rejection (Required):');
        if (!remarks) {
            if (remarks === '') this.toastService.showError('Rejection reason is required.');
            return;
        }

        this.isLoading = true;
        this.withdrawService.rejectWithdraw(withdrawal.id, remarks).subscribe({
            next: () => {
                this.toastService.showSuccess('Withdrawal request rejected.');
                this.fetchHistory();
            },
            error: (err) => {
                this.toastService.showError(err.error?.error?.message || 'Failed to reject');
                this.isLoading = false;
            }
        });
    }
}
