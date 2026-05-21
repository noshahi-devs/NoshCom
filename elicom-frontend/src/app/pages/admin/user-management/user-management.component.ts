import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StoreService } from '../../../services/store.service';

export type SellerStatusFilter = 'all' | 'active' | 'inactive' | 'block' | 'warning';

export interface AdminUser {
    id: number;
    storeId: string;
    name: string;
    email: string;
    storeName: string;
    role: string;
    status: string;
    lastLogin: string;
    blocked: boolean;
    blockReason: string;
    hasWarning: boolean;
    isAdminActive: boolean;
    createdAt?: string;
}

@Component({
    selector: 'app-user-management',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './user-management.component.html',
    styleUrls: ['./user-management.component.scss']
})
export class UserManagementComponent implements OnInit, OnDestroy {
    private storeService = inject(StoreService);
    private cdr = inject(ChangeDetectorRef);

    users: AdminUser[] = [];
    filteredUsers: AdminUser[] = [];
    isLoading = false;

    searchTerm = '';
    filterMode: SellerStatusFilter = 'all';
    pageSize = 10;
    currentPage = 1;

    // ── Add Modal ──
    showAddModal = false;
    newUser: any = { name: '', email: '', role: 'Support Staff' };

    // ── Edit Modal ──
    showEditModal = false;
    editUser: AdminUser = this.emptyUser();

    // ── Block Modal ──
    showBlockModal = false;
    blockTarget: AdminUser | null = null;
    blockReasonInput = '';

    // ── Seller Blocked Popup ──
    showBlockedPopup = false;
    blockedPopupUser: AdminUser | null = null;

    // ── Warning Modal ──
    showWarningModal = false;
    warningTarget: AdminUser | null = null;
    warningSubject = '';
    warningMessage = '';
    selectedSeverity = 'medium';

    warningSeverityLevels = [
        { value: 'low', label: 'Advisory', color: '#28a745', icon: 'fas fa-info-circle' },
        { value: 'medium', label: 'Warning', color: '#F2BB13', icon: 'fas fa-exclamation-circle' },
        { value: 'high', label: 'Critical', color: '#dc3545', icon: 'fas fa-skull-crossbones' },
    ];

    ngOnInit(): void {
        this.loadSellers();
    }

    ngOnDestroy(): void {
        this.clearModalClasses();
    }

