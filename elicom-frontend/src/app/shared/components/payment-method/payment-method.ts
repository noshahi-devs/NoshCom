import { Component, Output, EventEmitter, inject, ChangeDetectorRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardService, CardValidationResultDto } from '../../../services/card.service';
import { resolvePlatformName } from '../../platform-context';

import Swal from 'sweetalert2';

@Component({
  selector: 'app-payment-method',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payment-method.html',
  styleUrl: './payment-method.scss',
})
export class PaymentMethod {
  private cardService = inject(CardService);
  private cdr = inject(ChangeDetectorRef);

  @Output() paymentConfirmed = new EventEmitter<{ method: string, details?: any }>();
  @Output() stepComplete = new EventEmitter<void>();
  @Input() totalAmount: number = 0;
  @Input() isProcessing: boolean = false;
  @Output() methodSelected = new EventEmitter<string>();

  selectedMethodId: string = 'mastercard'; // Default to MasterCard
  submitted: boolean = false;

  paymentMethods = [
    {
      id: 'mastercard', name: 'MasterCard', icon: 'assets/images/mastercard.png', color: '#eb001b',
      status: 'available', statusMsg: 'Pay securely using your MasterCard.',
      gradient: 'linear-gradient(135deg, #FF5722 0%, #F44336 100%)'
    },
    {
      id: 'discover', name: 'Discover', icon: 'assets/images/discover.jpg', color: '#ff6600',
      status: 'available', statusMsg: 'Pay securely using your Discover card.',
      gradient: 'linear-gradient(135deg, #FF9800 0%, #E65100 100%)'
    },
    {
      id: 'finora', name: 'Visa Card', icon: 'assets/images/easyfinora_logo.png', color: '#ffc107',
      status: 'recommended', statusMsg: 'Recommended! Instant & Zero-fee transactions.',
      gradient: 'linear-gradient(135deg, #FF8C00 0%, #FF4500 100%)'
    },
    {
      id: 'google_pay', name: 'Google Pay', icon: 'assets/images/google.png', color: '#4285F4',
      status: 'available', statusMsg: 'Google Pay mobile wallet.',
      gradient: 'linear-gradient(135deg, #00BCD4 0%, #0097A7 100%)'
    },
    {
      id: 'amex', name: 'American Express', icon: 'assets/images/american-express.png', color: '#007bc1',
      status: 'available', statusMsg: 'Pay securely with Amex.',
      gradient: 'linear-gradient(135deg, #03A9F4 0%, #0288D1 100%)'
    },
    {
      id: 'bank', name: 'Bank Transfer', icon: 'assets/images/bankofamerica.png', color: '#004a99',
      status: 'available', statusMsg: 'Direct secure bank transfer.',
      gradient: 'linear-gradient(135deg, #1A237E 0%, #0D47A1 100%)'
    },
  ];

  isDropdownOpen = false;

  /* CARD FIELDS */

  card = {
    number: '', // stored with spaces
    expiry: '',
    cvv: '',
    holder: ''
  };

  cardErrors = {
    number: false,
    expiry: false,
    cvv: false
  };

  /* Verification State */
  isVerifying: boolean = false;
  verificationMessage: string | null = null;
  isVerified: boolean = false;

  get selectedMethod() {
    return this.paymentMethods.find(m => m.id === this.selectedMethodId) || this.paymentMethods[0];
  }

  get isActive() {
    return this.selectedMethod.status === 'available' || this.selectedMethod.status === 'recommended';
  }

  onMethodChange(methodId: string) {
    console.log('[PaymentMethod] 💳 Selected Payment Method:', methodId);
    
    // Smooth reset for animation
    const prevId = this.selectedMethodId;
    this.selectedMethodId = ''; 
    this.cdr.detectChanges();

    setTimeout(() => {
      this.selectedMethodId = methodId;
      this.resetCardForm();
      this.resetVerification();
      this.submitted = false;
      this.cdr.detectChanges();
    }, 40);
  }


  /* ================= CARD INPUT HANDLERS ================= */

  formatCardNumber(e: Event) {
    const input = e.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 16);
    const parts = digits.match(/.{1,4}/g);
    const formatted = parts ? parts.join(' ') : digits;

