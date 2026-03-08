import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe, SlicePipe } from '@angular/common';
import { SupportService } from '../../services/support.service';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
    selector: 'app-approve-support-history',
    standalone: true,
    imports: [CommonModule, DatePipe, SlicePipe],
    templateUrl: './approve-support-history.html',
    styleUrl: './approve-support-history.scss',
})
export class ApproveSupportHistory implements OnInit {

    tickets: any[] = [];
    isLoading = false;

    constructor(
        private supportService: SupportService,
        private toastService: ToastService
    ) { }

    ngOnInit() {
        this.fetchTickets();
    }

    fetchTickets() {
        this.isLoading = true;
        this.supportService.getAllTickets().subscribe({
            next: (res: any) => {
                this.tickets = res?.result?.items ?? [];
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Failed to fetch all tickets', err);
                this.isLoading = false;
            }
        });
    }

    reply(ticket: any) {
        const remarks = prompt('Enter admin reply/remarks:', ticket.adminRemarks || '');
        if (remarks === null) return;

        const status = confirm('Mark as Resolved/Closed?') ? 'Closed' : 'Replied';

        this.isLoading = true;
        this.supportService.updateStatus(ticket.id, status, remarks).subscribe({
            next: () => {
                this.toastService.showModal('The ticket status and remarks have been updated successfully.', 'TICKET UPDATED', 'success');
                this.fetchTickets();
            },
            error: (err) => {
                console.error('Failed to update ticket', err);
                this.toastService.showError('Error updating ticket');
                this.isLoading = false;
            }
        });
    }
}
