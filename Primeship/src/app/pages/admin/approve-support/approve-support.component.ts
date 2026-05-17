import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe, SlicePipe } from '@angular/common';
import { SupportService } from '../../../core/services/support.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-approve-support',
  standalone: true,
  imports: [CommonModule, DatePipe, SlicePipe],
  templateUrl: './approve-support.component.html',
  styleUrl: './approve-support.component.scss'
})
export class AdminApproveSupportComponent implements OnInit {
  tickets: any[] = [];
  isLoading = false;

  // Pagination
  currentPage = 1;
  maxResultCount = 10;
  totalCount = 0;

  constructor(
    private supportService: SupportService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.fetchTickets();
  }

  fetchTickets(): void {
    this.isLoading = true;
    this.cdr.detectChanges();

    const skipCount = (this.currentPage - 1) * this.maxResultCount;

    this.supportService.getAllTickets(skipCount, this.maxResultCount).subscribe({
      next: (res: any) => {
        this.tickets = res?.result?.items ?? [];
        this.totalCount = res?.result?.totalCount ?? 0;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load tickets', err);
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.fetchTickets();
    }
  }

  get totalPages(): number {
    return Math.ceil(this.totalCount / this.maxResultCount) || 1;
  }

  getPageNumbers(): number[] {
    const pageNumbers: number[] = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(1, this.currentPage - 2);
    let endPage = Math.min(this.totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }
    return pageNumbers;
  }

  getStartIndex(): number {
    return this.totalCount === 0 ? 0 : (this.currentPage - 1) * this.maxResultCount + 1;
  }

  getEndIndex(): number {
    return Math.min(this.currentPage * this.maxResultCount, this.totalCount);
  }

  async reply(ticket: any): Promise<void> {
    const { value: remarks } = await Swal.fire({
      title: 'Reply to Support Ticket',
      input: 'textarea',
      inputLabel: 'Admin Remarks / Response',
      inputValue: ticket.adminRemarks || '',
      inputPlaceholder: 'Type your response here...',
      showCancelButton: true,
      confirmButtonText: 'Send Reply',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#64748b',
      inputValidator: (value) => {
        if (!value) {
          return 'You need to write something!';
        }
        return null;
      }
    });

    if (remarks) {
      this.isLoading = true;
      this.supportService.updateStatus(ticket.id, 'Replied', remarks).subscribe({
        next: () => {
          Swal.fire('Replied!', 'Your response has been sent to the seller.', 'success');
          this.fetchTickets();
        },
        error: (err) => {
          console.error('Failed to update ticket', err);
          Swal.fire('Error', err.error?.error?.message || 'Failed to update ticket.', 'error');
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  closeTicket(ticket: any): void {
    Swal.fire({
      title: 'Close Ticket?',
      text: 'Are you sure you want to close this support ticket? This will mark it as resolved.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Close It',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b'
    }).then(async (result) => {
      if (result.isConfirmed) {
        const { value: remarks } = await Swal.fire({
          title: 'Closing Remarks',
          input: 'text',
          inputLabel: 'Remarks (Optional)',
          inputValue: 'Resolved by Admin',
          showCancelButton: true,
          confirmButtonColor: '#10b981'
        });

        if (remarks !== undefined) {
          this.isLoading = true;
          this.supportService.updateStatus(ticket.id, 'Closed', remarks || 'Closed by admin').subscribe({
            next: () => {
              Swal.fire('Closed!', 'The ticket has been resolved and closed.', 'success');
              this.fetchTickets();
            },
            error: (err) => {
              console.error('Failed to close ticket', err);
              Swal.fire('Error', err.error?.error?.message || 'Failed to close ticket.', 'error');
              this.isLoading = false;
              this.cdr.detectChanges();
            }
          });
        }
      }
    });
  }
}
