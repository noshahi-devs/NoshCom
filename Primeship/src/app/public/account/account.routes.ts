import { Routes } from '@angular/router';
import { ProfileComponent } from './profile.component';
import { OrdersComponent } from './orders.component';
import { SettingsComponent } from './settings.component';

export const accountRoutes: Routes = [
  {
    path: '',
    redirectTo: 'profile',
    pathMatch: 'full'
  },
  {
    path: 'profile',
    component: ProfileComponent
  },
  {
    path: 'orders',
    component: OrdersComponent
  },
  {
    path: 'settings',
    component: SettingsComponent
  }
];
