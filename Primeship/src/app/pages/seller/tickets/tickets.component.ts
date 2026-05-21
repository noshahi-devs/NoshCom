import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupportService } from '../../../core/services/support.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-seller-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './tickets.component.html',
  styleUrl: './tickets.component.scss'
})
export class SellerTicketsComponent implements OnInit {
  isCreating = false;
  isLoading = false;

  newTicket = {
    title: '',
    priority: 'Medium',
    message: ''
  };

  tickets: any[] = [];

  constructor(
    private supportService: SupportService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.fetchTickets();
  }

  fetchTickets(): void {
    this.isLoading = true;
    this.supportService.getMyTickets().subscribe({
      next: (res: any) => {
        this.tickets = res?.result?.items ?? [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to fetch tickets', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  toggleCreate(): void {
    this.isCreating = !this.isCreating;
  }

  submitTicket(): void {
    if (!this.newTicket.title || !this.newTicket.message) {
      Swal.fire('Error', 'Please fill in all fields', 'error');
      return;
    }

    const payload = {
      title: this.newTicket.title,
      message: this.newTicket.message,
      priority: this.newTicket.priority
    };

    this.isLoading = true;
    this.supportService.createTicket(payload).subscribe({
      next: () => {
        Swal.fire('Success', 'Your support ticket has been created successfully!', 'success');
        this.isCreating = false;
        this.newTicket = { title: '', priority: 'Medium', message: '' };
        this.fetchTickets();
      },
      error: (err) => {
        console.error('Failed to create ticket', err);
        Swal.fire('Error', 'Failed to create support ticket. Please try again.', 'error');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  hasAdminReply(ticket: any): boolean {
    return !!(ticket?.adminRemarks ?? '').toString().trim();
  }

  viewAdminReply(ticket: any): void {
    const remarks = (ticket?.adminRemarks ?? '').toString().trim();
    if (!remarks) return;

    const title = this.escapeHtml(ticket?.title || 'Support Ticket');
    const body = this.escapeHtml(remarks).replace(/\n/g, '<br>');

    void Swal.fire({
      title: 'Admin Reply',
      html: `
        <p class="swal-ticket-subject">Ticket: <strong>${title}</strong></p>
        <div class="swal-ticket-reply">${body}</div>
      `,
      icon: 'info',
      confirmButtonText: 'OK',
      confirmButtonColor: '#10b981',
      showCloseButton: true,
      width: 520,
      customClass: {
        popup: 'swal-ticket-reply-popup',
        confirmButton: 'swal-ticket-ok-btn'
      }
    });
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
