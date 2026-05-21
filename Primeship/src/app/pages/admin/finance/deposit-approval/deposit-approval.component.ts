import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DepositService } from '../../../../core/services/deposit.service';
import { ToastService } from '../../../../core/services/toast.service';

type DepositActionType = 'approve' | 'reject';

interface DepositActionModal {
    type: DepositActionType;
    deposit: any;
}

@Component({
    selector: 'app-deposit-approval',
    standalone: true,
    imports: [CommonModule, DatePipe, CurrencyPipe, FormsModule],
    templateUrl: './deposit-approval.component.html',
    styleUrl: './deposit-approval.component.scss',
})
export class DepositApprovalComponent implements OnInit {

    deposits: any[] = [];
    isLoading = false;
    isSubmitting = false;
    totalCount = 0;
    statusFilter: 'all' | 'pending' | 'approved' | 'rejected' = 'all';
    actionModal: DepositActionModal | null = null;
    adminRemarks = 'Approved';

    constructor(
        private depositService: DepositService,
        private toastService: ToastService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.fetchHistory();
    }

    fetchHistory() {
        this.isLoading = true;
        this.cdr.detectChanges();

        this.depositService.getAllDepositRequests(0, 1000).subscribe({
            next: (res: any) => {
                this.deposits = res?.result?.items ?? [];
                this.totalCount = res?.result?.totalCount ?? 0;
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('DepositApproval: Failed to load requests', err);
                this.toastService.showError(
                    err.error?.error?.message || 'Failed to load deposit requests. Check admin permissions.'
                );
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    get filteredDeposits(): any[] {
        return this.deposits.filter((deposit) => this.matchesStatus(deposit?.status));
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
        return email.replace('GP_', '').replace('PS_', '');
    }

    openApproveModal(deposit: any) {
        this.actionModal = { type: 'approve', deposit };
        this.adminRemarks = 'Approved';
    }

    openRejectModal(deposit: any) {
        this.actionModal = { type: 'reject', deposit };
        this.adminRemarks = '';
    }

    closeActionModal() {
        if (this.isSubmitting) return;
        this.actionModal = null;
        this.adminRemarks = 'Approved';
    }

    confirmAction() {
        if (!this.actionModal) return;

        const depositId = this.resolveDepositId(this.actionModal.deposit);
        if (!depositId) {
            this.toastService.showError('Invalid deposit id. Refresh the page and try again.');
            return;
        }

        if (this.actionModal.type === 'reject' && !this.adminRemarks.trim()) {
            this.toastService.showWarning('Please enter a reason for rejection.');
            return;
        }

        this.isSubmitting = true;
        const remarks = this.adminRemarks.trim() || (this.actionModal.type === 'approve' ? 'Approved' : '');
        const request$ = this.actionModal.type === 'approve'
            ? this.depositService.approveDeposit(depositId, remarks)
            : this.depositService.rejectDeposit(depositId, remarks);

        request$.subscribe({
            next: () => {
                const wasApprove = this.actionModal?.type === 'approve';
                this.isSubmitting = false;
                this.actionModal = null;
                this.adminRemarks = 'Approved';
                this.toastService.showSuccess(
                    wasApprove
                        ? 'Deposit approved. Funds credited to seller wallet.'
                        : 'Deposit rejected successfully.'
                );
                this.fetchHistory();
            },
            error: (err) => {
                this.isSubmitting = false;
                this.toastService.showError(
                    err.error?.error?.message || err.error?.message || 'Action failed. Please try again.'
                );
                this.cdr.detectChanges();
            }
        });
    }

    get modalTitle(): string {
        if (!this.actionModal) return '';
        return this.actionModal.type === 'approve' ? 'Approve Deposit' : 'Reject Deposit';
    }

    get modalSubtitle(): string {
        if (!this.actionModal) return '';
        const d = this.actionModal.deposit;
        const amount = d?.amount ?? 0;
        const user = this.formatEmail(d?.userName || d?.fullName || 'seller');
        return this.actionModal.type === 'approve'
            ? `Credit $${amount} to ${user}'s wallet?`
            : `Reject deposit of $${amount} from ${user}?`;
    }

    approve(deposit: any) {
        this.openApproveModal(deposit);
    }

    reject(deposit: any) {
        this.openRejectModal(deposit);
    }

    viewProof(deposit: any) {
        if (deposit.proofImage) {
            this.openImageInNewTab(deposit.proofImage);
            return;
        }

        const depositId = this.resolveDepositId(deposit);
        if (!depositId) return;

        this.isLoading = true;
        this.depositService.getProofImage(depositId).subscribe({
            next: (res: any) => {
                deposit.proofImage = res.result;
                this.isLoading = false;
                this.openImageInNewTab(deposit.proofImage);
                this.cdr.detectChanges();
            },
            error: () => {
                this.toastService.showError('Failed to load image');
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    private resolveDepositId(deposit: any): string {
        const raw = deposit?.id ?? deposit?.Id;
        return raw == null ? '' : String(raw).trim();
    }

    private openImageInNewTab(proofImage: string) {
        if (!proofImage) return;
        let url = proofImage;
        if (proofImage.startsWith('data:')) {
            url = proofImage;
        } else if (proofImage.length > 100 && !proofImage.includes('/') && !proofImage.includes('.')) {
            url = `data:image/jpeg;base64,${proofImage}`;
        } else {
            url = proofImage.startsWith('http') ? proofImage : `/assets/proofs/${proofImage}`;
        }

        const win = window.open('', '_blank');
        if (win) {
            win.document.write(`
                <html>
                    <head><title>Proof of Deposit</title></head>
                    <body style="margin:0;background:#111;display:flex;justify-content:center;align-items:center;min-height:100vh;">
                        <img src="${url}" alt="Deposit Proof" style="max-width:95%;border-radius:8px;" />
                    </body>
                </html>
            `);
            win.document.close();
        }
    }
}
