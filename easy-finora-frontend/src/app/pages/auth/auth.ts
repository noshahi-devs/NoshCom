import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIf, NgFor } from '@angular/common';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { ToastService } from '../../shared/toast/toast.service';
import { AuthService } from '../../services/auth.service';
import { GlobalStateService } from '../../services/global-state.service'; // Import
import { StorageService } from '../../services/storage.service';

@Component({
    selector: 'app-auth',
    imports: [FormsModule, NgIf, NgFor],
    templateUrl: './auth.html',
    styleUrl: './auth.scss',
})
export class Auth implements OnInit {

    // ... (existing properties)
    isSignUp = false;
    isForgotPassword = false;

    // Login form
    loginEmail = '';
    loginPassword = '';
    loginPasswordType = 'password';

    // Signup form
    signupName = '';
    signupEmail = '';
    signupPhone = '';
    signupCountry = '';
    signupPassword = '';
    signupConfirmPassword = '';
    signupPasswordType = 'password';

    isLoading = false;
    rememberMe = false;
    acceptTerms = false;

    // Forgot Password
    resetEmail = '';

    isPendingVerification = false;
    signupSteps = [
        'Validating details',
        'Creating your account',
        'Securing your profile',
        'Sending verification email'
    ];
    signupStepIndex = -1;
    private signupStepTimer: any = null;
    private signupStartAt = 0;
    private signupFinishTimer: any = null;
    private readonly minSignupDurationMs = 5000;

    constructor(
        private router: Router,
        private toastService: ToastService,
        private authService: AuthService,
        private cdr: ChangeDetectorRef,
        private globalState: GlobalStateService, // Inject
        private storage: StorageService
    ) { }

    ngOnInit() {
        // If already logged in, redirect based on role
        if (this.storage.getToken()) {
            this.redirectUser();
        }

        // Set default country to United States
        const defaultCountry = this.countries.find(c => c.code === 'us');
        if (defaultCountry) {
            this.selectCountry(defaultCountry);
        }
    }

    redirectUser() {
        // Check GlobalState for admin role
        if (this.globalState.isAdmin()) {
            this.router.navigate(['/admin-dashboard'], { replaceUrl: true });
        } else {
            this.router.navigate(['/dashboard'], { replaceUrl: true });
        }
    }

    // ... (resetViewState and other methods remain unchanged)
    resetViewState() {
        // ... (lines 61-84 unchanged)
        console.log('🔄 BEFORE resetViewState:', {
            isSignUp: this.isSignUp,
            isForgotPassword: this.isForgotPassword,
            isPendingVerification: this.isPendingVerification,
            isLoading: this.isLoading
        });

        this.isSignUp = false;
        this.isForgotPassword = false;
        this.isPendingVerification = false;
        this.isLoading = false;
        this.stopSignupStepper(false);

        console.log('✅ AFTER resetViewState:', {
            isSignUp: this.isSignUp,
            isForgotPassword: this.isForgotPassword,
            isPendingVerification: this.isPendingVerification,
            isLoading: this.isLoading
        });
        console.log('🎯 Login form should be visible:', !this.isSignUp && !this.isForgotPassword && !this.isPendingVerification);

        // Force Angular to detect changes
        this.cdr.detectChanges();
        console.log('🔄 Change detection triggered');
    }

    // ... (keep sendSampleEmail, toggleMode, toggleForgot, etc.) 
    sendSampleEmail() {
        // Defer to next tick to avoid ExpressionChangedAfterItHasBeenCheckedError
        setTimeout(() => {
            this.isLoading = true;
        }, 0);
        this.authService.sendSampleEmail().subscribe({
            next: () => {
                this.isLoading = false;
                this.toastService.showSuccess('Test email sent to noshahidevelopersinc@gmail.com. Check inbox/spam.');
            },
            error: (err: any) => {
                this.isLoading = false;
                this.toastService.showError(err.error?.error?.message || 'Failed to send sample email');
            }
        });
    }

