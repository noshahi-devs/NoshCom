import { CommonModule } from '@angular/common';
import { Component, signal, ElementRef, ViewChild, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProfileService } from '../../services/profile.service';
import { SessionService } from '../../services/session.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './header.html',
  styleUrls: ['./header.scss']
})
export class Header implements OnInit {
  userDropdown = signal(false);
  cartDropdown = signal(false);
  globeDropdown = signal(false);

  showProfileModal = false;
  user: any = {
    name: 'Loading...',
    email: '',
    phone: '',
    address: '',
    surname: ''
  };

  @ViewChild('navbar', { static: true })
  navbar!: ElementRef<HTMLElement>;

  scrollAmount = 200;

  constructor(
    private profileService: ProfileService,
    private sessionService: SessionService
  ) { }

  ngOnInit() {
    // Load initial session info
    this.sessionService.getCurrentLoginInformations().subscribe({
      next: (res: any) => {
        const u = res.result.user;
        if (u) {
          this.user.name = u.name;
          this.user.surname = u.surname;
          this.user.email = u.emailAddress;

          // Store roles for sidebar and other components
          if (u.roleNames) {
            const roles = JSON.stringify(u.roleNames);
            if (sessionStorage.getItem('authToken')) {
                sessionStorage.setItem('userRoles', roles);
            } else {
                localStorage.setItem('userRoles', roles);
            }
          }
        }
      }
    });
  }

  toggleProfileModal() {
    this.showProfileModal = !this.showProfileModal;
    if (this.showProfileModal) {
      this.fetchFullProfile();
    }
  }

  fetchFullProfile() {
    this.profileService.getMyProfile().subscribe({
      next: (res: any) => {
        // Merge with existing session data or override
        const p = res?.result;
        if (p) {
          // If backend returns extended profile
          // For now it returns CustomerProfileDto
          // Use what we have
        }
      },
      error: (err) => console.error(err)
    });
  }

  scrollLeft() {
    const navbar = document.querySelector('.elicom-navbar');
    if (navbar) navbar.scrollBy({ left: -200, behavior: 'smooth' });
  }

  scrollRight() {
    const navbar = document.querySelector('.elicom-navbar');
    if (navbar) navbar.scrollBy({ left: 200, behavior: 'smooth' });
  }

}
