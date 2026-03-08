import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { StoreService } from '../../../services/store.service';
import { AuthService } from '../../../services/auth.service';
import Swal from 'sweetalert2';

@Component({
    selector: 'app-store-creation',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './store-creation.component.html',
    styleUrls: ['./store-creation.component.scss']
})
export class StoreCreationComponent {
    private fb = inject(FormBuilder);
    private storeService = inject(StoreService);
    private authService = inject(AuthService);
    private router = inject(Router);

    currentStep = 1;
    totalSteps = 7;
    storeForm: FormGroup;
    isLoading = false;
    // fallback previews so users see images without clicking
    defaultFront = 'data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"380\" viewBox=\"0 0 600 380\"><defs><linearGradient id=\"g\" x1=\"0\" x2=\"1\" y1=\"0\" y2=\"1\"><stop offset=\"0%\" stop-color=\"%23f5f7fa\"/><stop offset=\"100%\" stop-color=\"%23e2e8f0\"/></linearGradient></defs><rect width=\"600\" height=\"380\" fill=\"url(%23g)\"/><text x=\"50%\" y=\"50%\" font-family=\"Arial\" font-size=\"28\" font-weight=\"700\" fill=\"%2394a3b8\" text-anchor=\"middle\" dy=\"10\">Front Preview</text></svg>';
    defaultBack = 'data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"380\" viewBox=\"0 0 600 380\"><defs><linearGradient id=\"g2\" x1=\"1\" x2=\"0\" y1=\"0\" y2=\"1\"><stop offset=\"0%\" stop-color=\"%23f8fafc\"/><stop offset=\"100%\" stop-color=\"%23e2e8f0\"/></linearGradient></defs><rect width=\"600\" height=\"380\" fill=\"url(%23g2)\"/><text x=\"50%\" y=\"50%\" font-family=\"Arial\" font-size=\"28\" font-weight=\"700\" fill=\"%2394a3b8\" text-anchor=\"middle\" dy=\"10\">Back Preview</text></svg>';
    frontPreview = this.defaultFront;
    backPreview = this.defaultBack;
    private frontObjectUrl?: string;
    private backObjectUrl?: string;

    countries = [
        { code: 'USA', name: 'United States' },
        { code: 'PAK', name: 'Pakistan' },
        { code: 'IND', name: 'India' },
        { code: 'GBR', name: 'United Kingdom' },
        { code: 'CAN', name: 'Canada' },
        { code: 'AUS', name: 'Australia' },
        { code: 'UAE', name: 'United Arab Emirates' },
        { code: 'SAU', name: 'Saudi Arabia' },
        { code: 'TUR', name: 'Turkey' },
        { code: 'CHN', name: 'China' },
        { code: 'DEU', name: 'Germany' },
        { code: 'FRA', name: 'France' },
        { code: 'ITA', name: 'Italy' },
        { code: 'ESP', name: 'Spain' },
        { code: 'BRA', name: 'Brazil' },
        { code: 'MEX', name: 'Mexico' },
        { code: 'JPN', name: 'Japan' },
        { code: 'BGD', name: 'Bangladesh' },
        { code: 'SGP', name: 'Singapore' },
        { code: 'MYS', name: 'Malaysia' },
        { code: 'QAT', name: 'Qatar' },
        { code: 'KWT', name: 'Kuwait' },
        { code: 'OMN', name: 'Oman' },
        { code: 'IDN', name: 'Indonesia' },
        { code: 'ZAF', name: 'South Africa' },
        { code: 'NGA', name: 'Nigeria' }
    ];

    constructor() {
        this.storeForm = this.fb.group({
            name: ['', [Validators.required, Validators.minLength(3)]],
            shortDescription: ['', [Validators.required, Validators.maxLength(200)]],
            longDescription: ['', Validators.required],
            description: [''], // Legacy
            supportEmail: ['', [Validators.required, Validators.email]],
            instagram: [''],
            whatsapp: [''],
            kyc: this.fb.group({
                fullName: ['', Validators.required],
                cnic: ['', Validators.required],
                expiryDate: ['', Validators.required],
                issueCountry: ['', Validators.required],
                dob: ['', Validators.required],
                phone: ['', Validators.required],
                address: ['', Validators.required],
                zipCode: ['', Validators.required],
                frontImage: ['', Validators.required],
                backImage: ['', Validators.required]
            })
        });

        // Sync old description with longDescription
        this.storeForm.get('longDescription')?.valueChanges.subscribe(val => {
            this.storeForm.get('description')?.setValue(val, { emitEvent: false });
        });
    }