    loadSellers(): void {
        this.isLoading = true;
        this.storeService.getAllStores().subscribe({
            next: (res: any) => {
                const items = res?.result?.items || res?.result || res || [];
                const list = Array.isArray(items) ? items : [];
                const previous = new Map(this.users.map(u => [u.storeId, u]));

                this.users = list.map((store: any) => {
                    const storeId = String(store.id || '');
                    const prev = previous.get(storeId);
                    const isAdminActive = !!store.isAdminActive;
                    const blocked = prev?.blocked ?? false;
                    const hasWarning = prev?.hasWarning ?? false;

                    return {
                        id: Number(store.ownerId) || 0,
                        storeId,
                        name: (store.kyc?.fullName || store.name || 'Unnamed Seller').trim(),
                        email: (store.supportEmail || '').trim(),
                        storeName: (store.name || '').trim(),
                        role: 'Seller',
                        status: blocked ? 'Blocked' : (isAdminActive ? 'Active' : 'Inactive'),
                        lastLogin: this.formatJoinedLabel(store.createdAt),
                        blocked,
                        blockReason: prev?.blockReason || '',
                        hasWarning,
                        isAdminActive,
                        createdAt: store.createdAt
                    };
                });

                this.applyFilters();
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Error loading Smart Shop UK sellers:', err);
                this.users = [];
                this.applyFilters();
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    applyFilters(): void {
        const term = (this.searchTerm || '').trim().toLowerCase();

        this.filteredUsers = this.users.filter(user => {
            if (this.filterMode === 'active') {
                if (user.blocked || !user.isAdminActive) return false;
            } else if (this.filterMode === 'inactive') {
                if (user.blocked || user.isAdminActive) return false;
            } else if (this.filterMode === 'block') {
                if (!user.blocked) return false;
            } else if (this.filterMode === 'warning') {
                if (!user.hasWarning) return false;
            }

            if (!term) return true;
            const haystack = [user.name, user.storeName, user.email].join(' ').toLowerCase();
            return haystack.includes(term);
        });

        this.filteredUsers.sort((a, b) => {
            const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return bDate - aDate;
        });

        if (this.currentPage > this.totalPages) {
            this.currentPage = Math.max(1, this.totalPages);
        }
    }

    onSearchChange(): void {
        this.currentPage = 1;
        this.applyFilters();
    }

    setFilter(mode: SellerStatusFilter): void {
        this.filterMode = mode;
        this.currentPage = 1;
        this.applyFilters();
    }

    get pagedUsers(): AdminUser[] {
        const start = (this.currentPage - 1) * this.pageSize;
        return this.filteredUsers.slice(start, start + this.pageSize);
    }

    get totalPages(): number {
        return Math.max(1, Math.ceil(this.filteredUsers.length / this.pageSize));
    }

    get showingFrom(): number {
        if (!this.filteredUsers.length) return 0;
        return (this.currentPage - 1) * this.pageSize + 1;
    }

    get showingTo(): number {
        if (!this.filteredUsers.length) return 0;
        return Math.min(this.currentPage * this.pageSize, this.filteredUsers.length);
    }

    goPrevious(): void {
        if (this.currentPage > 1) {
            this.currentPage--;
        }
    }

    goNext(): void {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
        }
    }

    private formatJoinedLabel(value: string | null | undefined): string {
        if (!value) return '—';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '—';
        return `Joined ${new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)}`;
    }

    private emptyUser(): AdminUser {
        return {
            id: 0,
            storeId: '',
            name: '',
            email: '',
            storeName: '',
            role: 'Seller',
            status: 'Active',
            lastLogin: '',
            blocked: false,
            blockReason: '',
            hasWarning: false,
            isAdminActive: true
        };
    }

    private syncUser(patch: Partial<AdminUser> & { storeId: string }): void {
        const apply = (u: AdminUser) => {
            if (u.storeId !== patch.storeId) return u;
            return { ...u, ...patch };
        };
        this.users = this.users.map(apply);
        this.applyFilters();
    }

    private addModalClasses() { document.documentElement.classList.add('modal-open'); document.body.classList.add('modal-open'); }
    private clearModalClasses() { document.documentElement.classList.remove('modal-open'); document.body.classList.remove('modal-open'); }

    openAddModal() { this.showAddModal = true; this.addModalClasses(); }
    closeAddModal() { this.showAddModal = false; this.clearModalClasses(); }

    addUser() {
        if (!this.newUser.name.trim() || !this.newUser.email.trim()) return;
        this.closeAddModal();
        this.newUser = { name: '', email: '', role: 'Support Staff' };
    }

    openEditModal(user: AdminUser) { this.editUser = { ...user }; this.showEditModal = true; this.addModalClasses(); }
    closeEditModal() { this.showEditModal = false; this.clearModalClasses(); }

    saveEditUser() {
        if (!this.editUser.name.trim() || !this.editUser.email.trim()) return;
        this.syncUser({
            storeId: this.editUser.storeId,
            name: this.editUser.name.trim(),
            email: this.editUser.email.trim(),
            role: this.editUser.role
        });
        this.closeEditModal();
    }

    openBlockModal(user: AdminUser) {
        this.blockTarget = user;
        this.blockReasonInput = '';
        this.showBlockModal = true;
        this.addModalClasses();
    }

    closeBlockModal() { this.showBlockModal = false; this.clearModalClasses(); }

    confirmBlock() {
        if (!this.blockTarget) return;
        this.syncUser({
            storeId: this.blockTarget.storeId,
            blocked: true,
            blockReason: this.blockReasonInput.trim(),
            status: 'Blocked'
        });
        this.closeBlockModal();
    }

    unblockUser(user: AdminUser) {
        this.syncUser({
            storeId: user.storeId,
            blocked: false,
            blockReason: '',
            status: user.isAdminActive ? 'Active' : 'Inactive'
        });
    }

    previewBlockedPopup(user: AdminUser) {
        this.blockedPopupUser = user;
        this.showBlockedPopup = true;
        this.addModalClasses();
    }

    closeBlockedPopup() { this.showBlockedPopup = false; this.clearModalClasses(); }

    openWarningModal(user: AdminUser) {
        this.warningTarget = user;
        this.warningSubject = '';
        this.warningMessage = '';
        this.selectedSeverity = 'medium';
        this.showWarningModal = true;
        this.addModalClasses();
    }

    closeWarningModal() { this.showWarningModal = false; this.clearModalClasses(); }

    sendWarning() {
        if (!this.warningSubject.trim() || !this.warningMessage.trim() || !this.warningTarget) return;
        this.syncUser({ storeId: this.warningTarget.storeId, hasWarning: true });
        console.log('Warning dispatched:', {
            to: this.warningTarget,
            severity: this.selectedSeverity,
            subject: this.warningSubject,
            message: this.warningMessage
        });
        this.closeWarningModal();
    }

    toggleStatus(user: AdminUser) {
        if (user.blocked || !user.storeId) return;
        const newStatus = !user.isAdminActive;
        this.storeService.toggleAdminStatus(user.storeId, newStatus).subscribe({
            next: () => {
                this.syncUser({
                    storeId: user.storeId,
                    isAdminActive: newStatus,
                    status: newStatus ? 'Active' : 'Inactive'
                });
                this.cdr.detectChanges();
            },
            error: (err) => console.error('Error toggling seller status:', err)
        });
    }
}
