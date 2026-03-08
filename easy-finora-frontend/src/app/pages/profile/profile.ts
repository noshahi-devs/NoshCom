
import { CommonModule } from '@angular/common'; // Import CommonModule for ngIf
import { FormsModule } from '@angular/forms'; // Import FormsModule for ngModel
import { ToastService } from '../../shared/toast/toast.service';
import { SessionService } from '../../services/session.service';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Loader } from '../../shared/loader/loader';

@Component({
    selector: 'app-profile',
    standalone: true,
    imports: [CommonModule, FormsModule, Loader], // Add to imports
    templateUrl: './profile.html',
    styleUrl: './profile.scss'
})
export class Profile implements OnInit {

    isEditing = false;
    isLoading = false;

    user: any = {
        name: '',
        email: '',
        phone: '',
        address: ''
    };

    // Backup for cancel
    originalUser: any = {};

    constructor(
        private toastService: ToastService,
        private sessionService: SessionService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.loadProfile();
    }

    loadProfile() {
        this.isLoading = true;
        this.sessionService.getCurrentLoginInformations().subscribe({
            next: (res: any) => {
                const u = res.result.user;
                if (u) {
                    this.user.name = u.name + ' ' + u.surname;
                    this.user.email = u.emailAddress;
                    this.user.phone = 'Not set'; // Backend DTO limits
                    this.user.address = 'Not set';

                    // Try to fetch more details if possible, or just settle with this
                    this.fetchUserDetails(u.id);
                }
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Failed to load profile', err);
                this.isLoading = false;
            }
        });
    }

    fetchUserDetails(id: number) {
        this.sessionService.getUser(id).subscribe({
            next: (res: any) => {
                if (res?.result) {
                    const u = res.result;
                    this.user.name = u.fullName;
                    this.user.email = u.emailAddress;
                    // If backend updated to send phone/country
                    if (u.phoneNumber) this.user.phone = u.phoneNumber;
                    if (u.country) this.user.address = u.country;
                }
                this.cdr.detectChanges();
            },
            error: () => { } // Ignore error if User/Get is restricted
        });
    }

    toggleEdit() {
        if (!this.isEditing) {
            // Start Editing: Backup data
            this.originalUser = { ...this.user };
            this.isEditing = true;
        } else {
            // Cancel Editing: Restore data
            this.user = { ...this.originalUser };
            this.isEditing = false;
        }
    }

    saveProfile() {
        this.isLoading = true;

        // Mock API call
        setTimeout(() => {
            this.isLoading = false;
            this.isEditing = false;
            this.toastService.showModal('Your profile has been updated successfully!', 'PROFILE UPDATED', 'success');
        }, 1500);
    }

    changePassword() {
        this.toastService.showInfo('Change password feature coming soon via Backend API.');
    }
}
