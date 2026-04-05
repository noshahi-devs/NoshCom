import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ProfileComponent } from './profile.component';
import { OrdersComponent } from './orders.component';
import { SettingsComponent } from './settings.component';
import { ReviewPurchasesComponent } from './review-purchases.component';
import { RecentlyViewedComponent } from './recently-viewed.component';

const routes: Routes = [
  { path: '', redirectTo: 'profile', pathMatch: 'full' },
  { path: 'profile', component: ProfileComponent },
  { path: 'orders', component: OrdersComponent },
  { path: 'reviews', component: ReviewPurchasesComponent },
  { path: 'recently-viewed', component: RecentlyViewedComponent },
  { path: 'settings', component: SettingsComponent }
];

@NgModule({
  declarations: [
    ProfileComponent,
    OrdersComponent,
    SettingsComponent,
    ReviewPurchasesComponent,
    RecentlyViewedComponent
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    FormsModule,
    ReactiveFormsModule
  ]
})
export class AccountModule { }
