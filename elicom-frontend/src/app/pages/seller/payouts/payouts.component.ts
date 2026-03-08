import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

interface PayoutMethod {
    type: 'bank' | 'third_party';
    bankName?: string;
    routingNumber?: string;
    accountNumber?: string;
    accountType?: 'savings' | 'checking';
    accountName?: string;
    walletId?: string; // e.g. PayPal email
}

@Component({
    selector: 'app-payouts',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule],
    templateUrl: './payouts.component.html',
    styleUrls: ['./payouts.component.scss']
})
export class PayoutsComponent implements OnInit {
    payoutMethod: PayoutMethod = {
        type: 'bank',
        bankName: 'Chase Bank',
        routingNumber: '123456789',
        accountNumber: '********5542',
        accountType: 'checking',
        accountName: 'Arslan Noshahi'
    };

    withdrawAmount: number = 0;
    availableBalance: number = 1120.30; // Mocked from Wallet center
    withdrawalHistory = [
        { id: 'WTH-552', amount: 500.00, status: 'pending', date: new Date('2026-01-30') },
        { id: 'WTH-548', amount: 350.00, status: 'approved', date: new Date('2026-01-15') },
        { id: 'WTH-540', amount: 200.00, status: 'approved', date: new Date('2026-01-01') }
    ];

    isSettingUpMethod = false;

    ngOnInit() { }

    requestWithdrawal() {
        if (this.withdrawAmount <= 0) {
            alert('Please enter a valid amount.');
            return;
        }
        if (this.withdrawAmount > this.availableBalance) {
            alert('Insufficient funds.');
            return;
        }

        alert(`Withdrawal request for ${this.withdrawAmount} sent successfully. Status: Pending Admin Approval.`);
        this.withdrawalHistory.unshift({
            id: `WTH-${Math.floor(Math.random() * 1000)}`,
            amount: this.withdrawAmount,
            status: 'pending',
            date: new Date()
        });
        this.withdrawAmount = 0;
    }

    savePayoutMethod() {
        this.isSettingUpMethod = false;
        alert('Payout method updated successfully.');
    }
}
