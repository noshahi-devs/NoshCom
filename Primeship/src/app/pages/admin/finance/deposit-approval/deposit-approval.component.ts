import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe, CurrencyPipe } from '@angular/common';
import { DepositService } from '../../../../core/services/deposit.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
    selector: 'app-deposit-approval',
    standalone: true,
    imports: [CommonModule, DatePipe, CurrencyPipe],
    templateUrl: './deposit-approval.component.html',
    styleUrl: './deposit-approval.component.scss',
})
export class DepositApprovalComponent implements OnInit {

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

        this.depositService.getAllDepositRequests(0, 1000).subscribe({
            next: (res: any) => {
                this.deposits = res?.result?.items ?? [];
                this.totalCount = res?.result?.totalCount ?? 0;
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('DepositApproval: Failed to load requests', err);
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
        return email.replace('GP_', '');
    }

    approve(deposit: any) {
        const remarks = prompt('Enter Approval Remarks (Optional):', 'Approved');
        if (remarks === null) return;

        this.isLoading = true;
        this.depositService.approveDeposit(deposit.id, remarks).subscribe({
            next: () => {
                this.toastService.showSuccess('Deposit approved successfully.');
                this.fetchHistory();
            },
            error: (err) => {
                this.toastService.showError(err.error?.error?.message || 'Failed to approve');
                this.isLoading = false;
            }
        });
    }

    reject(deposit: any) {
        const remarks = prompt('Enter Reason for Rejection (Required):');
        if (!remarks) {
            if (remarks === '') this.toastService.showError('Rejection reason is required.');
            return;
        }

        this.isLoading = true;
        this.depositService.rejectDeposit(deposit.id, remarks).subscribe({
            next: () => {
                this.toastService.showSuccess('Deposit rejected.');
                this.fetchHistory();
            },
            error: (err) => {
                this.toastService.showError(err.error?.error?.message || 'Failed to reject');
                this.isLoading = false;
            }
        });
    }

    viewProof(deposit: any) {
        if (deposit.proofImage) {
            this.openImageInNewTab(deposit.proofImage);
            return;
        }

        this.isLoading = true;
        this.depositService.getProofImage(deposit.id).subscribe({
            next: (res: any) => {
                deposit.proofImage = res.result;
                this.isLoading = false;
                this.openImageInNewTab(deposit.proofImage);
                this.cdr.detectChanges();
            },
            error: (err) => {
                this.toastService.showError('Failed to load image');
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
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
                            <img src="${url}" alt="Deposit Proof" />
                        </div>
                    </body>
                </html>
            `);
            win.document.close();
        }
    }
}
