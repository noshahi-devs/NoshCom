import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { WithdrawService } from '../../../../core/services/withdraw.service';
import { ToastService } from '../../../../core/services/toast.service';
import Swal from 'sweetalert2';

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
                this.toastService.showError(
                    err.error?.error?.message || 'Failed to load withdrawal requests. Check admin permissions.'
                );
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
        return email.replace('GP_', '').replace('PS_', '');
    }

    async approve(withdrawal: any): Promise<void> {
        const amount = Number(withdrawal?.amount) || 0;
        const seller = withdrawal?.userName || this.formatEmail(withdrawal?.userEmailAddress) || 'Seller';
        const method = withdrawal?.method || '—';

        const result = await Swal.fire({
            title: 'Approve Withdrawal',
            html: `
                <div class="swal-withdraw-summary">
                    <p><span>Seller</span><strong>${this.escapeHtml(seller)}</strong></p>
                    <p><span>Amount</span><strong class="amount">$${amount.toFixed(2)}</strong></p>
                    <p><span>Method</span><strong>${this.escapeHtml(method)}</strong></p>
                </div>
                <label class="swal-field-label" for="withdraw-remarks">Approval remarks</label>
                <textarea id="withdraw-remarks" class="swal2-textarea swal-withdraw-textarea">Approved &amp; Processed</textarea>
                <label class="swal-field-label" for="withdraw-proof">Payment reference (optional)</label>
                <input id="withdraw-proof" class="swal2-input" type="text" placeholder="Proof URL or transaction reference" />
            `,
            showCancelButton: true,
            confirmButtonText: 'Approve',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#64748b',
            reverseButtons: true,
            focusConfirm: false,
            customClass: {
                popup: 'swal-withdraw-popup',
                confirmButton: 'swal-withdraw-confirm',
                cancelButton: 'swal-withdraw-cancel'
            },
            preConfirm: () => {
                const remarksEl = document.getElementById('withdraw-remarks') as HTMLTextAreaElement | null;
                const proofEl = document.getElementById('withdraw-proof') as HTMLInputElement | null;
                const remarks = remarksEl?.value?.trim() ?? '';
                const proof = proofEl?.value?.trim() ?? '';

                if (!remarks) {
                    Swal.showValidationMessage('Please enter approval remarks');
                    return false;
                }

                return { remarks, proof };
            }
        });

        if (!result.isConfirmed || !result.value) return;

        const { remarks, proof } = result.value as { remarks: string; proof: string };

        this.isLoading = true;
        this.cdr.detectChanges();

        this.withdrawService.approveWithdraw(withdrawal.id, remarks, proof).subscribe({
            next: () => {
                void Swal.fire({
                    title: 'Approved!',
                    text: 'Withdrawal marked as processed.',
                    icon: 'success',
                    confirmButtonColor: '#10b981'
                });
                this.fetchHistory();
            },
            error: (err) => {
                void Swal.fire({
                    title: 'Approval failed',
                    text: err.error?.error?.message || err.error?.message || 'Could not approve withdrawal.',
                    icon: 'error',
                    confirmButtonColor: '#ef4444'
                });
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    async reject(withdrawal: any): Promise<void> {
        const amount = Number(withdrawal?.amount) || 0;

        const result = await Swal.fire({
            title: 'Reject Withdrawal',
            html: `<p class="swal-withdraw-reject-hint">Reject <strong>$${amount.toFixed(2)}</strong> withdrawal request?</p>`,
            input: 'textarea',
            inputLabel: 'Reason for rejection (required)',
            inputPlaceholder: 'Enter rejection reason...',
            showCancelButton: true,
            confirmButtonText: 'Reject',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            reverseButtons: true,
            inputValidator: (value) => {
                if (!value?.trim()) {
                    return 'Rejection reason is required';
                }
                return null;
            }
        });

        if (!result.isConfirmed || !result.value) return;

        this.isLoading = true;
        this.cdr.detectChanges();

        this.withdrawService.rejectWithdraw(withdrawal.id, result.value.trim()).subscribe({
            next: () => {
                void Swal.fire({
                    title: 'Rejected',
                    text: 'Withdrawal request has been rejected.',
                    icon: 'success',
                    confirmButtonColor: '#10b981'
                });
                this.fetchHistory();
            },
            error: (err) => {
                void Swal.fire({
                    title: 'Rejection failed',
                    text: err.error?.error?.message || err.error?.message || 'Could not reject withdrawal.',
                    icon: 'error',
                    confirmButtonColor: '#ef4444'
                });
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    private escapeHtml(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}
