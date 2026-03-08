import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { ToastService } from '../../shared/toast/toast.service';
import { Loader } from '../../shared/loader/loader';

@Component({
    selector: 'app-user-management',
    standalone: true,
    imports: [CommonModule, DatePipe, FormsModule, Loader],
    templateUrl: './user-management.html',
    styleUrl: './user-management.scss',
})
export class UserManagement implements OnInit {

    users: any[] = [];
    isLoading = false;
    searchKeyword = '';

    // Pagination properties
    currentPage = 1;
    maxResultCount = 10;
    totalCount = 0;

    constructor(
        private userService: UserService,
        private cdr: ChangeDetectorRef,
        private toastService: ToastService
    ) { }

    ngOnInit() {
        this.fetchUsers();
    }

    fetchUsers() {
        this.isLoading = true;
        this.cdr.detectChanges();

        const skipCount = (this.currentPage - 1) * this.maxResultCount;

        this.userService.getAllUsers(skipCount, this.maxResultCount, this.searchKeyword).subscribe({
            next: (res: any) => {
                this.users = res?.result?.items ?? [];
                this.totalCount = res?.result?.totalCount ?? 0;
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Failed to load users', err);
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    changePage(page: number) {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            this.fetchUsers();
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

    toggleStatus(user: any) {
        const action = user.isActive ? 'deactivate' : 'activate';
        if (!confirm(`Are you sure you want to ${action} ${user.userName}?`)) return;

        this.isLoading = true;
        const obs = user.isActive
            ? this.userService.deactivateUser(user.id)
            : this.userService.activateUser(user.id);

        obs.subscribe({
            next: () => {
                this.toastService.showModal(`User ${user.userName} has been ${action}d successfully.`, 'USER UPDATED', 'success');
                this.fetchUsers();
            },
            error: (err) => {
                this.toastService.showError(`Failed to ${action} user`);
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    onSearch() {
        this.fetchUsers();
    }
}
