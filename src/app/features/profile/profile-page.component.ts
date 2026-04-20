import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, UserProfile } from '../../core/services/auth.service';

type ProfileFeedback = { kind: 'success' | 'error'; message: string } | null;

@Component({
  selector: 'app-profile-page',
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.css',
  standalone: false
})
export class ProfilePageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder).nonNullable;

  isLoading = true;
  isSaving = false;
  feedback: ProfileFeedback = null;
  profile: UserProfile | null = null;

  readonly profileForm = this.formBuilder.group({
    nom: ['', [Validators.required, Validators.minLength(2)]],
    prenom: ['', [Validators.required, Validators.minLength(2)]],
    age: [18, [Validators.required, Validators.min(1), Validators.max(150)]]
  });

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadProfile();
  }

  async onSubmit(): Promise<void> {
    this.profileForm.markAllAsTouched();
    if (this.profileForm.invalid) {
      this.feedback = { kind: 'error', message: 'Veuillez corriger les champs invalides.' };
      return;
    }

    this.isSaving = true;
    this.feedback = null;

    try {
      const { nom, prenom, age } = this.profileForm.getRawValue();
      const updated = await this.authService.updateProfile({ nom, prenom, age });
      this.profile = updated;
      this.feedback = { kind: 'success', message: 'Profil mis à jour avec succès.' };
    } catch (error) {
      this.feedback = {
        kind: 'error',
        message: error instanceof Error ? error.message : 'Impossible de mettre à jour le profil.'
      };
    } finally {
      this.isSaving = false;
    }
  }

  goBackToDashboard(): void {
    void this.router.navigate(['/dashboard']);
  }

  roleLabel(): string {
    const role = this.profile?.role;
    if (role === 'ADMIN') {
      return 'Administrateur';
    }
    if (role === 'VOLONTAIRE') {
      return 'Volontaire';
    }
    if (role === 'PATIENT') {
      return 'Patient';
    }
    if (role === 'DOCTOR') {
      return 'Doctor';
    }
    return 'Membre famille';
  }

  private async loadProfile(): Promise<void> {
    this.isLoading = true;
    this.feedback = null;

    try {
      const profile = await this.authService.getCurrentUser();
      this.profile = profile;
      this.profileForm.patchValue({
        nom: profile.nom,
        prenom: profile.prenom,
        age: profile.age ?? 18
      });
    } catch (error) {
      this.feedback = {
        kind: 'error',
        message: error instanceof Error ? error.message : 'Impossible de charger le profil.'
      };
    } finally {
      this.isLoading = false;
    }
  }
}
