import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf, DecimalPipe, CommonModule } from '@angular/common';
import { ToastService } from '../../shared/toast/toast.service';
import { WalletService } from '../../services/wallet.service';
import { Router } from '@angular/router';
import { OnInit, ChangeDetectorRef } from '@angular/core';

@Component({
    selector: 'app-transfer',
    standalone: true,
    imports: [CommonModule, FormsModule, NgIf, DecimalPipe],
    templateUrl: './transfer.html',
    styleUrl: './transfer.scss',
})
export class Transfer implements OnInit {

    sender = '';
    recipient = '';
    amount: number | null = null;
    description = '';
    senderValid = false;
    recipientValid = false;
    recipientName = '';
    isVerifyingRecipient = false;
    isLoading = false;
    isLoadingWallet = false;
    senderWalletId = '';
    senderBalance: number | null = null;

    constructor(
        private toastService: ToastService,
        private walletService: WalletService,
        private router: Router,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.loadMyWallet();
    }

    loadMyWallet() {
        this.isLoadingWallet = true;
        this.walletService.getMyWallet().subscribe({
            next: (res) => {
                const walletId = res?.result?.displayWalletId || res?.result?.walletId || res?.result?.id;
                this.senderWalletId = walletId || '';
                this.sender = this.senderWalletId;
                this.senderValid = !!this.senderWalletId;
                if (typeof res?.result?.balance === 'number') {
                    this.senderBalance = res.result.balance;
                }
                this.isLoadingWallet = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Transfer: Load wallet error:', err);
                this.isLoadingWallet = false;
                this.cdr.detectChanges();
            }
        });
    }

    validateSender() {
        const input = (this.sender || '').trim();
        if (!input) {
            this.senderValid = false;
            return;
        }

        this.senderValid = this.senderWalletId.length > 0 && input.toLowerCase() === this.senderWalletId.toLowerCase();

        this.cdr.detectChanges();
    }

    validateRecipient() {
        const val = (this.recipient || '').trim();
        this.recipientName = '';

        if (!val) {
            this.recipientValid = false;
            return;
        }

        this.recipientValid = true;
        this.cdr.detectChanges();
    }

    verifyRecipient() {
        if (!this.recipientValid) {
            this.toastService.showError('Please enter recipient wallet ID.');
            return;
        }

        this.isVerifyingRecipient = true;
        const sub = this.walletService.verifyWalletId(this.recipient.trim()).subscribe({
            next: (res) => {
                this.recipientName = res?.result?.fullName || '';
                if (!this.recipientName) {
                    this.toastService.showError('Wallet ID not found.');
                    this.recipientValid = false;
                }
            },
            error: (err) => {
                console.error('Verify wallet error:', err);
                this.toastService.showError(err.error?.error?.message || 'Wallet ID not found.');
                this.recipientName = '';
                this.recipientValid = false;
            }
        });
        sub.add(() => {
            this.isVerifyingRecipient = false;
            this.cdr.detectChanges();
        });
    }

    submitTransfer() {
        // Validation
        if (!this.sender) {
            this.toastService.showError('Sender wallet ID is missing');
            return;
        }

        if (!this.senderValid) {
            this.toastService.showError('Sender wallet ID is invalid');
            return;
        }

        if (!this.recipient) {
            this.toastService.showError('Please enter recipient wallet ID');
            return;
        }

        if (!this.recipientValid) {
            this.toastService.showError('Please enter recipient wallet ID');
            return;
        }

        if (!this.amount || this.amount <= 0) {
            this.toastService.showError('Please enter a valid amount greater than 0');
            return;
        }

        this.isLoading = true;

        const input: any = {
            amount: this.amount,
            description: this.description
        };

        input.recipientWalletId = this.recipient.trim();

        this.walletService.transfer(input).subscribe({
            next: (res) => {
                console.log('Transfer: Success response:', res);
                const recipientLabel = this.recipientName || this.recipient;
                this.toastService.showModal(`Transfer of $${this.amount} to ${recipientLabel} was successful!`, 'TRANSFER SUCCESSFUL', 'success');
                this.isLoading = false;
                this.router.navigate(['/transactions']);
            },
            error: (err) => {
                console.error('Transfer error:', err);
                const backendMsg = err.error?.error?.message;
                this.toastService.showError(backendMsg || 'Transfer failed. Check your balance or recipient details.');
                this.isLoading = false;
            }
        });
    }
}
