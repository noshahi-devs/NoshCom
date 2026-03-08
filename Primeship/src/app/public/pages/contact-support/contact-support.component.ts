import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-contact-support',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './contact-support.html',
  styleUrl: './contact-support.css',
})
export class ContactSupportComponent {
  constructor(private toastService: ToastService) { }

  submitSupport(name: string, email: string, subject: string, message: string) {
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      this.toastService.showError('Please fill in your name, email, and message.');
      return;
    }

    if (!email.includes('@')) {
      this.toastService.showError('Please enter a valid email address.');
      return;
    }

    this.toastService.showSuccess('Message sent! Our team will respond within 24 hours.');
  }
}
