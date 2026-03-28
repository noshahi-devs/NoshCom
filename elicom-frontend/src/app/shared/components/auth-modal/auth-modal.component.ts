import { Component, EventEmitter, Output, ChangeDetectorRef, inject, OnDestroy, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService, LoginDto, RegisterDto } from '../../../services/auth.service';
import { resolvePlatformName } from '../../platform-context';

@Component({
    selector: 'app-auth-modal',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './auth-modal.component.html',
    styleUrls: ['./auth-modal.component.scss']
})
export class AuthModalComponent implements OnInit, OnDestroy {
    private cdr = inject(ChangeDetectorRef);
    private roleAnimationTimeout: any;
    @Input() pageMode = false;
    @Output() close = new EventEmitter<void>();
    @Output() authenticated = new EventEmitter<void>();

    view: 'signin' | 'signup' | 'verification' = 'signin';
    userRole: 'customer' | 'seller' = 'customer';
    signInForm: FormGroup;
    signUpForm: FormGroup;

    showPassword = false;
    showConfirmPassword = false;
    isLoading = false;
    roleAnimating = false;
    errorMessage: string = '';
    showErrorModal = false;
    errorTitle = 'Registration Not Completed';

    // Loading Experience
    loadingMessage: string = 'Starting registration...';
    private loadingMessages = [
        'Creating your NoshCom profile...',
        'Securing your account...',
        'Preparing your dashboard...',
        'Almost ready...',
        'Finalizing your setup...'
    ];
    private loadingInterval: any;

    countries = [
        { name: 'Pakistan', code: 'PK', dial_code: '+92', flag: 'https://flagcdn.com/pk.svg' },
        { name: 'United States', code: 'US', dial_code: '+1', flag: 'https://flagcdn.com/us.svg' },
        { name: 'United Kingdom', code: 'GB', dial_code: '+44', flag: 'https://flagcdn.com/gb.svg' },
        { name: 'India', code: 'IN', dial_code: '+91', flag: 'https://flagcdn.com/in.svg' },
        { name: 'Canada', code: 'CA', dial_code: '+1', flag: 'https://flagcdn.com/ca.svg' },
        { name: 'Australia', code: 'AU', dial_code: '+61', flag: 'https://flagcdn.com/au.svg' },
        { name: 'Germany', code: 'DE', dial_code: '+49', flag: 'https://flagcdn.com/de.svg' },
        { name: 'France', code: 'FR', dial_code: '+33', flag: 'https://flagcdn.com/fr.svg' },
        { name: 'UAE', code: 'AE', dial_code: '+971', flag: 'https://flagcdn.com/ae.svg' },
        { name: 'Saudi Arabia', code: 'SA', dial_code: '+966', flag: 'https://flagcdn.com/sa.svg' },
        { name: 'China', code: 'CN', dial_code: '+86', flag: 'https://flagcdn.com/cn.svg' },
        { name: 'Japan', code: 'JP', dial_code: '+81', flag: 'https://flagcdn.com/jp.svg' },
        { name: 'Brazil', code: 'BR', dial_code: '+55', flag: 'https://flagcdn.com/br.svg' },
        { name: 'Mexico', code: 'MX', dial_code: '+52', flag: 'https://flagcdn.com/mx.svg' },
        { name: 'Turkey', code: 'TR', dial_code: '+90', flag: 'https://flagcdn.com/tr.svg' }
    ];

    selectedCountry = this.countries[0]; // Default PK

    constructor(
        private fb: FormBuilder,
        private authService: AuthService
    ) {
        this.signInForm = this.fb.group({
            email: ['', [Validators.required, Validators.email]],
            password: ['', [Validators.required]],
            rememberMe: [false]
        });

        this.signUpForm = this.fb.group({
            firstName: ['', Validators.required],
            lastName: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            countryCode: [this.selectedCountry.dial_code],
            phone: ['', Validators.required], // Will be updated with dial code
            password: ['', [Validators.required, Validators.minLength(6)]],
            confirmPassword: ['', Validators.required]
        }, { validators: this.passwordMatchValidator });

        // Initialize phone with default country code
        this.updatePhoneCode();
    }