    toggleMode() {
        console.log('🔀 toggleMode called, current isSignUp:', this.isSignUp);
        if (this.isSignUp) {
            // Switching from signup to login
            console.log('📝 Switching from SIGNUP to LOGIN');
            this.resetViewState();
        } else {
            // Switching from login to signup
            console.log('📝 Switching from LOGIN to SIGNUP');
            this.isSignUp = true;
            this.isForgotPassword = false;
            this.isPendingVerification = false;
            console.log('✅ State after switching to signup:', {
                isSignUp: this.isSignUp,
                isForgotPassword: this.isForgotPassword,
                isPendingVerification: this.isPendingVerification
            });
        }
    }

    toggleForgot() {
        if (this.isForgotPassword) {
            // Switching from forgot password to login
            this.resetViewState();
        } else {
            // Switching from login to forgot password
            this.isForgotPassword = true;
            this.isSignUp = false;
            this.isPendingVerification = false;
        }
    }

    togglePasswordVisibility(field: string) {
        // Logic handled in template via [type] binding for simpler change
    }

    getPasswordStrengthClass(): string {
        const length = this.signupPassword ? this.signupPassword.length : 0;
        if (length === 0) return '';
        if (length < 6) return 'weak';
        if (length < 8) return 'fair';
        if (length < 10) return 'good';
        return 'strong';
    }

    getPasswordStrengthText(): string {
        const strength = this.getPasswordStrengthClass();
        if (!strength) return '';
        switch (strength) {
            case 'weak': return 'Weak';
            case 'fair': return 'Fair';
            case 'good': return 'Good';
            case 'strong': return 'Strong';
            default: return '';
        }
    }

    login() {
        console.log('🔐 LOGIN ATTEMPT');

        // Validation
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!this.loginEmail || !emailPattern.test(this.loginEmail)) {
            this.toastService.showError('Please enter a valid email address');
            return;
        }

        if (!this.loginPassword || this.loginPassword.length < 6) {
            this.toastService.showError('Password must be at least 6 characters');
            return;
        }

        this.isLoading = true;
        this.cdr.detectChanges();

