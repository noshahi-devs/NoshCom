import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { WithdrawalService, WithdrawRequestDto } from '../../../services/withdrawal.service';
import { catchError, finalize, of } from 'rxjs';
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
        if (this.mode === 'completed') return 'Review';
        if (this.mode === 'refunds') return 'View Details';
        return 'Review';
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
        if (normalized === 'bank') return 'Bank';
        return method ? method.charAt(0).toUpperCase() + method.slice(1) : 'Third Party';
    }

    getReceiveInLabel(paymentDetails?: string): string {
        if (!paymentDetails) return 'API Payout';
        const normalized = paymentDetails
            .replace(/Easy\s*Finora\s*Wallet\s*ID\s*:/i, 'NoshPay Wallet ID:')
            .replace(/EasyFinora\s*Wallet\s*ID\s*:/i, 'NoshPay Wallet ID:')
            .replace(/Easy\s*Finora/gi, 'NoshPay')
            .replace(/EasyFinora/gi, 'NoshPay');

        const getField = (label: string) => {
            const regex = new RegExp(`(?:^|[,;\\n])\\s*${label}\\s*:\\s*([^,;\\n]*)`, 'i');
            const match = normalized.match(regex);
            return match?.[1]?.trim() || '';
        };

        const iban = getField('IBAN') || getField('IBAN Number') || getField('IBAN No') || getField('International Bank Account Number');
        if (iban) return iban;

        const account = getField('Account Number') || getField('Account No') || getField('Acc') || getField('A/C') || getField('Acct') || getField('Account');
        if (account) return account;

        const walletId = getField('Wallet ID') || getField('Wallet') || getField('NoshPay Wallet ID');
        if (walletId) return walletId;

        return '';
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
        const paymentDetailsHtml = this.buildPaymentDetailsHtml(req?.paymentDetails, req?.method);

        Swal.fire({
            title,
            icon: this.mode === 'completed' ? 'success' : this.mode === 'refunds' ? 'warning' : 'info',
            html: `
                <div style="text-align:left;line-height:1.45;display:flex;flex-wrap:wrap;gap:10px 14px;max-width:100%;overflow-wrap:anywhere;word-break:break-word">
                    <div style="display:flex;flex-direction:column;gap:2px;flex:1 1 220px;min-width:0">
                        <span style="color:#64748b;font-size:0.78rem;font-weight:800;text-transform:uppercase;letter-spacing:0.08em">Request ID</span>
                        <span style="color:#111827;font-weight:800">${this.escapeHtml(String(payoutId))}</span>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:2px;flex:1 1 220px;min-width:0">
                        <span style="color:#64748b;font-size:0.78rem;font-weight:800;text-transform:uppercase;letter-spacing:0.08em">Amount</span>
                        <span style="color:#111827;font-weight:800">$${amount}</span>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:2px;flex:1 1 220px;min-width:0">
                        <span style="color:#64748b;font-size:0.78rem;font-weight:800;text-transform:uppercase;letter-spacing:0.08em">Method</span>
                        <span style="color:#111827;font-weight:800">${method}</span>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:2px;flex:1 1 220px;min-width:0">
                        <span style="color:#64748b;font-size:0.78rem;font-weight:800;text-transform:uppercase;letter-spacing:0.08em">Receive In</span>
                        <span style="color:#111827;font-weight:800;word-break:break-word">${receiveIn}</span>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:2px;flex:1 1 220px;min-width:0">
                        <span style="color:#64748b;font-size:0.78rem;font-weight:800;text-transform:uppercase;letter-spacing:0.08em">Status</span>
                        <span style="color:#111827;font-weight:800">${this.escapeHtml(normalizedStatus)}</span>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:2px;flex:1 1 220px;min-width:0">
                        <span style="color:#64748b;font-size:0.78rem;font-weight:800;text-transform:uppercase;letter-spacing:0.08em">Created At</span>
                        <span style="color:#111827;font-weight:800">${this.escapeHtml(createdAt)}</span>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:2px;flex:1 1 220px;min-width:0">
                        <span style="color:#64748b;font-size:0.78rem;font-weight:800;text-transform:uppercase;letter-spacing:0.08em">Remarks</span>
                        <span style="color:#111827;font-weight:800">${remarks}</span>
                    </div>
                    ${paymentDetailsHtml}
                </div>
            `,
            confirmButtonText: 'Close'
        });
    }

    private buildPaymentDetailsHtml(paymentDetails?: string, method?: string): string {
        if (!paymentDetails) return '';

        const normalizedMethod = this.normalizeStatus(method);
        if (normalizedMethod !== 'bank') {
            return `
                <details style="margin-top:2px;padding-top:10px;border-top:1px solid #e5e7eb">
                    <summary style="cursor:pointer;color:#183153;font-weight:800">Payment Details</summary>
                    <div style="margin-top:8px;color:#111827;word-break:break-word">${this.escapeHtml(paymentDetails)}</div>
                </details>
            `;
        }

        const details = this.parsePaymentDetails(paymentDetails);
        if (!details.length) {
            return `
                <details style="margin-top:2px;padding-top:10px;border-top:1px solid #e5e7eb">
                    <summary style="cursor:pointer;color:#183153;font-weight:800">Payment Details</summary>
                    <div style="margin-top:8px;color:#111827;word-break:break-word">${this.escapeHtml(paymentDetails)}</div>
                </details>
            `;
        }

        const rows = details.map(item => `
            <div style="display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid #f1f5f9">
                <span style="color:#64748b;font-size:0.74rem;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;flex:0 0 auto">${this.escapeHtml(item.label)}</span>
                <span style="color:#111827;font-weight:800;word-break:break-word;text-align:right;flex:1 1 auto">${this.escapeHtml(item.value)}</span>
            </div>
        `).join('');

        return `
            <details style="margin-top:2px;padding-top:10px;border-top:1px solid #e5e7eb">
                <summary style="cursor:pointer;color:#183153;font-weight:800">Payment Details</summary>
                <div style="display:flex;flex-direction:column;gap:2px;margin-top:8px">${rows}</div>
            </details>
        `;
    }

    private parsePaymentDetails(paymentDetails: string): Array<{ label: string; value: string }> {
        const segments = paymentDetails
            .split(/[,;\n]+/)
            .map(part => part.trim())
            .filter(Boolean);

        const preferredOrder = ['Country', 'Bank', 'Account Type', 'Account Title', 'Account', 'IBAN', 'Routing', 'Reference', 'Wallet ID', 'CryptoId', 'CryptoTitle'];
        const entries = new Map<string, string>();

        for (const segment of segments) {
            const colonIndex = segment.indexOf(':');
            if (colonIndex === -1) continue;

            const key = segment.slice(0, colonIndex).trim();
            const value = segment.slice(colonIndex + 1).trim();
            if (key && value) {
                entries.set(key, value);
            }
        }

        const result: Array<{ label: string; value: string }> = [];
        for (const wanted of preferredOrder) {
            for (const [key, value] of entries.entries()) {
                if (key.toLowerCase() === wanted.toLowerCase()) {
                    result.push({ label: key, value });
                    entries.delete(key);
                    break;
                }
            }
        }

        for (const [key, value] of entries.entries()) {
            result.push({ label: key, value });
        }

        return result;
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