    ngOnInit() {
        // More aggressive scroll lock for both html and body
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        document.body.style.position = 'relative'; // Helps on some mobile browsers
    }

    ngOnDestroy() {
        this.stopLoadingRotation();
        if (this.roleAnimationTimeout) {
            clearTimeout(this.roleAnimationTimeout);
            this.roleAnimationTimeout = null;
        }
        // Restore scroll
        document.body.style.overflow = 'auto';
        document.documentElement.style.overflow = 'auto';
        document.body.style.position = '';
    }

    passwordMatchValidator(g: FormGroup) {
        return g.get('password')?.value === g.get('confirmPassword')?.value
            ? null : { mismatch: true };
    }

    onCountryChange(event: any) {
        const dialCode = event.target.value;
        const country = this.countries.find(c => c.dial_code === dialCode);
        if (country) {
            this.selectedCountry = country;
            this.updatePhoneCode();
        }
    }

    updatePhoneCode() {
        let currentPhone = this.signUpForm.get('phone')?.value || '';
        if (!currentPhone) {
            this.signUpForm.get('phone')?.setValue(this.selectedCountry.dial_code);
            return;
        }

        if (!currentPhone.startsWith(this.selectedCountry.dial_code)) {
            this.signUpForm.get('phone')?.setValue(this.selectedCountry.dial_code);
        }
    }

    switchView(view: 'signin' | 'signup' | 'verification') {
        this.view = view;
        this.errorMessage = '';
        this.showErrorModal = false;
    }

    setUserRole(role: 'customer' | 'seller') {
        if (this.userRole === role) return;
        this.userRole = role;
        this.roleAnimating = false;

        if (this.roleAnimationTimeout) {
            clearTimeout(this.roleAnimationTimeout);
        }

        this.cdr.detectChanges();
        this.roleAnimating = true;

        this.roleAnimationTimeout = setTimeout(() => {
            this.roleAnimating = false;
            this.cdr.detectChanges();
        }, 520);
    }

    private startLoadingRotation() {
        this.stopLoadingRotation();
        let index = 0;
        this.loadingMessage = this.loadingMessages[index];
        this.loadingInterval = setInterval(() => {
            index = (index + 1) % this.loadingMessages.length;
            this.loadingMessage = this.loadingMessages[index];
            this.cdr.detectChanges();
        }, 1200);
    }

    private stopLoadingRotation() {
        if (this.loadingInterval) {
            clearInterval(this.loadingInterval);
            this.loadingInterval = null;
        }
    }

    onSignIn() {
        if (this.signInForm.invalid) return;

        this.isLoading = true;
        this.errorMessage = '';
        this.showErrorModal = false;
        this.loadingMessage = 'Signing you in to NoshCom...';

        const credentials: LoginDto = {
            userNameOrEmailAddress: this.signInForm.value.email,
            password: this.signInForm.value.password,
            rememberClient: !!this.signInForm.value.rememberMe
        };

        this.authService.login(credentials)
            .subscribe({
                next: () => {
                    this.isLoading = false;
                    this.cdr.detectChanges();
                    this.authenticated.emit();
                    this.close.emit();
                },
                error: (err) => {
                    console.error('Login failed', err);
                    this.isLoading = false;

                    if (err.error?.error?.message) {
                        this.errorMessage = err.error.error.message;
                    }
                    else if (err.error?.message) {
                        this.errorMessage = err.error.message;
                    }
                    else {
                        this.errorMessage = 'Invalid email or password. Please try again.';
                    }
                    this.cdr.detectChanges();
                }
            })
            .add(() => {
                this.isLoading = false;
                this.cdr.detectChanges();
            });
    }

