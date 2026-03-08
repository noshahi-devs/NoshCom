import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

@Component({
  selector: 'app-settings',
  standalone: false,
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {
  user: User | null = null;
  notificationForm: FormGroup;
  privacyForm: FormGroup;
  isSaving = false;

  constructor(
    private fb: FormBuilder,
    private router: Router
  ) {
    this.notificationForm = this.fb.group({
      emailNotifications: [true],
      promotionalEmails: [false],
      smsNotifications: [true]
    });

    this.privacyForm = this.fb.group({
      profileVisibility: [false],
      showOrderHistory: [false],
      allowRecommendations: [true]
    });
  }

  ngOnInit(): void {
    this.loadUser();
    this.loadSettings();
  }

  private loadUser(): void {
    // TODO: Replace with actual user service
    this.user = {
      id: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com'
    };
  }

  private loadSettings(): void {
    // TODO: Replace with actual settings service
    this.notificationForm.patchValue({
      emailNotifications: true,
      promotionalEmails: false,
      smsNotifications: true
    });

    this.privacyForm.patchValue({
      profileVisibility: false,
      showOrderHistory: false,
      allowRecommendations: true
    });
  }

  saveNotificationSettings(): void {
    this.isSaving = true;
    
    // TODO: Replace with actual settings service
    setTimeout(() => {
      console.log('Notification settings saved:', this.notificationForm.value);
      this.isSaving = false;
      alert('Notification settings saved successfully!');
    }, 1000);
  }

  savePrivacySettings(): void {
    this.isSaving = true;
    
    // TODO: Replace with actual settings service
    setTimeout(() => {
      console.log('Privacy settings saved:', this.privacyForm.value);
      this.isSaving = false;
      alert('Privacy settings saved successfully!');
    }, 1000);
  }

  exportData(): void {
    // TODO: Implement data export
    console.log('Exporting user data...');
    alert('Your data export will be sent to your email shortly.');
  }

  clearCache(): void {
    // TODO: Implement cache clearing
    console.log('Clearing cache...');
    alert('Cache cleared successfully!');
  }

  confirmDeleteAccount(): void {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      if (confirm('This will permanently delete all your data. Are you absolutely sure?')) {
        // TODO: Implement account deletion
        console.log('Deleting account...');
        alert('Account deletion request submitted. You will receive a confirmation email.');
      }
    }
  }
}
