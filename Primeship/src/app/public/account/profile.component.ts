import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PROFILE_STYLES } from './profile.styles';

const PROFILE_AVATAR_URL =
  'data:image/svg+xml;charset=UTF-8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="Profile avatar">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f5f7fa" />
          <stop offset="100%" stop-color="#dfe6ec" />
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="80" fill="url(#bg)" />
      <circle cx="80" cy="62" r="28" fill="#74808a" />
      <path d="M40 140c10-25 28-38 40-38s30 13 40 38" fill="#74808a" />
      <circle cx="55" cy="58" r="4" fill="#f4f7fa" opacity="0.8" />
      <circle cx="106" cy="58" r="4" fill="#f4f7fa" opacity="0.8" />
      <path d="M63 74c6 5 28 5 34 0" fill="none" stroke="#f4f7fa" stroke-width="4" stroke-linecap="round" />
    </svg>
  `);

interface AccountNavItem {
  label: string;
  icon: string;
  route: string;
  exact?: boolean;
}

interface WithdrawalMethod {
  title: string;
  subtitle: string;
  reference: string;
  icon: string;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  address: string;
  city: string;
  dobDay: string;
  dobMonth: string;
  dobYear: string;
  gender: string;
  contacts: string;
  investorType: string;
  password: string;
  confirmPassword: string;
}

@Component({
  selector: 'app-profile',
  standalone: false,
  templateUrl: './profile.component.html',
  styles: [PROFILE_STYLES]
})
export class ProfileComponent implements OnInit {
  user: User | null = null;
  profileForm: FormGroup;
  isLoading = false;
  showKycNotice = true;
  readonly profileAvatarUrl = PROFILE_AVATAR_URL;
  readonly accountNavItems: AccountNavItem[] = [
    { label: 'Dashboard', icon: 'fa-solid fa-chart-line', route: '/home' },
    { label: 'My Account', icon: 'fa-solid fa-user', route: '/account/profile', exact: true },
    { label: 'Portfolio', icon: 'fa-solid fa-briefcase', route: '/wishlist' },
    { label: 'Plans', icon: 'fa-solid fa-clipboard-list', route: '/account/reviews' },
    { label: 'Saved', icon: 'fa-solid fa-bookmark', route: '/wishlist' },
    { label: 'Helpdesk', icon: 'fa-solid fa-life-ring', route: '/contact-support' },
    { label: 'Settings', icon: 'fa-solid fa-gear', route: '/account/settings' }
  ];
  readonly withdrawalMethods: WithdrawalMethod[] = [
    {
      title: 'Bank transfer - INR',
      subtitle: 'Local | ********7589',
      reference: 'Primary payout method',
      icon: 'fa-solid fa-pen-to-square'
    },
    {
      title: 'Bank transfer - INR',
      subtitle: 'Local | ********8260',
      reference: 'Backup payout method',
      icon: 'fa-solid fa-pen-to-square'
    }
  ];
  readonly genderOptions = ['Male', 'Female', 'Other'];
  readonly investorTypes = ['Resident Indian Citizen', 'Non-Resident Indian', 'Professional Investor'];

  constructor(
    private fb: FormBuilder
  ) {
    this.profileForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      address: ['', Validators.required],
      city: ['', Validators.required],
      dobDay: ['', [Validators.required, Validators.pattern(/^(0?[1-9]|[12][0-9]|3[01])$/)]],
      dobMonth: ['', [Validators.required, Validators.pattern(/^(0?[1-9]|1[0-2])$/)]],
      dobYear: ['', [Validators.required, Validators.pattern(/^\d{4}$/)]],
      gender: ['', Validators.required],
      contacts: ['', Validators.required],
      investorType: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    this.loadUserProfile();
  }

  private loadUserProfile(): void {
    // TODO: Replace with actual user service.
    // Start with an empty form instead of demo data.
    this.user = null;
    this.profileForm.reset({
      firstName: '',
      lastName: '',
      address: '',
      city: '',
      dobDay: '',
      dobMonth: '',
      dobYear: '',
      gender: '',
      contacts: '',
      investorType: '',
      email: '',
      password: '',
      confirmPassword: ''
    });
  }

  get fullName(): string {
    const firstName = this.profileForm.get('firstName')?.value || this.user?.firstName || '';
    const lastName = this.profileForm.get('lastName')?.value || this.user?.lastName || '';
    return `${firstName} ${lastName}`.trim() || 'My Account';
  }

  get emailValue(): string {
    return this.profileForm.get('email')?.value || this.user?.email || '';
  }

  get avatarInitials(): string {
    const first = (this.profileForm.get('firstName')?.value || this.user?.firstName || '').trim();
    const last = (this.profileForm.get('lastName')?.value || this.user?.lastName || '').trim();
    return `${first.charAt(0)}${last.charAt(0)}`.trim() || 'U';
  }

  passwordMatchValidator(form: AbstractControl): Record<string, boolean> | null {
    const password = form.get('password')?.value;
    const confirmPassword = form.get('confirmPassword')?.value;

    if (!password || !confirmPassword) {
      return null;
    }

    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  onSubmit(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;

    // TODO: Replace with actual user service
    setTimeout(() => {
      const formValue = this.profileForm.value as User;
      this.user = { ...this.user, ...formValue } as User;
      this.profileForm.patchValue({ confirmPassword: formValue.password });
      this.isLoading = false;
      alert('Profile updated successfully!');
    }, 1000);
  }

  resetForm(): void {
    if (this.user) {
      this.profileForm.reset({
        firstName: this.user.firstName,
        lastName: this.user.lastName,
        address: this.user.address,
        city: this.user.city,
        dobDay: this.user.dobDay,
        dobMonth: this.user.dobMonth,
        dobYear: this.user.dobYear,
        gender: this.user.gender,
        contacts: this.user.contacts,
        investorType: this.user.investorType,
        email: this.user.email,
        password: this.user.password,
        confirmPassword: this.user.confirmPassword
      });
      return;
    }

    this.profileForm.reset({
      firstName: '',
      lastName: '',
      address: '',
      city: '',
      dobDay: '',
      dobMonth: '',
      dobYear: '',
      gender: '',
      contacts: '',
      investorType: '',
      email: '',
      password: '',
      confirmPassword: ''
    });
  }

  dismissKycNotice(): void {
    this.showKycNotice = false;
  }

  editDisplayImage(): void {
    alert('Display image editing is not connected yet.');
  }

  editWithdrawalMethod(method: WithdrawalMethod): void {
    alert(`Edit ${method.title}`);
  }

  addWithdrawalMethod(): void {
    alert('Add withdrawal method flow is not connected yet.');
  }
}