    onSignUp() {
        if (this.signUpForm.invalid) return;

        this.isLoading = true;
        this.errorMessage = '';
        this.showErrorModal = false;
        this.startLoadingRotation();

        const data = {
            emailAddress: this.signUpForm.value.email,
            password: this.signUpForm.value.password,
            country: this.selectedCountry.name,
            phoneNumber: this.signUpForm.value.phone,
            fullName: `${this.signUpForm.value.firstName} ${this.signUpForm.value.lastName}`
        };

        const isPrimeShip = resolvePlatformName() === 'PrimeShip';

        let registerMethod;
        if (isPrimeShip) {
            registerMethod = this.userRole === 'seller'
                ? this.authService.registerPrimeShipSeller(data)
                : this.authService.registerPrimeShipCustomer(data);
        } else {
            registerMethod = this.userRole === 'seller'
                ? this.authService.registerSmartStoreSeller(data)
                : this.authService.registerSmartStoreCustomer(data);
        }

        registerMethod
            .subscribe({
                next: () => {
                    this.stopLoadingRotation();
                    this.view = 'verification';
                    this.isLoading = false; // Add this to ensure UI updates immediately

                    this.signInForm.patchValue({
                        email: this.signUpForm.value.email
                    });

                    this.signUpForm.reset();
                    this.updatePhoneCode();
                },
                error: (err) => {
                    this.stopLoadingRotation();
                    this.isLoading = false;
                    // ABP wraps errors as: { error: { message: "..." } }
                    const rawMessage: string =
                        err?.error?.error?.message ||
                        err?.error?.message ||
                        err?.message || '';
                    const result = this.classifySignupError(rawMessage, err?.status);
                    this.errorTitle = result.title;
                    this.errorMessage = result.message;
                    this.showErrorModal = true;
                    this.cdr.detectChanges();
                }
            })
            .add(() => {
                this.isLoading = false;
                this.stopLoadingRotation();
                this.cdr.detectChanges();
            });
    }

    onClose() {
        this.close.emit();
    }

    openGmail() {
        window.open('https://mail.google.com', '_blank');
    }

    goToLogin() {
        this.view = 'signin';
        this.showErrorModal = false;
        this.cdr.detectChanges();
    }

    closeErrorModal() {
        this.showErrorModal = false;
        this.cdr.detectChanges();
    }

    goToLoginFromError() {
        this.showErrorModal = false;
        this.view = 'signin';
        this.cdr.detectChanges();
    }

    private classifySignupError(rawMessage: string, statusCode?: number): { title: string; message: string } {
        const lower = (rawMessage || '').toLowerCase().trim();

        // Duplicate / already registered
        if (
            lower.includes('already exists') ||
            lower.includes('already exist') ||
            lower.includes('duplicate') ||
            lower.includes('is already taken')
        ) {
            return {
                title: 'Email Already Registered',
                message: 'An account with this email already exists. Please sign in or use a different email address.'
            };
        }

        // Weak / short password
        if (lower.includes('password') && (lower.includes('short') || lower.includes('length') || lower.includes('weak'))) {
            return {
                title: 'Password Too Weak',
                message: 'Your password does not meet the minimum requirements. Please choose a stronger password (at least 6 characters).'
            };
        }

        // Network / server unreachable
        if (statusCode === 0 || lower.includes('network') || lower.includes('connection refused')) {
            return {
                title: 'Connection Error',
                message: 'Could not reach the server. Please check your internet connection and try again.'
            };
        }

        // If the backend sent a short readable message, show it as-is
        if (rawMessage && rawMessage.trim().length > 0 && rawMessage.trim().length < 200) {
            return { title: 'Registration Not Completed', message: rawMessage.trim() };
        }

        // Generic fallback
        return {
            title: 'Registration Not Completed',
            message: 'We could not complete your registration right now. Please try again in a moment.'
        };
    }
}
