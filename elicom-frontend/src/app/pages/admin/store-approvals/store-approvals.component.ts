import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StoreService, StoreDto } from '../../../services/store.service';
import { environment } from '../../../../environments/environment';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-store-approvals',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './store-approvals.component.html',
    styleUrls: ['./store-approvals.component.scss']
})
export class StoreApprovalsComponent implements OnInit {
    private storeService = inject(StoreService);
    private cdr = inject(ChangeDetectorRef);
    applications: StoreDto[] = [];
    skeletonRows = Array.from({ length: 6 });
    isLoading = false;
    isDetailsLoading = false;
    pendingStores = 0;
    pendingKyc = 0;
    verifiedSellers = 0;
    selectedStore: StoreDto | null = null;
    imageLoading: { [key: string]: boolean } = {};
    isApproving = false;

    ngOnInit() {
        this.loadApplications();
    }

    loadApplications() {
        this.isLoading = true;
        this.storeService.getAllStores().subscribe({
            next: (res) => {
                if (Array.isArray(res)) {
                    this.applications = res;
                } else {
                    this.applications = res?.result?.items || res?.items || [];
                }
                
                // Sort by creationTime descending (newest first)
                this.applications.sort((a, b) => {
                    const dateA = new Date((a as any).creationTime || a.createdAt || 0).getTime();
                    const dateB = new Date((b as any).creationTime || b.createdAt || 0).getTime();
                    return dateB - dateA;
                });

                this.calculateStats();
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('API Error:', err);
                this.isLoading = false;
                Swal.fire('Error', `Failed to load stores`, 'error');
            }
        });
    }

    calculateStats() {
        this.pendingStores = this.applications.filter(a => !a.status).length;
        this.pendingKyc = this.applications.filter(a => a.kyc && !a.kyc.status).length;
        this.verifiedSellers = this.applications.filter(a => a.status && a.kyc?.status).length;
    }

    approveStore(store: StoreDto) {
        Swal.fire({
            title: 'Approve Store?',
            text: `Confirm approval for "${store.name}"?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, Approve',
            confirmButtonColor: '#10b981',
            backdrop: true
        }).then((result) => {
            if (result.isConfirmed) {
                // Immediate UI cleanup
                this.selectedStore = null;
                this.isApproving = true;
                this.cdr.detectChanges();

                // Global loader
                Swal.fire({
                    title: 'Approving...',
                    allowOutsideClick: false,
                    didOpen: () => { Swal.showLoading(); }
                });

                this.storeService.approveStore(store.id).subscribe({
                    next: () => {
                        this.isApproving = false;
                        Swal.fire('Approved!', 'Store has been approved.', 'success');
                        this.loadApplications();
                    },
                    error: () => {
                        this.isApproving = false;
                        Swal.fire('Error', 'Approval failed.', 'error');
                    }
                });
            }
        });
    }

    rejectStore(store: StoreDto) {
        Swal.fire({
            title: 'Reject Store?',
            text: `Please provide a reason for rejecting "${store.name}".`,
            icon: 'warning',
            input: 'textarea',
            inputPlaceholder: 'Enter rejection reason...',
            showCancelButton: true,
            confirmButtonText: 'Yes, Reject',
            confirmButtonColor: '#ef4444'
        }).then((result) => {
            if (result.isConfirmed) {
                const reason = (result.value || '').trim();
                if (!reason) {
                    Swal.fire('Reason Required', 'Please provide a reason.', 'warning');
                    return;
                }

                this.selectedStore = null;
                this.isApproving = true;
                this.cdr.detectChanges();

                Swal.fire({
                    title: 'Rejecting...',
                    allowOutsideClick: false,
                    didOpen: () => { Swal.showLoading(); }
                });

                this.storeService.rejectStore(store.id, reason).subscribe({
                    next: () => {
                        this.isApproving = false;
                        Swal.fire('Rejected', 'Application rejected.', 'success');
                        this.loadApplications();
                    },
                    error: () => {
                        this.isApproving = false;
                        Swal.fire('Error', 'Action failed.', 'error');
                    }
                });
            }
        });
    }

    verifyKYC(store: StoreDto) {
        Swal.fire({
            title: 'Verify KYC?',
            text: `Mark documents for "${store.name}" as verified?`,
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: 'Yes, Verify',
            confirmButtonColor: '#0dcaf0'
        }).then((result) => {
            if (result.isConfirmed) {
                this.selectedStore = null;
                this.isApproving = true;
                this.cdr.detectChanges();

                Swal.fire({
                    title: 'Verifying...',
                    allowOutsideClick: false,
                    didOpen: () => { Swal.showLoading(); }
                });

                this.storeService.verifyKyc(store.id).subscribe({
                    next: () => {
                        this.isApproving = false;
                        Swal.fire('Verified!', 'KYC verified.', 'success');
                        this.loadApplications();
                    },
                    error: () => {
                        this.isApproving = false;
                        Swal.fire('Error', 'Verification failed.', 'error');
                    }
                });
            }
        });
    }

    viewStore(store: StoreDto) {
        this.selectedStore = { ...store };
        this.isDetailsLoading = true;
        this.imageLoading = {};
        this.cdr.detectChanges();

        this.storeService.getStore(store.id).subscribe({
            next: (res) => {
                const full = res?.result || res;
                if (full && typeof full === 'object') {
                    const kyc = full.kyc || full.Kyc;
                    this.selectedStore = {
                        ...this.selectedStore,
                        ...full,
                        kyc: kyc ? { ...(this.selectedStore?.kyc || {}), ...kyc } : this.selectedStore?.kyc
                    };
                }
            },
            error: (err) => console.error('Failed to load store details', err),
            complete: () => {
                this.isDetailsLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    getImageUrl(path: string | undefined): string {
        if (!path) return '';
        path = path.trim().replace(/^"|"$/g, '');
        if (path.startsWith('data:image')) return path;
        if (path.startsWith('http://') || path.startsWith('https://')) return path;
        return (path.startsWith('/')) ? `${environment.apiUrl}${path}` : `${environment.apiUrl}/${path}`;
    }

    trackById(_index: number, item: StoreDto) { return item.id; }

    closeModal() {
        this.selectedStore = null;
        this.isDetailsLoading = false;
        this.cdr.detectChanges();
    }
}
