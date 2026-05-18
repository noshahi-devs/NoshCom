import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface AdminUser {
    id: number;
    name: string;
    email: string;
    role: string;
    status: string;
    lastLogin: string;
    blocked: boolean;
    blockReason: string;
}

@Component({
    selector: 'app-user-management',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './user-management.component.html',
    styleUrls: ['./user-management.component.scss']
})
export class UserManagementComponent implements OnInit, OnDestroy {
    users: AdminUser[] = [
        { id: 1, name: 'Adeel Noshahi',  email: 'noshahi@elicom.com',   role: 'Super Admin',       status: 'Active',   lastLogin: '10 mins ago', blocked: false, blockReason: '' },
        { id: 2, name: 'Sarah Ahmed',    email: 'sarah.a@elicom.com',   role: 'Support Lead',      status: 'Active',   lastLogin: '2 hours ago', blocked: false, blockReason: '' },
        { id: 3, name: 'Mike Johnson',   email: 'mike@elicom.com',      role: 'Financial Auditor', status: 'Inactive', lastLogin: '2 days ago',  blocked: false, blockReason: '' },
        { id: 4, name: 'Jessica Lee',    email: 'jessica.l@elicom.com', role: 'KYC Reviewer',      status: 'Active',   lastLogin: 'Just now',    blocked: false, blockReason: '' }
    ];

    // ── Add Modal ──
    showAddModal = false;
    newUser: any = { name: '', email: '', role: 'Support Staff' };

    // ── Edit Modal ──
    showEditModal = false;
    editUser: AdminUser = { id: 0, name: '', email: '', role: '', status: '', lastLogin: '', blocked: false, blockReason: '' };

    // ── Block Modal ──
    showBlockModal   = false;
    blockTarget: AdminUser | null = null;
    blockReasonInput = '';

    // ── Seller Blocked Popup (simulates what seller sees on login) ──
    showBlockedPopup   = false;
    blockedPopupUser: AdminUser | null = null;

    // ── Warning Modal ──
    showWarningModal  = false;
    warningTarget: AdminUser | null = null;
    warningSubject    = '';
    warningMessage    = '';
    selectedSeverity  = 'medium';

    warningSeverityLevels = [
        { value: 'low',    label: 'Advisory', color: '#28a745', icon: 'fas fa-info-circle'      },
        { value: 'medium', label: 'Warning',  color: '#F2BB13', icon: 'fas fa-exclamation-circle'},
        { value: 'high',   label: 'Critical', color: '#dc3545', icon: 'fas fa-skull-crossbones'  },
    ];

    ngOnInit(): void { }

    ngOnDestroy(): void {
        this.clearModalClasses();
    }

    private addModalClasses()    { document.documentElement.classList.add('modal-open');    document.body.classList.add('modal-open');    }
    private clearModalClasses()  { document.documentElement.classList.remove('modal-open'); document.body.classList.remove('modal-open'); }

    // ── Add Modal ──
    openAddModal()  { this.showAddModal = true;  this.addModalClasses(); }
    closeAddModal() { this.showAddModal = false; this.clearModalClasses(); }

    addUser() {
        if (!this.newUser.name.trim() || !this.newUser.email.trim()) return;
        this.users.unshift({
            id: this.users.length + 1,
            ...this.newUser,
            status: 'Active',
            lastLogin: 'Never',
            blocked: false,
            blockReason: ''
        });
        this.closeAddModal();
        this.newUser = { name: '', email: '', role: 'Support Staff' };
    }

    // ── Edit Modal ──
    openEditModal(user: AdminUser) { this.editUser = { ...user }; this.showEditModal = true; this.addModalClasses(); }
    closeEditModal()               { this.showEditModal = false; this.clearModalClasses(); }

    saveEditUser() {
        if (!this.editUser.name.trim() || !this.editUser.email.trim()) return;
        const idx = this.users.findIndex(u => u.id === this.editUser.id);
        if (idx !== -1) this.users[idx] = { ...this.editUser };
        this.closeEditModal();
    }

    // ── Block Modal ──
    openBlockModal(user: AdminUser) {
        this.blockTarget      = user;
        this.blockReasonInput = '';
        this.showBlockModal   = true;
        this.addModalClasses();
    }

    closeBlockModal() { this.showBlockModal = false; this.clearModalClasses(); }

    confirmBlock() {
        if (!this.blockTarget) return;
        const idx = this.users.findIndex(u => u.id === this.blockTarget!.id);
        if (idx !== -1) {
            this.users[idx].blocked     = true;
            this.users[idx].blockReason = this.blockReasonInput.trim();
            this.users[idx].status      = 'Blocked';
        }
        this.closeBlockModal();
    }

    unblockUser(user: AdminUser) {
        const idx = this.users.findIndex(u => u.id === user.id);
        if (idx !== -1) {
            this.users[idx].blocked     = false;
            this.users[idx].blockReason = '';
            this.users[idx].status      = 'Active';
        }
    }

    // ── Seller Blocked Popup (preview / simulate) ──
    previewBlockedPopup(user: AdminUser) {
        this.blockedPopupUser = user;
        this.showBlockedPopup = true;
        this.addModalClasses();
    }

    closeBlockedPopup() { this.showBlockedPopup = false; this.clearModalClasses(); }

    // ── Warning Modal ──
    openWarningModal(user: AdminUser) {
        this.warningTarget   = user;
        this.warningSubject  = '';
        this.warningMessage  = '';
        this.selectedSeverity = 'medium';
        this.showWarningModal = true;
        this.addModalClasses();
    }

    closeWarningModal() { this.showWarningModal = false; this.clearModalClasses(); }

    sendWarning() {
        if (!this.warningSubject.trim() || !this.warningMessage.trim()) return;
        console.log('Warning dispatched:', {
            to: this.warningTarget,
            severity: this.selectedSeverity,
            subject: this.warningSubject,
            message: this.warningMessage
        });
        this.closeWarningModal();
    }

    // ── Toggle Status (Suspend / Activate) ──
    toggleStatus(user: AdminUser) {
        if (user.blocked) return; // blocked users can't be toggled
        user.status = user.status === 'Active' ? 'Inactive' : 'Active';
    }
}
