import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../shared/toast/toast.service';
import { SupportService } from '../../services/support.service';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-contact',
    standalone: true,
    imports: [FormsModule, CommonModule],
    templateUrl: './contact.html',
    styleUrl: './contact.scss',
})
export class Contact {

    name = '';
    email = '';
    subject = '';
    message = '';
    isLoading = false;

    constructor(
        private toastService: ToastService,
        private supportService: SupportService
    ) { }

    submitContact() {
        // Validation
        if (!this.name || this.name.trim().length < 3) {
            this.toastService.showError('Please enter your name (minimum 3 characters)');
            return;
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!this.email || !emailPattern.test(this.email)) {
            this.toastService.showError('Please enter a valid email address');
            return;
        }

        if (!this.subject || this.subject.trim().length < 5) {
            this.toastService.showError('Please enter a subject (minimum 5 characters)');
            return;
        }

        if (!this.message || this.message.trim().length < 10) {
            this.toastService.showError('Please enter a message (minimum 10 characters)');
            return;
        }

        this.isLoading = true;
        const input = {
            title: this.subject,
            message: this.message,
            contactEmail: this.email,
            contactName: this.name,
            priority: 'Medium'
        };

        this.supportService.createTicket(input).subscribe({
            next: () => {
                this.toastService.showModal('Your message has been sent successfully! Our team will review it and get back to you soon.', 'MESSAGE SENT', 'success');
                this.isLoading = false;
                // Reset form
                this.name = '';
                this.email = '';
                this.subject = '';
                this.message = '';
            },
            error: (err) => {
                console.error('Contact error:', err);
                this.toastService.showError('Failed to send message. Please try again later.');
                this.isLoading = false;
            }
        });
    }
}