        this.authService.login({
            userNameOrEmailAddress: this.loginEmail,
            password: this.loginPassword,
            rememberClient: this.rememberMe
        }).pipe(
            finalize(() => {
                this.isLoading = false;
                this.cdr.detectChanges();
            })
        ).subscribe({
            next: (res: any) => {
                const accessToken = res?.result?.accessToken;
                const userId = res?.result?.userId;

                if (!accessToken || !userId) {
                    const fallbackMessage = res?.error?.message || res?.result?.message || 'Login failed. Please try again.';
                    this.toastService.showError(fallbackMessage);
                    return;
                }

                // Store token with correct key for auth guard
                this.storage.setAuthSession(accessToken, userId, this.loginEmail, this.rememberMe);
                this.toastService.showModal('Login successful! Welcome back to Easy Finora.', 'LOGIN SUCCESSFUL', 'success');

                // IMPORTANT: For basic login, we might not have roles yet if GlobalState isn't updated.
                // But if they are logging in fresh, we might want to fetch session first OR just default to dashboard.
                // For now, using redirectUser() which checks GlobalState (which might be stale or empty).
                // If empty, it goes to dashboard. This is acceptable for now.
                // The SessionService in the main app will fetch and update roles, so next reload works.
                this.redirectUser();
            },
            error: (err: any) => {
                let errorMessage = err.error?.error?.message || 'Login failed. Please check your credentials.';

                if (err?.status === 500 && !err.error?.error?.message) {
                    errorMessage = 'Login failed. Please try again.';
                }

                // Check for specific error types
                if (errorMessage.toLowerCase().includes('not confirmed') || errorMessage.toLowerCase().includes('not verified')) {
                    this.isPendingVerification = true;
                    this.toastService.showError('Please check your inbox and verify your email before logging in.');
                    return;
                }

                if (errorMessage.toLowerCase().includes('inactive')) {
                    this.toastService.showModal(errorMessage, 'ACCOUNT INACTIVE', 'error');
                    return;
                }

                this.toastService.showError(errorMessage);
            }
        });
    }

    // Country Dropdown Logic
    isCountryDropdownOpen = false;
    countries = [
        { name: 'United States', code: 'us', flag: 'https://flagcdn.com/us.svg' },
        { name: 'United Kingdom', code: 'gb', flag: 'https://flagcdn.com/gb.svg' },
        { name: 'Canada', code: 'ca', flag: 'https://flagcdn.com/ca.svg' },
        { name: 'Australia', code: 'au', flag: 'https://flagcdn.com/au.svg' },
        { name: 'Germany', code: 'de', flag: 'https://flagcdn.com/de.svg' },
        { name: 'France', code: 'fr', flag: 'https://flagcdn.com/fr.svg' },
        { name: 'Japan', code: 'jp', flag: 'https://flagcdn.com/jp.svg' },
        { name: 'China', code: 'cn', flag: 'https://flagcdn.com/cn.svg' },
        { name: 'Brazil', code: 'br', flag: 'https://flagcdn.com/br.svg' },
        { name: 'UAE', code: 'ae', flag: 'https://flagcdn.com/ae.svg' },
        { name: 'Saudi Arabia', code: 'sa', flag: 'https://flagcdn.com/sa.svg' },
        { name: 'Pakistan', code: 'pk', flag: 'https://flagcdn.com/pk.svg' },
        { name: 'India', code: 'in', flag: 'https://flagcdn.com/in.svg' },
        { name: 'Russia', code: 'ru', flag: 'https://flagcdn.com/ru.svg' },
        { name: 'Turkey', code: 'tr', flag: 'https://flagcdn.com/tr.svg' },
        { name: 'Other', code: 'un', flag: 'https://flagcdn.com/un.svg' } // UN flag for other
    ];

    selectedCountryData: any = null; // Store selected object

    toggleCountryDropdown() {
        this.isCountryDropdownOpen = !this.isCountryDropdownOpen;
    }

    selectCountry(country: any) {
        this.signupCountry = country.name;
        this.selectedCountryData = country;
        this.isCountryDropdownOpen = false;
    }

    signup() {
        console.log('📝 SIGNUP ATTEMPT - Current state BEFORE validation:', {
            isSignUp: this.isSignUp,
            isForgotPassword: this.isForgotPassword,
            isPendingVerification: this.isPendingVerification,
            isLoading: this.isLoading,
            signupEmail: this.signupEmail
        });
        console.log('🎯 Login form visibility check:', !this.isSignUp && !this.isForgotPassword && !this.isPendingVerification);

        console.log('Signup process started');
        // Validation
        if (!this.signupName || this.signupName.trim().length < 3) {
            this.toastService.showError('Please enter your full name (minimum 3 characters)');
            return;
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!this.signupEmail || !emailPattern.test(this.signupEmail)) {
            this.toastService.showError('Please enter a valid email address');
            return;
        }

        if (!this.signupPhone) {
            this.toastService.showError('Please enter your phone number');
            return;
        }

        if (!this.signupCountry) {
            this.toastService.showError('Please select your country');
            return;
        }

        if (!this.signupPassword || this.signupPassword.length < 8) {
            this.toastService.showError('Password must be at least 8 characters');
            return;
        }

        if (this.signupPassword !== this.signupConfirmPassword) {
            this.toastService.showError('Passwords do not match!');
            return;
        }

        if (!this.acceptTerms) {
            this.toastService.showError('You must accept the terms and conditions');
            return;
        }

        this.isLoading = true;
        this.startSignupStepper();

        const registerInput = {
            fullName: this.signupName,
            emailAddress: this.signupEmail,
            password: this.signupPassword,
            phoneNumber: this.signupPhone,
            country: this.signupCountry
        };

        console.log('🚀 Calling API with:', registerInput);
        console.log('📊 State BEFORE API call:', {
            isSignUp: this.isSignUp,
            isForgotPassword: this.isForgotPassword,
            isPendingVerification: this.isPendingVerification,
            isLoading: this.isLoading
        });

        this.authService.register(registerInput).subscribe({
            next: (res: any) => {
                console.log('✅ Signup API SUCCESS response:', res);
                console.log('📊 State IMMEDIATELY after API success (before any changes):', {
                    isSignUp: this.isSignUp,
                    isForgotPassword: this.isForgotPassword,
                    isPendingVerification: this.isPendingVerification,
                    isLoading: this.isLoading
                });

                // Clear form
                this.clearSignupForm();

                // Show success message
                this.toastService.showModal('Account created successfully! Please check your email to verify your account.', 'REGISTRATION SUCCESSFUL', 'success');

                console.log('🔄 About to call resetViewState()...');
                this.completeSignupFlow();

                console.log('📊 State AFTER resetViewState:', {
                    isSignUp: this.isSignUp,
                    isForgotPassword: this.isForgotPassword,
                    isPendingVerification: this.isPendingVerification,
                    isLoading: this.isLoading
                });
                console.log('🎯 Final login form visibility:', !this.isSignUp && !this.isForgotPassword && !this.isPendingVerification);
            },
            error: (err: any) => {
                console.error('Signup error:', err);
                this.stopSignupStepper(false);
                this.isLoading = false;
                this.toastService.showError(err.error?.error?.message || 'Registration failed. Please try again.');
            }
        });
    }

    private startSignupStepper() {
        this.stopSignupStepper(false);
        this.signupStartAt = Date.now();
        this.signupStepIndex = 0;
        this.signupStepTimer = setInterval(() => {
            if (!this.isLoading) {
                this.stopSignupStepper(false);
                return;
            }
            if (this.signupStepIndex < this.signupSteps.length - 1) {
                this.signupStepIndex += 1;
                this.cdr.detectChanges();
            }
        }, 1400);
    }

    private stopSignupStepper(markComplete: boolean) {
        if (this.signupStepTimer) {
            clearInterval(this.signupStepTimer);
            this.signupStepTimer = null;
        }
        if (this.signupFinishTimer) {
            clearTimeout(this.signupFinishTimer);
            this.signupFinishTimer = null;
        }
        if (markComplete) {
            this.signupStepIndex = this.signupSteps.length - 1;
        } else {
            this.signupStepIndex = -1;
        }
        this.cdr.detectChanges();
    }

    private completeSignupFlow() {
        const elapsed = Date.now() - this.signupStartAt;
        const remaining = Math.max(this.minSignupDurationMs - elapsed, 0);
        this.signupFinishTimer = setTimeout(() => {
            this.stopSignupStepper(true);
            this.isLoading = false;
            // Reset all view state flags to show login form
            this.resetViewState();
        }, remaining);
    }

    clearSignupForm() {
        this.signupName = '';
        this.signupEmail = '';
        this.signupPhone = '';
        this.signupCountry = '';
        this.signupPassword = '';
        this.signupConfirmPassword = '';
        this.acceptTerms = false;
        this.selectedCountryData = null;
    }

    logout() {
        this.storage.clearAuthSession();
        this.toastService.showModal('Logged out successfully. See you again soon!', 'LOGOUT SUCCESSFUL', 'info');
        this.router.navigate(['/auth'], { replaceUrl: true });
    }

    sendResetLink() {
        if (!this.resetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.resetEmail)) {
            this.toastService.showError('Please enter a valid email address');
            return;
        }

        this.isLoading = true;
        this.authService.forgotPassword(this.resetEmail).subscribe({
            next: () => {
                this.isLoading = false;
                this.toastService.showModal('Reset link sent to ' + this.resetEmail + '. Please check your inbox.', 'RESET LINK SENT', 'success');
                this.toggleForgot(); // Go back to login
            },
            error: (err: any) => {
                this.isLoading = false;
                this.toastService.showError(err.error?.error?.message || 'Failed to send reset link');
            }
        });
    }
}
