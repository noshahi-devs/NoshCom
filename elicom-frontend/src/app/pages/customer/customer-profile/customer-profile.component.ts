import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { take } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { CustomerProfileDto, CustomerProfileService, CreateCustomerProfileDto } from '../../../services/customer-profile.service';

interface ProfileFormModel {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    gender: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
}

@Component({
    selector: 'app-customer-profile',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './customer-profile.component.html',
    styleUrl: './customer-profile.component.scss'
})
export class CustomerProfileComponent implements OnInit {
    isEditing = false;
    isSaving = false;
    profileId: string | null = null;
    userId: number | null = null;

    user: ProfileFormModel = this.createEmptyForm();
    draft: ProfileFormModel = this.createEmptyForm();

    constructor(
        private authService: AuthService,
        private customerProfileService: CustomerProfileService
    ) { }

    ngOnInit(): void {
        this.loadProfile();
    }

    editProfile(): void {
        this.isEditing = true;
        this.draft = { ...this.user };
    }

    saveProfile(): void {
        if (!this.userId || this.isSaving) {
            return;
        }

        this.isSaving = true;
        const payload = this.buildPayload();

        const request$ = this.profileId
            ? this.customerProfileService.updateProfile({ ...payload, id: this.profileId } as CustomerProfileDto)
            : this.customerProfileService.createProfile(payload as CreateCustomerProfileDto);

        request$.subscribe({
            next: (response) => {
                const result = response?.result || response;
                this.profileId = result?.id || this.profileId;
                this.user = { ...this.draft };
                this.isEditing = false;
                this.isSaving = false;

                Swal.fire({
                    title: 'Profile Updated',
                    text: 'Your profile has been saved successfully.',
                    icon: 'success',
                    timer: 1600,
                    showConfirmButton: false
                });
            },
            error: () => {
                this.isSaving = false;
                Swal.fire({
                    title: 'Update Failed',
                    text: 'We could not save your profile right now.',
                    icon: 'error',
                    confirmButtonColor: '#111111'
                });
            }
        });
    }

    private loadProfile(): void {
        this.authService.currentUser$.pipe(take(1)).subscribe(user => {
            this.userId = Number(user?.id || 0) || null;

            const fallbackName = user?.name || user?.fullName || user?.userName || 'Customer';
            const nameParts = fallbackName.trim().split(/\s+/);
            const fallbackFirstName = nameParts[0] || 'Customer';
            const fallbackLastName = nameParts.slice(1).join(' ');

            this.user = {
                firstName: fallbackFirstName,
                lastName: fallbackLastName,
                email: user?.emailAddress || '',
                phone: '',
                gender: 'Male',
                addressLine1: '',
                addressLine2: '',
                city: '',
                state: '',
                postalCode: '',
                country: ''
            };

            this.draft = { ...this.user };

            if (!this.userId) {
                return;
            }

            this.customerProfileService.getByUserId(this.userId).subscribe({
                next: (response) => {
                    const profile = response?.result || response;
                    if (!profile) {
                        return;
                    }

                    this.profileId = profile.id || null;
                    this.user = {
                        firstName: this.user.firstName,
                        lastName: this.user.lastName,
                        email: profile.email || this.user.email,
                        phone: profile.phoneNumber || '',
                        gender: 'Male',
                        addressLine1: profile.addressLine1 || '',
                        addressLine2: profile.addressLine2 || '',
                        city: profile.city || '',
                        state: profile.state || '',
                        postalCode: profile.postalCode || '',
                        country: profile.country || ''
                    };
                    this.draft = { ...this.user };
                },
                error: () => {
                    this.draft = { ...this.user };
                }
            });
        });
    }

    private buildPayload(): CreateCustomerProfileDto {
        const firstName = this.draft.firstName.trim();
        const lastName = this.draft.lastName.trim();

        return {
            userId: this.userId || 0,
            fullName: `${firstName} ${lastName}`.trim(),
            email: this.draft.email.trim(),
            phoneNumber: this.draft.phone.trim(),
            addressLine1: this.draft.addressLine1.trim(),
            addressLine2: this.draft.addressLine2.trim(),
            city: this.draft.city.trim(),
            state: this.draft.state.trim(),
            postalCode: this.draft.postalCode.trim(),
            country: this.draft.country.trim()
        };
    }

    private createEmptyForm(): ProfileFormModel {
        return {
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            gender: 'Male',
            addressLine1: '',
            addressLine2: '',
            city: '',
            state: '',
            postalCode: '',
            country: ''
        };
    }
}
