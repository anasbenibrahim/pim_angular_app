import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  BrowserModule,
  provideClientHydration,
  withEventReplay
} from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing-module';
import { App } from './app';
import { AuthPageComponent } from './features/auth/auth-page.component';
import { DashboardPageComponent } from './features/dashboard/dashboard-page.component';
import { DashboardOverviewComponent } from './features/dashboard/components/dashboard-overview/dashboard-overview.component';
import { UsersManagementComponent } from './features/dashboard/components/users-management/users-management.component';
import { VolunteersValidationComponent } from './features/dashboard/components/volunteers-validation/volunteers-validation.component';
import { LiveMapComponent } from './features/dashboard/components/live-map/live-map.component';
import { GeofencingManagementComponent } from './features/dashboard/components/geofencing-management/geofencing-management.component';
import { ProfilePageComponent } from './features/profile/profile-page.component';

@NgModule({
  declarations: [
    App,
    AuthPageComponent,
    DashboardPageComponent,
    DashboardOverviewComponent,
    UsersManagementComponent,
    VolunteersValidationComponent,
    LiveMapComponent,
    GeofencingManagementComponent,
    ProfilePageComponent
  ],
  imports: [BrowserModule, AppRoutingModule, FormsModule, ReactiveFormsModule, HttpClientModule],
  providers: [provideBrowserGlobalErrorListeners(), provideClientHydration(withEventReplay())],
  bootstrap: [App]
})
export class AppModule {}
