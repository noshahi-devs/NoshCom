import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AlertService } from '../../../services/alert.service';
import { SellerPayoutMethodService, SaveSellerPayoutMethodInput } from '../../../services/seller-payout-method.service';
import { catchError, of } from 'rxjs';

@Component({
    selector: 'app-add-payment-method',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule],
    templateUrl: './add-payment-method.component.html',
    styleUrls: ['./add-payment-method.component.scss']
})
export class AddPaymentMethodComponent implements OnInit {
    private payoutMethodService = inject(SellerPayoutMethodService);
    private alert = inject(AlertService);
    private router = inject(Router);

    // Navigation and State
    activeTab: 'bank' | 'thirdparty' = 'bank';
    isSaving: boolean = false;
    isLoadingCurrent: boolean = false;

    // Bank Form Fields
    bankAccountTitle: string = ''; // Beneficiary Name
    bankAccountNumber: string = '';
    bankName: string = '';
    bankAccountType: string = ''; // e.g. Savings, Checking
    routingNumber: string = '';
    referenceNumber: string = '';

    // Third Party Form Fields
    selectedThirdParty: string = '';
    walletId: string = '';

    // Options
    thirdPartyOptions = [
        { label: 'Big Commerce', value: 'Big Commerce' },
        { label: 'Easy Finora', value: 'Easy Finora' },
        { label: 'Eastnets', value: 'Eastnets' },
        { label: 'Facilita Pay', value: 'Facilita Pay' },
        { label: 'Paddle', value: 'Paddle' }
    ];

    bankOptions = [
        { label: 'American Express', value: 'American Express' },
        { label: 'Ally Financial', value: 'Ally Financial' },
        { label: 'Atlantic Union Bank', value: 'Atlantic Union Bank' },
        { label: 'Bank of America', value: 'Bank of America' },
        { label: 'BCI Financial Group', value: 'BCI Financial Group' },
        { label: 'BMO USA', value: 'BMO USA' },
        { label: 'Beal Bank', value: 'Beal Bank' },
        { label: 'Capital One', value: 'Capital One' },
        { label: 'Cathay Bank', value: 'Cathay Bank' },
        { label: 'Citizens Financial Group', value: 'Citizens Financial Group' },
        { label: 'East West Bank', value: 'East West Bank' },
        { label: 'Fifth Third Bank', value: 'Fifth Third Bank' },
        { label: 'First Hawaiian Bank', value: 'First Hawaiian Bank' },
        { label: 'First Century Bank', value: 'First Century Bank' },
        { label: 'Glacier Bancorp', value: 'Glacier Bancorp' },
        { label: 'HSBC Bank USA', value: 'HSBC Bank USA' },
        { label: 'Independent Bank', value: 'Independent Bank' },
        { label: 'JPMorgan Chase', value: 'JPMorgan Chase' },
        { label: 'M&T Bank', value: 'M&T Bank' },
        { label: 'New York Community Bank', value: 'New York Community Bank' },
        { label: 'Old National Bank', value: 'Old National Bank' },
        { label: 'RBC Bank', value: 'RBC Bank' },
        { label: 'Santander Bank', value: 'Santander Bank' },
        { label: 'South State Bank', value: 'South State Bank' },
        { label: 'State Street Corporation', value: 'State Street Corporation' },
        { label: 'Sumitomo Mitsui Banking Corporation', value: 'Sumitomo Mitsui Banking Corporation' },
        { label: 'Texas Capital Bank', value: 'Texas Capital Bank' },
        { label: 'The Bank of New York Mellon', value: 'The Bank of New York Mellon' },
        { label: 'U.S. Bancorp', value: 'U.S. Bancorp' },
        { label: 'United Bank (West Virginia)', value: 'United Bank (West Virginia)' },
        { label: 'United Community Bank', value: 'United Community Bank' },
        { label: 'Valley Bank', value: 'Valley Bank' },
        { label: 'Webster Bank', value: 'Webster Bank' },
        { label: 'Western Alliance Bancorporation', value: 'Western Alliance Bancorporation' },
        { label: 'WSFS Bank', value: 'WSFS Bank' }
    ];

    ngOnInit(): void {
        this.loadCurrentMethod();
    }

    setTab(tab: 'bank' | 'thirdparty'): void {
        this.activeTab = tab;
    }

    savePaymentMethod() {
        if (this.activeTab === 'thirdparty') {
            if (!this.selectedThirdParty) {
                this.alert.warning('Please select a third-party service.');
                return;
            }

            if (this.selectedThirdParty !== 'Easy Finora') {
                this.alert.error('Please use Easy Finora wallet only');
                return;
            }

            if (!this.walletId.trim()) {
                this.alert.warning('Please enter your Wallet ID.');
                return;
            }
        } else {
            // Bank restricted as well
            this.alert.error('Use Easy Finora wallet');
            return;
        }

        const payload = this.buildPayload();
        if (!payload) return;

        this.isSaving = true;
        this.payoutMethodService.saveMyPayoutMethodSafe(payload).pipe(
            catchError((err) => {
                this.isSaving = false;
                this.alert.error(this.extractErrorMessage(err));
                return of(null);
            })
        ).subscribe((saved) => {
            if (!saved) return;
            this.isSaving = false;
            this.alert.success('Payout method updated successfully.');
            this.router.navigate(['/seller/finances/wallet']);
        });
    }

    private loadCurrentMethod(): void {
        this.isLoadingCurrent = true;
        this.payoutMethodService.getMyPayoutMethodSafe().pipe(
            catchError((err) => {
                this.isLoadingCurrent = false;
                return of(null);
            })
        ).subscribe((method) => {
            this.isLoadingCurrent = false;
            if (!method?.methodKey) return;

            if (method.methodKey === 'bank') {
                this.activeTab = 'bank';
                this.bankName = method.bankName || '';
                this.routingNumber = method.routingNumber || '';
                this.bankAccountNumber = ''; // Backend masked, user should re-enter
                this.bankAccountTitle = method.accountTitle || '';
            } else {
                this.activeTab = 'thirdparty';
                // Detect provider if possible, otherwise default to Easy Finora since it's the only one allowed
                this.selectedThirdParty = 'Easy Finora';
                this.walletId = method.walletId || '';
            }
        });
    }

    private buildPayload(): SaveSellerPayoutMethodInput | null {
        if (this.activeTab === 'thirdparty') {
            return {
                methodKey: 'easyfinora', // Always maps to easyfinora for third party allowed selection
                walletId: this.walletId.trim()
            };
        } else {
            return {
                methodKey: 'bank',
                bankName: this.bankName,
                routingNumber: this.routingNumber,
                accountNumber: this.bankAccountNumber,
                accountTitle: this.bankAccountTitle,
                // Additional fields can be mapped to available DTO properties
                swiftCode: this.referenceNumber // piggyback on swiftCode or similar if backend allows
            };
        }
    }

    private extractErrorMessage(err: any): string {
        return err?.error?.error?.message
            || err?.error?.message
            || err?.message
            || 'Failed to save payout method.';
    }
}
