import { Component, Output, EventEmitter, inject, ChangeDetectorRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardService, CardValidationResultDto } from '../../../services/card.service';
import { resolvePlatformName } from '../../platform-context';

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
  @Output() methodSelected = new EventEmitter<string>();

  selectedMethodId: string = 'finora'; // Default to Easy Finora
  submitted: boolean = false;

  paymentMethods = [
    {
      id: 'finora', name: 'Easy Finora Card', icon: 'assets/images/easyfinora_logo.png', color: '#000000',
      status: 'recommended', statusMsg: 'Best Choice! Official Partner for instant & safe transactions.'
    },
    {
      id: 'card', name: 'Credit/Debit Card', icon: 'assets/images/mastercard.png', color: '#eb001b',
      status: 'available', statusMsg: 'Pay securely using your Credit or Debit card.'
    },
    {
      id: 'paypal', name: 'PayPal', icon: 'assets/images/paypal.png', color: '#003087',
      status: 'maintenance', statusMsg: 'Currently under maintenance. We are working to restore it soon.'
    },
    {
      id: 'google_pay', name: 'Google Pay', icon: 'assets/images/google.png', color: '#4285F4',
      status: 'soon', statusMsg: 'Coming Soon - We are currently integrating Google Pay for you.'
    },
    {
      id: 'bank', name: 'Bank Transfer', icon: 'assets/images/bankofamerica.png', color: '#004a99',
      status: 'unavailable', statusMsg: 'Bank Transfer is currently not supported in your region.'
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
  verifiedBalance: number | null = null;
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
    this.selectedMethodId = methodId;
    this.isDropdownOpen = false; // Close custom dropdown
    this.resetCardForm();
    this.isVerified = false;
    this.verifiedBalance = null;
    this.verificationMessage = null;
    this.submitted = false;
  }


  /* ================= CARD INPUT HANDLERS ================= */

  formatCardNumber(e: Event) {
    const input = e.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    if (value.length > 16) value = value.substring(0, 16);
    const parts = value.match(/.{1,4}/g);
    this.card.number = parts ? parts.join(' ') : value;
    this.cardErrors.number = false;
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
  }

  formatCVV(e: Event) {
    const input = e.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    if (value.length > 3) value = value.substring(0, 3);
    this.card.cvv = value;
    this.cardErrors.cvv = false;
  }

  /* ================= SAVE LOGIC ================= */

  saveCard() {
    this.submitted = true;
    let isValid = true;

    // Only validate card details if it's a card-based method
    const cardMethods = ['card', 'finora', 'primeship'];
    if (cardMethods.includes(this.selectedMethodId)) {
      const rawNum = this.card.number.replace(/\s/g, '');
      if (rawNum.length !== 16) {
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

      if (this.selectedMethodId === 'finora' && !this.isVerified) {
        isValid = false;
      }
    }

    if (!isValid) return;
    this.confirmPayment();
  }

  resetCardForm() {
    this.card = { number: '', expiry: '', cvv: '', holder: '' };
    this.cardErrors = { number: false, expiry: false, cvv: false };
  }

  // Removed onLoginSuccess()

  verifyFinora() {
    const rawNum = this.card.number.replace(/\s/g, '');
    if (rawNum.length !== 16 || this.card.expiry.length !== 5 || this.card.cvv.length !== 3) {
      this.verificationMessage = "Please enter valid card details first.";
      return;
    }

    this.isVerifying = true;
    this.verificationMessage = null;

    const input = {
      cardNumber: rawNum,
      expiryDate: this.card.expiry,
      cvv: this.card.cvv,
      amount: this.totalAmount || 0,
      sourcePlatform: resolvePlatformName()
    };

    this.cardService.validateCard(input).subscribe({
      next: (res: CardValidationResultDto) => {
        console.log('[PaymentMethod] 🔍 verifyFinora Result:', res);
        this.isVerifying = false;
        if (res.isValid) {
          this.isVerified = true;
          this.verifiedBalance = res.availableBalance;
        } else {
          this.verificationMessage = res.message;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isVerifying = false;
        this.verificationMessage = "Connection error. Try again.";
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
