import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface AdminUser {
    id: number;
    name: string;
    email: string;
    role: string;
    status: string;
    lastLogin: string;
}

@Component({
    selector: 'app-user-management',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './user-management.component.html',
    styleUrls: ['./user-management.component.scss']
})
export class UserManagementComponent implements OnInit {
    users: AdminUser[] = [
        { id: 1, name: 'Adeel Noshahi', email: 'noshahi@elicom.com', role: 'Super Admin', status: 'Active', lastLogin: '10 mins ago' },
        { id: 2, name: 'Sarah Ahmed', email: 'sarah.a@elicom.com', role: 'Support Lead', status: 'Active', lastLogin: '2 hours ago' },
        { id: 3, name: 'Mike Johnson', email: 'mike@elicom.com', role: 'Financial Auditor', status: 'Inactive', lastLogin: '2 days ago' },
        { id: 4, name: 'Jessica Lee', email: 'jessica.l@elicom.com', role: 'KYC Reviewer', status: 'Active', lastLogin: 'Just now' }
    ];

    showAddModal = false;
    newUser: any = { name: '', email: '', role: 'Support Staff' };

    ngOnInit(): void { }

    openAddModal() {
        this.showAddModal = true;
    }

    closeAddModal() {
        this.showAddModal = false;
    }

    addUser() {
        this.users.unshift({
            id: this.users.length + 1,
            ...this.newUser,
            status: 'Active',
            lastLogin: 'Never'
        });
        this.closeAddModal();
        this.newUser = { name: '', email: '', role: 'Support Staff' };
    }

    toggleStatus(user: AdminUser) {
        user.status = user.status === 'Active' ? 'Inactive' : 'Active';
    }
}
