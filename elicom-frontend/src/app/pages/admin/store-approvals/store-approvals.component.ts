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

    ngOnInit() {
        this.loadApplications();
    }

    loadApplications() {
        this.isLoading = true;
        this.storeService.getAllStores().subscribe({
            next: (res) => {
                console.log('Store API Response (Full):', res);
                if (Array.isArray(res)) {
                    this.applications = res;
                } else {
                    this.applications = res?.result?.items || res?.items || [];
                }
                console.log('Mapped Applications Count:', this.applications.length);

                if (this.applications.length === 0) {
                    console.warn('No stores found. Check DB or Permissions.');
                    // Temporary debug alert
                    // Swal.fire('Debug', 'Loaded 0 stores. Check console for details.', 'info');
                }

                // Sort by relative time or createdAt descending (newest first)
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
                // Show more detailed error
                Swal.fire('Error', `Failed to load stores: ${err.status} ${err.statusText}`, 'error');
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
            text: `Are you sure you want to approve "${store.name}"?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, Approve',
            confirmButtonColor: '#10b981'
        }).then((result) => {
            if (result.isConfirmed) {
                this.storeService.approveStore(store.id).subscribe({
                    next: () => {
                        Swal.fire('Approved!', 'The store has been approved.', 'success');
                        this.loadApplications();
                    },
                    error: () => Swal.fire('Error', 'Approval failed.', 'error')
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
            inputAttributes: {
                'aria-label': 'Rejection reason'
            },
            showCancelButton: true,
            confirmButtonText: 'Yes, Reject',
            confirmButtonColor: '#ef4444'
        }).then((result) => {
            if (result.isConfirmed) {
                const reason = (result.value || '').trim();
                if (!reason) {
                    Swal.fire('Reason Required', 'Please provide a rejection reason.', 'warning');
                    return;
                }

                this.storeService.rejectStore(store.id, reason).subscribe({
                    next: () => {
                        Swal.fire('Rejected', 'The application has been rejected.', 'success');
                        this.loadApplications();
                    },
                    error: () => Swal.fire('Error', 'Operation failed.', 'error')
                });
            }
        });
    }

    verifyKYC(store: StoreDto) {
        Swal.fire({
            title: 'Verify KYC Documents?',
            text: `Are you sure you want to verify the identity documents for "${store.kyc?.fullName || store.name}"?`,
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: 'Yes, Verify',
            confirmButtonColor: '#0dcaf0'
        }).then((result) => {
            if (result.isConfirmed) {
                this.storeService.verifyKyc(store.id).subscribe({
                    next: () => {
                        Swal.fire('Verified!', 'Seller KYC documents have been marked as verified.', 'success');
                        this.loadApplications();
                    },
                    error: () => Swal.fire('Error', 'KYC verification failed.', 'error')
                });
            }
        });
    }

    viewStore(store: StoreDto) {
        // Show existing light data immediately
        this.selectedStore = { ...store };
        this.isDetailsLoading = true;
        this.cdr.detectChanges();

        this.storeService.getStore(store.id).subscribe({
            next: (res) => {
                console.log('Store API Raw Response:', res);
                const full = res?.result || res;
                if (full && typeof full === 'object') {
                    // Reset image loading states for this store
                    this.imageLoading[store.id + '_front'] = false;
                    this.imageLoading[store.id + '_back'] = false;

                    const kyc = full.kyc || full.Kyc;

                    this.selectedStore = {
                        ...this.selectedStore,
                        ...full,
                        name: full.name || full.Name || this.selectedStore?.name,
                        supportEmail: full.supportEmail || full.SupportEmail || this.selectedStore?.supportEmail,
                        shortDescription: full.shortDescription || full.ShortDescription || this.selectedStore?.shortDescription,
                        longDescription: full.longDescription || full.LongDescription || this.selectedStore?.longDescription,
                        kyc: kyc ? {
                            ...(this.selectedStore?.kyc || {}),
                            ...kyc,
                            fullName: kyc.fullName || kyc.FullName || this.selectedStore?.kyc?.fullName,
                            cnic: kyc.cnic || kyc.CNIC || this.selectedStore?.kyc?.cnic,
                            phone: kyc.phone || kyc.Phone || this.selectedStore?.kyc?.phone,
                            address: kyc.address || kyc.Address || this.selectedStore?.kyc?.address,
                            zipCode: kyc.zipCode || kyc.ZipCode || this.selectedStore?.kyc?.zipCode,
                            issueCountry: kyc.issueCountry || kyc.IssueCountry || this.selectedStore?.kyc?.issueCountry,
                            dob: kyc.dob || kyc.DOB || this.selectedStore?.kyc?.dob,
                            expiryDate: kyc.expiryDate || kyc.ExpiryDate || this.selectedStore?.kyc?.expiryDate,
                            frontImage: kyc.frontImage || kyc.FrontImage,
                            backImage: kyc.backImage || kyc.BackImage
                        } : this.selectedStore?.kyc
                    };
                }
                console.log('Hydrated Store Details:', this.selectedStore);
            },
            error: (err) => {
                console.error('Failed to load store details', err);
                // Keep the summary data if full hydration fails
            },
            complete: () => {
                this.isDetailsLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    getImageUrl(path: string | undefined): string {
        if (!path) return '';

        // Clean the path (remove extra quotes or whitespace)
        path = path.trim().replace(/^"|"$/g, '');

        if (path.startsWith('data:image')) return path;

        // If it's a full URL already
        if (path.startsWith('http://') || path.startsWith('https://')) return path;

        // If it looks like an absolute path but relative to server root
        if (path.startsWith('/')) {
            return `${environment.apiUrl}${path}`;
        }

        // Normal relative path
        return `${environment.apiUrl}/${path}`;
    }

    trackById(_index: number, item: StoreDto) {
        return item.id;
    }

    closeModal() {
        this.selectedStore = null;
        this.isDetailsLoading = false;
    }
}
