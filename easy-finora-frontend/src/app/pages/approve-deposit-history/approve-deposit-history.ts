import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { NgFor, DatePipe, CurrencyPipe, NgIf, CommonModule } from '@angular/common';
import { DepositService } from '../../services/deposit.service';
import { ToastService } from '../../shared/toast/toast.service';
import { Loader } from '../../shared/loader/loader';

@Component({
    selector: 'app-approve-deposit-history',
    standalone: true,
    imports: [CommonModule, DatePipe, CurrencyPipe, Loader],
    templateUrl: './approve-deposit-history.html',
    styleUrl: './approve-deposit-history.scss',
})
export class ApproveDepositHistory implements OnInit {

    deposits: any[] = [];
    isLoading = false;
    totalCount = 0;
    statusFilter: 'all' | 'pending' | 'approved' | 'rejected' = 'all';

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

        // Fetch all records (no pagination) - sorted newest first by backend
        this.depositService.getAllDepositRequests(0, 1000).subscribe({
            next: (res: any) => {
                console.log('[ADMIN DEBUG] Received Deposits:', res?.result?.items);
                this.deposits = res?.result?.items ?? [];
                this.totalCount = res?.result?.totalCount ?? 0;
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('ApproveDepositHistory: Failed to load requests', err);
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

    private normalizeStatus(status: unknown): 'pending' | 'approved' | 'rejected' | '' {
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

    approve(deposit: any) {
        this.toastService.showConfirm(
            'Approve Deposit',
            `Are you sure you want to approve the deposit of ${deposit.amount} ${deposit.currency || 'USD'} for ${this.formatEmail(deposit.userName)}?`,
            (remarks) => {
                this.isLoading = true;
                this.depositService.approveDeposit(deposit.id, remarks || 'Approved').subscribe({
                    next: () => {
                        this.toastService.showModal('Deposit has been approved successfully. The funds have been credited to the user\'s card.', 'DEPOSIT APPROVED', 'success');
                        this.fetchHistory();
                    },
                    error: (err) => {
                        console.error('Failed to approve deposit', err);
                        this.toastService.showModal(err.error?.error?.message || 'Failed to approve', 'Error', 'error');
                        this.isLoading = false;
                    }
                });
            }
        );
    }

    reject(deposit: any) {
        this.toastService.showConfirm(
            'Reject Deposit',
            `Are you sure you want to reject the deposit of ${deposit.amount} ${deposit.currency || 'USD'} for ${this.formatEmail(deposit.userName)}?`,
            (remarks) => {
                if (!remarks) {
                    this.toastService.showModal('Please provide a reason for rejection.', 'REASON REQUIRED', 'warning');
                    return;
                }
                this.isLoading = true;
                this.depositService.rejectDeposit(deposit.id, remarks).subscribe({
                    next: () => {
                        this.toastService.showModal('Deposit has been rejected.', 'DEPOSIT REJECTED', 'info');
                        this.fetchHistory();
                    },
                    error: (err) => {
                        console.error('Failed to reject deposit', err);
                        this.toastService.showModal(err.error?.error?.message || 'Failed to reject deposit.', 'ERROR', 'error');
                        this.isLoading = false;
                    }
                });
            }
        );
    }

    viewProof(deposit: any) {
        if (deposit.proofImage) {
            this.openImageInNewTab(deposit.proofImage);
            return;
        }

        if (deposit.hasProof) {
            this.isLoading = true;
            this.depositService.getProofImage(deposit.id).subscribe({
                next: (res: any) => {
                    deposit.proofImage = res.result;
                    this.isLoading = false;
                    this.openImageInNewTab(deposit.proofImage);
                    this.cdr.detectChanges();
                },
                error: (err) => {
                    console.error('Failed to load proof image', err);
                    this.toastService.showError('Failed to load image');
                    this.isLoading = false;
                    this.cdr.detectChanges();
                }
            });
        }
    }

    private openImageInNewTab(proofImage: string) {
        if (!proofImage) return;

        let url = proofImage;

        // 1. If it already has the data: prefix, it's a ready-to-use Data URI
        if (proofImage.startsWith('data:')) {
            url = proofImage;
        }
        // 2. If it looks like raw base64 (long string, no spaces/slashes, or common base64 chars)
        // A simple heuristic: if it's longer than 100 chars and doesn't contain common URL chars like / or .
        else if (proofImage.length > 100 && !proofImage.includes('/') && !proofImage.includes('.')) {
            url = `data:image/jpeg;base64,${proofImage}`;
        }
        // 3. Otherwise, assume it's a filename/path
        else {
            url = proofImage.startsWith('http') ? proofImage : `/assets/proofs/${proofImage}`;
        }

        // Open in new window with a simple container
        const win = window.open('', '_blank');
        if (win) {
            win.document.write(`
                <html>
                    <head>
                        <title>Proof of Deposit</title>
                        <style>
                            body { margin: 0; background: #1a1a1a; display: flex; justify-content: center; align-items: center; min-height: 100vh; font-family: sans-serif; }
                            .container { padding: 20px; background: white; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); max-width: 90%; }
                            img { max-width: 100%; border-radius: 4px; display: block; }
                            .header { margin-bottom: 15px; color: #333; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 10px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">Proof of Deposit</div>
                            <img src="${url}" alt="Deposit Proof" onerror="this.parentElement.innerHTML='<div style=\'color:red;padding:20px\'>Failed to load image. The data may be invalid or the path is incorrect.</div>'" />
                        </div>
                    </body>
                </html>
            `);
            win.document.close();
        }
    }
}
