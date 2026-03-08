import { Component, OnInit } from '@angular/core';
import { DepositRequestService, DepositRequestDto } from './deposit-request.service';
import { finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-deposit-requests',
    templateUrl: './deposit-requests.component.html',
})
export class DepositRequestsComponent implements OnInit {
    requests: DepositRequestDto[] = [];
    isLoading = false;
    totalCount = 0;
    skipCount = 0;
    maxResultCount = 10;

    constructor(private depositRequestService: DepositRequestService) { }

    ngOnInit(): void {
        this.refresh();
    }

    refresh(): void {
        this.isLoading = true;
        this.depositRequestService.getAllRequests(this.skipCount, this.maxResultCount)
            .pipe(finalize(() => this.isLoading = false))
            .subscribe(result => {
                this.requests = result.result.items;
                this.totalCount = result.result.totalCount;
            });
    }

    approve(request: DepositRequestDto): void {
        Swal.fire({
            title: 'Approve Deposit?',
            text: `Are you sure you want to approve ${request.amount} ${request.currency} for ${request.userName}?`,
            icon: 'question',
            input: 'text',
            inputPlaceholder: 'Admin Remarks (Optional)',
            showCancelButton: true,
            confirmButtonText: 'Yes, Approve',
            confirmButtonColor: '#28a745'
        }).then((result) => {
            if (result.isConfirmed) {
                this.depositRequestService.approve(request.id, result.value || '')
                    .subscribe(() => {
                        Swal.fire('Approved!', 'Wallet balance has been updated.', 'success');
                        this.refresh();
                    });
            }
        });
    }

    reject(request: DepositRequestDto): void {
        Swal.fire({
            title: 'Reject Deposit?',
            text: 'Please provide a reason for rejection:',
            icon: 'warning',
            input: 'text',
            inputRequired: true,
            showCancelButton: true,
            confirmButtonText: 'Reject',
            confirmButtonColor: '#dc3545'
        }).then((result) => {
            if (result.isConfirmed) {
                this.depositRequestService.reject(request.id, result.value)
                    .subscribe(() => {
                        Swal.fire('Rejected', 'The request has been rejected.', 'info');
                        this.refresh();
                    });
            }
        });
    }

    viewSS(url: string): void {
        Swal.fire({
            title: 'Transaction Proof',
            imageUrl: url,
            imageAlt: 'Screenshot',
            width: '80%'
        });
    }
}
