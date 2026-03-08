import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CardService } from '../../services/card.service';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
    selector: 'app-approve-cards',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './approve-cards.html',
    styleUrl: './approve-cards.scss'
})
export class ApproveCards implements OnInit {
    allApplications: any[] = [];
    filteredApplications: any[] = [];
    applications: any[] = [];
    isLoading = false;
    selectedApp: any = null;
    confirmationType: 'approve' | 'reject' | null = null;
    adminRemarks = '';

    // Pagination properties
    currentPage = 1;
    maxResultCount = 10;
    totalCount = 0;
    statusFilter: 'all' | 'pending' | 'approved' | 'rejected' = 'all';

    constructor(
        private cardService: CardService,
        private toastService: ToastService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.loadApplications();
    }

    loadApplications() {
        this.isLoading = true;
        this.cdr.detectChanges();
        // Load a wide slice once and paginate/filter locally for consistent admin filters.
        this.cardService.getCardApplications(0, 1000).subscribe({
            next: (res) => {
                // Handle both direct array and paged response structures
                if (Array.isArray(res?.result)) {
                    this.allApplications = res.result;
                } else {
                    this.allApplications = res?.result?.items ?? [];
                }

                this.applyFilterAndPagination();
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                this.toastService.showError('Failed to load applications.');
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    changePage(page: number) {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            this.applyFilterAndPagination();
        }
    }

    setStatusFilter(filter: 'all' | 'pending' | 'approved' | 'rejected') {
        this.statusFilter = filter;
        this.currentPage = 1;
        this.applyFilterAndPagination();
    }

    private applyFilterAndPagination(): void {
        this.filteredApplications = this.allApplications.filter((application) => this.matchesStatus(application?.status));
        this.totalCount = this.filteredApplications.length;
        const totalPages = this.totalPages;
        if (this.currentPage > totalPages) {
            this.currentPage = totalPages;
        }
        if (this.currentPage < 1) {
            this.currentPage = 1;
        }

        const startIndex = (this.currentPage - 1) * this.maxResultCount;
        const endIndex = startIndex + this.maxResultCount;
        this.applications = this.filteredApplications.slice(startIndex, endIndex);
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

    private matchesStatus(status: unknown): boolean {
        if (this.statusFilter === 'all') return true;
        return this.normalizeStatus(status) === this.statusFilter;
    }

    private normalizeStatus(status: unknown): 'pending' | 'approved' | 'rejected' | '' {
        const normalized = String(status ?? '').trim().toLowerCase();
        if (normalized === 'reject') return 'rejected';
        if (normalized === 'pending' || normalized === 'approved' || normalized === 'rejected') {
            return normalized;
        }
        return '';
    }

    approve(app: any) {
        console.log('Approve requested for:', app);
        const id = app.id || app.Id;
        if (!id) {
            this.toastService.showError('Application ID is missing.');
            return;
        }

        this.selectedApp = app;
        this.confirmationType = 'approve';
    }

    confirmApproval() {
        if (!this.selectedApp) return;
        const id = this.selectedApp.id || this.selectedApp.Id;

        console.log('[ApproveCards] 🚀 Confirming approval for Id:', id);
        this.isLoading = true;
        this.cdr.detectChanges();

        this.cardService.approveCardApplication(id).subscribe({
            next: (res) => {
                console.log('[ApproveCards] ✅ Approval successful:', res);
                this.toastService.showModal('The card has been approved and successfully generated for the user.', 'CARD APPROVED', 'success');
                setTimeout(() => {
                    this.selectedApp = null;
                    this.confirmationType = null;
                    this.loadApplications();
                    this.cdr.detectChanges();
                });
            },
            error: (err) => {
                console.error('[ApproveCards] ❌ Approval failed:', err);
                const msg = err.error?.error?.message || 'Approval failed.';
                this.toastService.showError(msg);
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    openRejectModal(app: any) {
        this.selectedApp = app;
        this.confirmationType = 'reject';
        this.adminRemarks = '';
    }

    reject() {
        if (!this.adminRemarks) {
            this.toastService.showError('Please provide remarks for rejection.');
            return;
        }

        const id = this.selectedApp?.id || this.selectedApp?.Id;
        this.isLoading = true;
        this.cardService.rejectCardApplication({ id: id, adminRemarks: this.adminRemarks }).subscribe({
            next: () => {
                this.toastService.showModal('The card application has been rejected.', 'APPLICATION REJECTED', 'info');
                setTimeout(() => {
                    this.selectedApp = null;
                    this.confirmationType = null;
                    this.loadApplications();
                    this.cdr.detectChanges();
                });
            },
            error: (err) => {
                const msg = err.error?.error?.message || 'Rejection failed.';
                this.toastService.showError(msg);
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    viewDocument(app: any) {
        const id = app.id || app.Id;
        if (!id) return;

        this.toastService.showInfo('Loading document...');
        this.cardService.getApplicationDocument(id).subscribe({
            next: (res) => {
                const doc = res.result;
                if (!doc) {
                    this.toastService.showError('No document found.');
                    return;
                }

                let fileType = 'png';
                if (doc.startsWith('JVBERi')) fileType = 'pdf';
                else if (doc.startsWith('/9j/')) fileType = 'jpg';
                else if (doc.startsWith('iVBORw0KGgo')) fileType = 'png';

                let base64 = doc;
                if (!doc.startsWith('data:')) {
                    const mimeType = fileType === 'pdf' ? 'application/pdf' : `image/${fileType}`;
                    base64 = `data:${mimeType};base64,${doc}`;
                }

                const win = window.open();
                if (win) {
                    win.document.title = "Document Viewer";
                    if (fileType === 'pdf') {
                        win.document.write(`
                            <body style="margin:0; background: #525659;">
                                <iframe src="${base64}" style="width:100%; height:100vh; border:none;"></iframe>
                            </body>
                        `);
                    } else {
                        win.document.write(`
                            <body style="margin:0; display:flex; align-items:center; justify-content:center; background:#000;">
                                <img src="${base64}" style="max-width:100%; max-height:100vh; object-fit:contain;" />
                            </body>
                        `);
                    }
                }
            },
            error: () => this.toastService.showError('Failed to load document.')
        });
    }

    cancelModal() {
        this.selectedApp = null;
        this.confirmationType = null;
    }
}
