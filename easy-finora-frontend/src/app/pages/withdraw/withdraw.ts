import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf, NgFor, CurrencyPipe, CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ToastService } from '../../shared/toast/toast.service';
import { WithdrawService } from '../../services/withdraw.service';
import { CardService } from '../../services/card.service';
import { WalletService } from '../../services/wallet.service';

@Component({
    selector: 'app-withdraw',
    imports: [FormsModule, CommonModule],
    templateUrl: './withdraw.html',
    styleUrl: './withdraw.scss',
})
export class Withdraw implements OnInit {

    amount: number | null = null;
    isLoading = false;
    walletBalance: number | null = null;
    withdrawMethod: 'bank' | 'crypto' = 'bank';
    exchangeRates: any = {};
    cards: any[] = [];
    selectedCardId: number | null = null;

    // Editable bank account details
    bankDetails = {
        bankName: '',
        accountTitle: '',
        accountNumber: '',
        iban: ''
    };

    // Crypto details
    cryptoDetails = {
        cryptoId: '',
        cryptoTitle: ''
    };

    constructor(
        private toastService: ToastService,
        private withdrawService: WithdrawService,
        private walletService: WalletService,
        private cardService: CardService,
        private router: Router,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.loadWalletBalance();
        this.loadUserCards();
        this.fetchExchangeRates();
    }

    loadUserCards() {
        this.cardService.getUserCards().subscribe({
            next: (res) => {
                // API returns { result: [card1, card2] } not { result: { items: [...] } }
                this.cards = res?.result || [];

                // Map cardId to id for easier usage in the template if needed, 
                // but better to just use cardId consistently.
                this.cards.forEach(c => {
                    if (!c.id && c.cardId) c.id = c.cardId;
                });

                if (this.cards.length > 0) {
                    this.selectedCardId = this.cards[0].id || this.cards[0].cardId;
                }
                this.cdr.detectChanges();
            },
            error: (err) => console.error('Withdraw: Load Cards Error:', err)
        });
    }

    fetchExchangeRates() {
        fetch('https://open.er-api.com/v6/latest/USD')
            .then(res => res.json())
            .then(data => {
                this.exchangeRates = data.rates;
                this.cdr.detectChanges();
            })
            .catch(err => console.error('Withdraw: Fetch Rates Error:', err));
    }

    loadWalletBalance() {
        this.walletService.getMyWallet().subscribe({
            next: (res) => {
                const balance = res?.result?.balance;
                if (typeof balance === 'number') {
                    this.walletBalance = balance;
                }
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Withdraw: Wallet Balance Error:', err);
            }
        });
    }

    getWalletBalanceDisplay(cardBalance: number): number {
        return typeof this.walletBalance === 'number' ? this.walletBalance : cardBalance;
    }

    submitWithdraw() {
        // Validation
        if (!this.amount || this.amount <= 0) {
            this.toastService.showError('Please enter a valid amount greater than 0');
            return;
        }

        if (this.amount < 10) {
            this.toastService.showError('Minimum withdrawal amount is $10');
            return;
        }

        if (this.withdrawMethod === 'bank') {
            if (!this.bankDetails.bankName || !this.bankDetails.accountNumber) {
                this.toastService.showError('Please provide bank name and account number');
                return;
            }
        }

        if (this.withdrawMethod === 'crypto') {
            if (!this.cryptoDetails.cryptoId || !this.cryptoDetails.cryptoTitle) {
                this.toastService.showError('Please provide crypto ID and crypto title');
                return;
            }
        }

        if (!this.selectedCardId) {
            this.toastService.showError('Please select a card to receive funds');
            return;
        }

        this.isLoading = true;
        this.cdr.detectChanges();

        const paymentDetails = this.withdrawMethod === 'bank'
            ? `Bank: ${this.bankDetails.bankName}, Title: ${this.bankDetails.accountTitle}, Acc: ${this.bankDetails.accountNumber}, IBAN: ${this.bankDetails.iban}`
            : `CryptoId: ${this.cryptoDetails.cryptoId}, CryptoTitle: ${this.cryptoDetails.cryptoTitle}`;

        const input = {
            cardId: this.selectedCardId,
            amount: this.amount,
            method: this.withdrawMethod === 'bank' ? 'Bank Transfer' : 'Crypto',
            paymentDetails: paymentDetails,
            localAmount: this.calculateLocalAmount(),
            localCurrency: 'PKR' // Defaulting to PKR for user's request context
        };

        console.log('Withdraw: Submit Payload:', input);

        this.withdrawService.submitWithdrawRequest(input).subscribe({
            next: (res) => {
                console.log('Withdraw: Submit Response:', res);
                this.toastService.showModal(`Your withdrawal request for $${input.amount} has been submitted successfully. Our team will process it shortly.`, 'WITHDRAWAL SUBMITTED', 'success');
                this.resetForm();
                this.router.navigate(['/withdraw-history']);
            },
            error: (err) => {
                console.error('Withdraw: Submit Error:', err);
                this.toastService.showError(err.error?.error?.message || 'Failed to submit withdrawal request');
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    calculateLocalAmount(): number {
        const rate = this.exchangeRates['PKR'] || 280; // Fallback to 280 if fetch fails
        return Math.round((this.getNetAmount() || 0) * rate);
    }

    getServiceFee(): number {
        if (!this.amount) return 0;
        return Number((this.amount * 0.03).toFixed(2));
    }

    getNetAmount(): number {
        if (!this.amount) return 0;
        return Number((this.amount - this.getServiceFee()).toFixed(2));
    }

    resetForm() {
        this.amount = null;
        this.bankDetails = {
            bankName: '',
            accountTitle: '',
            accountNumber: '',
            iban: ''
        };
        this.isLoading = false;
    }
}
