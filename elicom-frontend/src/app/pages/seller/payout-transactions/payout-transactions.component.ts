import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { WithdrawalService, WithdrawRequestDto } from '../../../services/withdrawal.service';
import { catchError, finalize, of, timeout } from 'rxjs';
import Swal from 'sweetalert2';

type PayoutMode = 'pending' | 'completed' | 'refunds';

@Component({
    selector: 'app-payout-transactions',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './payout-transactions.component.html',
    styleUrls: ['./payout-transactions.component.scss']
})
export class PayoutTransactionsComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private withdrawalService = inject(WithdrawalService);
    private loadingFailSafe: ReturnType<typeof setTimeout> | null = null;

    mode: PayoutMode = 'pending';
    isLoading = true;
    hasLoaded = false;
    requests: WithdrawRequestDto[] = [];
    searchTerm = '';

    ngOnInit(): void {
        this.route.data.subscribe((data) => {
            this.mode = (data['payoutMode'] || 'pending') as PayoutMode;
            this.loadRequests();
        });
    }

    get title(): string {
        if (this.mode === 'completed') return 'Accepted Payout Transactions';
        if (this.mode === 'refunds') return 'Refunded Payout Transactions';
        return 'Pending Payout Transactions';
    }

    get heroKicker(): string {
        return 'Payout Center';
    }

    get heroBadge(): string {
        if (this.mode === 'completed') return 'Settled Transfers';
        if (this.mode === 'refunds') return 'Reversed Transfers';
        return 'Awaiting Review';
    }

    get heroIcon(): string {
        if (this.mode === 'completed') return 'fa-circle-check';
        if (this.mode === 'refunds') return 'fa-arrow-rotate-left';
        return 'fa-clock';
    }

    get emptyStateTitle(): string {
        if (this.mode === 'completed') return 'No completed payouts yet.';
        if (this.mode === 'refunds') return 'No refunded payouts found.';
        return 'No pending payouts right now.';
    }

    get filteredCountLabel(): string {
        if (this.mode === 'completed') return 'Completed';
        if (this.mode === 'refunds') return 'Refunded';
        return 'Pending';
    }

    get description(): string {
        if (this.mode === 'completed') {
            return 'Your completed payouts are listed here. Review successful transfers and reconcile settlement records.';
        }
        if (this.mode === 'refunds') {
            return 'These payout requests were refunded or rejected. Use this log to audit reversal reasons and follow up actions.';
        }
        return 'Your pending payout requests are waiting for processing. Track request status and payment destination details here.';
    }

    get actionButtonLabel(): string {
        if (this.mode === 'completed') return 'View Receipt';
        if (this.mode === 'refunds') return 'View Details';
        return 'Review Payout';
    }

    get filteredRequests(): WithdrawRequestDto[] {
        const modeFiltered = this.requests.filter(r => this.matchesMode(r.status));
        const term = (this.searchTerm || '').trim().toLowerCase();
        if (!term) return modeFiltered;

        return modeFiltered.filter(r => {
            const date = r.creationTime ? new Date(r.creationTime).toLocaleDateString() : '';
            const haystack = [
                r.method || '',
                r.paymentDetails || '',
                r.status || '',
                date,
                String(r.amount ?? '')
            ].join(' ').toLowerCase();

            return haystack.includes(term);
        });
    }

    getStatusClass(status?: string): string {
        const normalized = this.normalizeStatus(status);
        if (this.isCompletedStatus(normalized)) return 'accepted';
        if (this.isRefundedStatus(normalized)) return 'refunded';
        return 'pending';
    }

    getStatusLabel(status?: string): string {
        const normalized = this.normalizeStatus(status);
        if (this.isCompletedStatus(normalized)) return 'Accepted';
        if (this.isRefundedStatus(normalized)) return 'Refunded';
        return 'Pending';
    }

    getMethodLabel(method?: string): string {
        const normalized = this.normalizeStatus(method);
        if (normalized === 'easyfinora') return 'NoshPay';
        return method || 'Third Party';
    }

    getReceiveInLabel(paymentDetails?: string): string {
        if (!paymentDetails) return 'API Payout';
        return paymentDetails
            .replace(/Easy\s*Finora\s*Wallet\s*ID\s*:/i, 'NoshPay Wallet ID:')
            .replace(/EasyFinora\s*Wallet\s*ID\s*:/i, 'NoshPay Wallet ID:')
            .replace(/Easy\s*Finora/gi, 'NoshPay')
            .replace(/EasyFinora/gi, 'NoshPay');
    }

    getRelativeDate(dateValue: string): string {
        if (!dateValue) return '-';
        const date = new Date(dateValue);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const dayMs = 24 * 60 * 60 * 1000;
        const days = Math.floor(diffMs / dayMs);

        if (days <= 0) return 'Today';
        if (days === 1) return '1 day ago';
        if (days < 30) return `${days} days ago`;

        const months = Math.floor(days / 30);
        if (months <= 1) return '1 month ago';
        return `${months} months ago`;
    }

    onActionClick(req: WithdrawRequestDto): void {
        const title = this.actionButtonLabel;
        const normalizedStatus = this.getStatusLabel(req?.status || '');
        const payoutId = req?.id || '-';
        const amount = Number(req?.amount || 0).toFixed(2);
        const method = this.escapeHtml(this.getMethodLabel(req?.method));
        const receiveIn = this.escapeHtml(this.getReceiveInLabel(req?.paymentDetails));
        const createdAt = req?.creationTime ? new Date(req.creationTime).toLocaleString() : '-';
        const remarks = this.escapeHtml(req?.adminRemarks?.trim() || 'N/A');

        Swal.fire({
            title,
            icon: this.mode === 'completed' ? 'success' : this.mode === 'refunds' ? 'warning' : 'info',
            html: `
                <div style="text-align:left;line-height:1.65">
                    <div><b>Request ID:</b> ${this.escapeHtml(String(payoutId))}</div>
                    <div><b>Amount:</b> $${amount}</div>
                    <div><b>Method:</b> ${method}</div>
                    <div><b>Receive In:</b> ${receiveIn}</div>
                    <div><b>Status:</b> ${this.escapeHtml(normalizedStatus)}</div>
                    <div><b>Created At:</b> ${this.escapeHtml(createdAt)}</div>
                    <div><b>Remarks:</b> ${remarks}</div>
                </div>
            `,
            confirmButtonText: 'Close'
        });
    }

    private loadRequests(): void {
        this.isLoading = true;
        this.hasLoaded = false;
        if (this.loadingFailSafe) {
            clearTimeout(this.loadingFailSafe);
        }

        // Prevent infinite skeleton if any unexpected edge-case blocks completion.
        this.loadingFailSafe = setTimeout(() => {
            this.isLoading = false;
            this.hasLoaded = true;
        }, 6000);

        this.withdrawalService.getMyWithdrawRequests(0, 200).pipe(
            timeout(8000),
            catchError((err) => {
                console.error('Failed to load payout transactions:', err);
                return of([]);
            }),
            finalize(() => {
                this.isLoading = false;
                this.hasLoaded = true;
                if (this.loadingFailSafe) {
                    clearTimeout(this.loadingFailSafe);
                    this.loadingFailSafe = null;
                }
            })
        ).subscribe((items) => {
            this.requests = Array.isArray(items) ? items : [];
        });
    }

    private matchesMode(status?: string): boolean {
        const normalized = this.normalizeStatus(status);
        if (this.mode === 'completed') return this.isCompletedStatus(normalized);
        if (this.mode === 'refunds') return this.isRefundedStatus(normalized);
        return this.isPendingStatus(normalized);
    }

    private normalizeStatus(status?: string): string {
        return (status || '').trim().toLowerCase();
    }

    private isCompletedStatus(normalized: string): boolean {
        return ['approved', 'completed', 'accepted', 'processed', 'success', 'done', 'verified'].includes(normalized);
    }

    private isRefundedStatus(normalized: string): boolean {
        return ['rejected', 'failed', 'refunded', 'cancelled', 'canceled'].includes(normalized);
    }

    private isPendingStatus(normalized: string): boolean {
        return ['pending', 'processing', 'in progress', 'inprogress', 'awaiting'].includes(normalized);
    }

    private escapeHtml(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}
