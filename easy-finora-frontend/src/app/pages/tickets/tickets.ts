import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { NgFor, NgIf, DatePipe, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupportService } from '../../services/support.service';
import { ToastService } from '../../shared/toast/toast.service';
import { Loader } from '../../shared/loader/loader';

@Component({
    selector: 'app-tickets',
    standalone: true,
    imports: [CommonModule, NgFor, NgIf, DatePipe, FormsModule, Loader],
    templateUrl: './tickets.html',
    styleUrl: './tickets.scss',
})
export class Tickets implements OnInit {

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
        private toastService: ToastService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.fetchTickets();
    }

    fetchTickets() {
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

    toggleCreate() {
        this.isCreating = !this.isCreating;
    }

    submitTicket() {
        if (!this.newTicket.title || !this.newTicket.message) {
            this.toastService.showError('Please fill in all fields');
            return;
        }

        const ticketPayload = {
            title: this.newTicket.title,
            message: this.newTicket.message,
            priority: this.newTicket.priority || 'Medium'
        };

        this.isLoading = true;
        this.supportService.createTicket(ticketPayload).subscribe({
            next: () => {
                this.toastService.showModal('Your support ticket has been created successfully! Our team will get back to you soon.', 'TICKET CREATED', 'success');
                this.isCreating = false;
                this.newTicket = { title: '', priority: 'Medium', message: '' };
                this.fetchTickets();
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Failed to create ticket', err);
                this.toastService.showError('Error creating ticket');
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }
}
