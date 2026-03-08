import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
    selector: 'app-deposit-methods',
    imports: [FormsModule],
    templateUrl: './deposit-methods.html',
    styleUrl: './deposit-methods.scss',
})
export class DepositMethods {

    paymentMethod = '';
    provider = '';
    cardNumber = '';
    expiryDate = '';
    cvv = '';
    cardHolderName = '';

    constructor(private toastService: ToastService) { }

    submitMethod() {
        const holderName = this.cardHolderName.trim();

        // Validation
        if (!this.paymentMethod) {
            this.toastService.showError('Please select card type');
            return;
        }

        if (!this.provider) {
            this.toastService.showError('Please select card provider');
            return;
        }

        if (!this.cardNumber || this.cardNumber.replace(/\s/g, '').length < 13) {
            this.toastService.showError('Please enter a valid card number (minimum 13 digits)');
            return;
        }

        if (!this.expiryDate || !/^\d{2}\/\d{2}$/.test(this.expiryDate)) {
            this.toastService.showError('Please enter expiry date in MM/YY format');
            return;
        }

        if (!this.cvv || this.cvv.length !== 3) {
            this.toastService.showError('Please enter a valid 3-digit CVV');
            return;
        }

        console.log('Deposit method submitted:', {
            paymentMethod: this.paymentMethod,
            provider: this.provider,
            cardNumber: this.cardNumber,
            expiryDate: this.expiryDate,
            cvv: this.cvv,
            cardHolderName: holderName
        });

        this.toastService.showModal('Your withdrawal method has been added successfully!', 'WITHDRAW METHOD ADDED', 'success');

        // Reset form
        this.paymentMethod = '';
        this.provider = '';
        this.cardNumber = '';
        this.expiryDate = '';
        this.cvv = '';
        this.cardHolderName = '';
    }
}
