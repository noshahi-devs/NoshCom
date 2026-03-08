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
        { label: 'Chase Bank', value: 'Chase Bank' },
        { label: 'Bank of America', value: 'Bank of America' },
        { label: 'Wells Fargo', value: 'Wells Fargo' },
        { label: 'Citibank', value: 'Citibank' },
        { label: 'Capital One', value: 'Capital One' }
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