    this.card.number = formatted;
    input.value = formatted;
    this.cardErrors.number = false;
    this.resetVerification();
  }

  formatExpiry(e: Event) {
    const input = e.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    if (value.length > 4) value = value.substring(0, 4);

    if (value.length >= 2) {
      const month = parseInt(value.substring(0, 2));
      if (month > 12) value = '12' + value.substring(2);
      if (month === 0) value = '01' + value.substring(2);
      value = value.substring(0, 2) + '/' + value.substring(2);
    }

    this.card.expiry = value;
    this.cardErrors.expiry = false;
    this.resetVerification();
  }

  formatCVV(e: Event) {
    const input = e.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    if (value.length > 3) value = value.substring(0, 3);
    this.card.cvv = value;
    this.cardErrors.cvv = false;
    this.resetVerification();
  }

  private resetVerification() {
    this.isVerified = false;
    this.verificationMessage = null;
  }

  private getRawCardNumber(): string {
    return this.card.number.replace(/\s/g, '');
  }

  private isValidCardNumberLength(): boolean {
    return /^\d{16}$/.test(this.getRawCardNumber());
  }

  private hasValidCardFields(): boolean {
    return this.isValidCardNumberLength()
      && this.card.expiry.length === 5
      && this.card.cvv.length === 3;
  }

  /* ================= SAVE LOGIC ================= */

  saveCard() {
    this.submitted = true;
    let isValid = true;

    // Force Visa Card validation using SweetAlert2
    if (this.selectedMethodId !== 'finora') {
      Swal.fire({
        title: 'CHANNEL BUSY',
        html: 'This payment channel is currently busy. For <b>instant & safe</b> processing, please use <b>Visa Card</b>.',
        icon: 'warning',
        confirmButtonText: 'USE Visa Card',
        background: '#111',
        color: '#ffc107',
        confirmButtonColor: '#ffc107',
        customClass: {
          confirmButton: 'nosh-swal-btn'
        }
      }).then((result) => {
        if (result.isConfirmed) {
          this.onMethodChange('finora');
        }
      });
      return;
    }

    // Standard card validation for Visa Card (ID: finora)
    if (!this.isValidCardNumberLength()) {
      this.cardErrors.number = true;
      isValid = false;
    }

    if (this.card.expiry.length !== 5) {
      this.cardErrors.expiry = true;
      isValid = false;
    }

    if (this.card.cvv.length !== 3) {
      this.cardErrors.cvv = true;
      isValid = false;
    }

    if (!this.isVerified) {
      this.verificationMessage = 'Please verify your card before confirming the order.';
      isValid = false;
    }

    if (!isValid) {
      this.cdr.detectChanges();
      return;
    }
    this.confirmPayment();
  }

  resetCardForm() {
    this.card = { number: '', expiry: '', cvv: '', holder: '' };
    this.cardErrors = { number: false, expiry: false, cvv: false };
    this.resetVerification();
  }

  // Removed onLoginSuccess()

  verifyFinora() {
    this.submitted = false;
    this.verificationMessage = null;

    if (!this.hasValidCardFields()) {
      this.submitted = true;
      this.cardErrors.number = !this.isValidCardNumberLength();
      this.cardErrors.expiry = this.card.expiry.length !== 5;
      this.cardErrors.cvv = this.card.cvv.length !== 3;
      this.verificationMessage = !this.isValidCardNumberLength()
        ? 'Card number must be exactly 16 digits.'
        : 'Please enter valid card number, expiry date, and CVV first.';
      this.cdr.detectChanges();
      return;
    }

    this.isVerifying = true;
    this.isVerified = false;
    this.verificationMessage = null;

    const rawNum = this.getRawCardNumber();
    const input = {
      cardNumber: rawNum,
      expiryDate: this.card.expiry,
      cvv: this.card.cvv,
      amount: 0,
      sourcePlatform: resolvePlatformName() || 'Elicom'
    };

    this.cardService.validateCard(input).subscribe({
      next: (res: CardValidationResultDto) => {
        this.isVerifying = false;
        if (res.isValid) {
          this.isVerified = true;
          this.verificationMessage = null;
        } else {
          this.verificationMessage = res.message || 'Card verification failed. Please check your details.';
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.isVerifying = false;
        this.verificationMessage = 'Connection error. Try again.';
        this.cdr.detectChanges();
      }
    });
  }

  confirmPayment() {
    this.paymentConfirmed.emit({
      method: this.selectedMethodId,
      details: this.card
    });
    this.stepComplete.emit();
  }



}
