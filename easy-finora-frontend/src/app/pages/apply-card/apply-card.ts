import { Component, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { Router } from '@angular/router';
import { ToastService } from '../../shared/toast/toast.service';
import { CardService } from '../../services/card.service';
import { firstValueFrom } from 'rxjs';

@Component({
    selector: 'app-apply-card',
    imports: [FormsModule, NgIf],
    templateUrl: './apply-card.html',
    styleUrl: './apply-card.scss',
})
export class ApplyCard {

    fullName = '';
    contact = '';
    address = '';
    cardType = 'virtual';
    cardBrand = 'Visa'; // Default to Visa for virtual
    documentFile: File | null = null;
    isLoading = false;

    constructor(
        private toastService: ToastService,
        private cardService: CardService,
        private router: Router,
        private cdr: ChangeDetectorRef
    ) { }

    onFileSelected(event: any) {
        const file = event.target.files[0];
        if (file) {
            this.documentFile = file;
        }
    }

    async submitApplication() {
        // Validation
        if (!this.fullName || this.fullName.trim().length < 3) {
            this.toastService.showError('Please enter a valid full name (minimum 3 characters)');
            return;
        }

        if (!this.contact || this.contact.trim().length < 10) {
            this.toastService.showError('Please enter a valid contact number (minimum 10 digits)');
            return;
        }

        if (!this.address || this.address.trim().length < 10) {
            this.toastService.showError('Please enter a valid address (minimum 10 characters)');
            return;
        }

        if (!this.documentFile) {
            this.toastService.showError('Please upload a government issued document');
            return;
        }

        // Check file size (max 5MB)
        if (this.documentFile.size > 5 * 1024 * 1024) {
            this.toastService.showError('File size must be less than 5MB');
            return;
        }

        if (this.cardType === 'physical') {
            this.toastService.showError('Physical cards are currently out of stock. Please apply for a Virtual Card.');
            return;
        }

        // Warn if user already has an active card
        try {
            const cardsResponse: any = await firstValueFrom(this.cardService.getUserCards());
            const cards = cardsResponse?.result ?? cardsResponse?.items ?? cardsResponse ?? [];
            const hasActiveCard = Array.isArray(cards) && cards.some((c: any) => (c?.status ?? c?.Status) === 'Active');
            if (hasActiveCard) {
                this.toastService.showWarning(
                    'You already have an active card. It will be set to inactive while this application is reviewed. If approved, the previous card will be deleted. If rejected, it will become active again.',
                    'Active Card Notice'
                );
            }
        } catch (error) {
            // Ignore card lookup errors and continue submission
        }

        this.isLoading = true;
        this.cdr.detectChanges();

        try {
            const base64Document = await this.convertToBase64(this.documentFile);

            const payload = {
                fullName: this.fullName,
                contactNumber: this.contact,
                address: this.address,
                cardType: this.cardBrand,
                documentBase64: base64Document
            };

            console.log('ApplyCard: Submit Payload:', { ...payload, documentBase64: '[REDACTED]' });

            this.cardService.submitCardApplication(payload).subscribe({
                next: (response) => {
                    console.log('ApplyCard: Submit Response:', response);
                    this.toastService.showModal('Your card application has been submitted successfully! Please wait for admin approval.', 'APPLICATION SUBMITTED', 'success');

                    // Reset form
                    this.resetForm();
                    this.cdr.detectChanges(); // Ensure UI state is pushed

                    // Redirect to dashboard or application status page
                    this.router.navigate(['/dashboard']);
                },
                error: (err) => {
                    console.error('ApplyCard: Submit Error:', err);
                    this.toastService.showError(err.error?.error?.message || 'Failed to submit application. Please try again.');
                    this.isLoading = false;
                    this.cdr.detectChanges();
                },
                complete: () => {
                    this.isLoading = false;
                    this.cdr.detectChanges();
                }
            });
        } catch (error) {
            this.toastService.showError('Error processing document file.');
            this.isLoading = false;
            this.cdr.detectChanges();
        }
    }

    private convertToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    }

    resetForm() {
        this.fullName = '';
        this.contact = '';
        this.address = '';
        this.cardType = 'virtual';
        this.cardBrand = 'Visa';
        this.documentFile = null;
        this.isLoading = false;
    }
}