    logout() {
        this.authService.logout();
    }

    nextStep() {
        const stepValid = this.validateCurrentStep();
        if (!stepValid) {
            return;
        }

        if (this.currentStep < this.totalSteps) {
            this.currentStep++;
        } else {
            this.submitStore();
        }
    }

    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
        }
    }

    goToStep(step: number) {
        if (step >= 1 && step <= this.totalSteps) {
            this.currentStep = step;
        }
    }

    triggerFileSelect(inputId: string) {
        document.getElementById(inputId)?.click();
    }

    onFileSelected(event: any, fieldName: 'frontImage' | 'backImage') {
        const file = event.target.files[0];
        if (file) {
            const objectUrl = URL.createObjectURL(file);
            if (fieldName === 'frontImage') {
                if (this.frontObjectUrl) URL.revokeObjectURL(this.frontObjectUrl);
                this.frontObjectUrl = objectUrl;
                this.frontPreview = objectUrl;
            } else {
                if (this.backObjectUrl) URL.revokeObjectURL(this.backObjectUrl);
                this.backObjectUrl = objectUrl;
                this.backPreview = objectUrl;
            }

            const reader = new FileReader();
            reader.onload = () => {
                this.storeForm.get(`kyc.${fieldName}`)?.setValue(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    }

    get docsReady() {
        const kyc = this.storeForm.value.kyc;
        return Boolean(kyc?.frontImage && kyc?.backImage);
    }

    private validateCurrentStep(): boolean {
        const stepFields: { [key: number]: string[] } = {
            1: ['name'],
            2: ['shortDescription', 'longDescription', 'supportEmail'],
            3: ['kyc.fullName', 'kyc.dob', 'kyc.phone'],
            4: ['kyc.issueCountry', 'kyc.address', 'kyc.zipCode'],
            5: ['kyc.cnic', 'kyc.expiryDate'],
            6: ['kyc.frontImage', 'kyc.backImage']
        };

        const fields = stepFields[this.currentStep] || [];
        fields.forEach(path => this.storeForm.get(path)?.markAsTouched());

        const invalid = fields.some(path => this.storeForm.get(path)?.invalid);
        return !invalid;
    }

    submitStore() {
        if (this.storeForm.invalid) {
            Swal.fire('Error', 'Please fill all required fields correctly.', 'warning');
            return;
        }

        this.isLoading = true;
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const storeName = this.storeForm.value.name;
        const generatedSlug = storeName.toLowerCase().trim().replace(/ /g, '-').replace(/[^\w-]+/g, '');

        const payload = {
            name: storeName,
            shortDescription: this.storeForm.value.shortDescription,
            longDescription: this.storeForm.value.longDescription,
            description: this.storeForm.value.description,
            slug: generatedSlug,
            ownerId: currentUser.id,
            supportEmail: this.storeForm.value.supportEmail,
            status: false,
            isActive: true,
            kyc: this.storeForm.value.kyc
        };

        this.storeService.createStore(payload).subscribe({
            next: (res) => {
                Swal.fire({
                    icon: 'success',
                    title: 'Store Created!',
                    text: 'Your application has been submitted for review.',
                    confirmButtonText: 'Go to Dashboard'
                }).then(() => {
                    this.router.navigate(['/seller/dashboard']);
                });
            },
            error: (err) => {
                this.isLoading = false;
                const backendMessage =
                    err?.error?.error?.message ||
                    err?.error?.message ||
                    err?.message ||
                    'Failed to create store. Please check your information.';

                const ownerNotSynced =
                    typeof backendMessage === 'string' &&
                    backendMessage.includes('Owner ID') &&
                    backendMessage.includes('not found in the local database');

                if (ownerNotSynced) {
                    Swal.fire(
                        'Session Expired/Out of Sync',
                        'Aap ka current session is local database se match nahi kar raha. Dobara login karein.',
                        'warning'
                    ).then(() => {
                        this.authService.logout();
                    });
                    return;
                }

                Swal.fire('Error', backendMessage, 'error');
            }
        });
    }
}
