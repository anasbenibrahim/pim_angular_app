import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, RegisterDoctorPayload, RegisterPayload, UserRole } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';

type FeedbackKind = 'success' | 'error' | 'info';

@Component({
  selector: 'app-auth-page',
  templateUrl: './auth-page.component.html',
  styleUrl: './auth-page.component.css',
  imports: [CommonModule, ReactiveFormsModule],
  standalone: true
})
export class AuthPageComponent implements OnInit, OnDestroy {
  private readonly formBuilder = inject(FormBuilder).nonNullable;
  private readonly themeService = inject(ThemeService);

  @ViewChild('cameraVideo') private cameraVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('captureCanvas') private captureCanvas?: ElementRef<HTMLCanvasElement>;

  isRegisterMode = false;
  registerUserType: 'volunteer' | 'doctor' = 'volunteer';
  showPassword = false;
  registerStep = 1;
  isSubmittingLogin = false;
  isSubmittingRegister = false;

  cinFrontLabel = 'Aucun fichier sélectionné';
  cinBackLabel = 'Aucun fichier sélectionné';
  doctorDiplomasLabel = 'Aucun diplôme sélectionné';
  doctorPhotoLabel = 'Aucune photo sélectionnée';

  isCameraActive = false;
  isCameraReady = false;
  captureError = '';
  capturedFacePreviewUrl = '';

  private cameraStream: MediaStream | null = null;
  private capturedFaceFile: File | null = null;
  private cinFrontFile: File | null = null;
  private cinBackFile: File | null = null;
  private doctorPhotoFile: File | null = null;
  private doctorDiplomaFiles: File[] = [];

  feedback: { kind: FeedbackKind; message: string } | null = null;

  readonly loginForm = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    remember: [false]
  });

  readonly registerForm = this.formBuilder.group({
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    age: [18, [Validators.required, Validators.min(1), Validators.max(150)]],
    phone: ['', [Validators.required, Validators.minLength(8)]],
    cin: ['', [Validators.required, Validators.minLength(8)]],
    city: [''],
    address: [''],
    gender: [''],
    spokenLanguage: [''],
    cnamConventioned: ['YES'],
    insuranceConventioned: ['NO'],
    specialty: [''],
    registrationNumber: [''],
    yearsExperience: [0],
    experienceDetails: [''],
    professionalDetails: [''],
    doctorPhotoName: [''],
    cinFrontName: ['', [Validators.required]],
    cinBackName: ['', [Validators.required]],
    faceCaptured: [false, [Validators.requiredTrue]],
    terms: [false, [Validators.requiredTrue]]
  });

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router
  ) { }

  ngOnInit(): void {
    if (this.authService.isAuthenticated) {
      void this.router.navigate(['/dashboard']);
    }
  }

  ngOnDestroy(): void {
    this.stopCamera();
    this.clearCapturedFace();
  }

  get isDark(): boolean {
    return this.themeService.isDark;
  }

  get isDoctorRegisterMode(): boolean {
    return this.registerUserType === 'doctor';
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  feedbackIcon(kind: FeedbackKind): string {
    if (kind === 'success') return 'ri-checkbox-circle-line';
    if (kind === 'error') return 'ri-error-warning-line';
    return 'ri-information-line';
  }

  showRegisterForm(role: 'volunteer' | 'doctor' = 'volunteer'): void {
    this.isRegisterMode = true;
    this.registerUserType = role;
    this.feedback = null;
    this.registerStep = 1;
    this.stopCamera();
    this.clearCapturedFace();
  }

  setRegisterRole(role: 'volunteer' | 'doctor'): void {
    this.registerUserType = role;
    this.feedback = null;
    this.registerStep = 1;
    this.stopCamera();
    this.clearCapturedFace();
    this.captureError = '';
    this.resetRegisterFiles();
  }

  showLoginForm(clearFeedback = true): void {
    this.isRegisterMode = false;
    if (clearFeedback) {
      this.feedback = null;
    }
    this.registerStep = 1;
    this.stopCamera();
    this.clearCapturedFace();
    this.captureError = '';
    this.registerUserType = 'volunteer';
    this.resetRegisterFiles();
    this.registerForm.controls.faceCaptured.setValue(false);
  }

  async onLogin(role: UserRole): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.feedback = { kind: 'error', message: 'Veuillez corriger les champs du formulaire de connexion.' };
      return;
    }

    this.isSubmittingLogin = true;
    const { email, password, remember } = this.loginForm.getRawValue();
    const result = await this.authService.login({
      email,
      password,
      remember,
      role
    });
    this.isSubmittingLogin = false;

    if (!result.success) {
      this.feedback = { kind: 'error', message: result.message };
      return;
    }

    if (role === 'volunteer') {
      this.feedback = {
        kind: 'info',
        message: 'Connecté comme volontaire. L\'accès est limité aux vues opérationnelles.'
      };
    } else if (role === 'doctor') {
      this.feedback = {
        kind: 'info',
        message: 'Connecté comme doctor. Accès au dashboard et au profil doctor.'
      };
    }

    void this.router.navigate(['/dashboard']);
  }

  goToNextStep(): void {
    const currentControls = this.getStepControlNames(this.registerStep);
    currentControls.forEach((control) => this.registerForm.controls[control].markAsTouched());

    const hasErrors = currentControls.some((control) => this.registerForm.controls[control].invalid);
    if (hasErrors) {
      this.feedback = { kind: 'error', message: 'Complétez les champs requis avant de continuer.' };
      return;
    }

    this.feedback = null;
    this.registerStep = Math.min(this.registerStep + 1, 3);
  }

  goToPreviousStep(): void {
    this.feedback = null;
    if (this.registerStep === 3) {
      this.stopCamera();
    }
    this.registerStep = Math.max(this.registerStep - 1, 1);
  }

  onCinFileSelected(controlName: 'cinFrontName' | 'cinBackName', event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.feedback = { kind: 'error', message: 'Les fichiers CIN doivent être des images.' };
      return;
    }

    this.registerForm.controls[controlName].setValue(file.name);
    this.registerForm.controls[controlName].markAsTouched();

    if (controlName === 'cinFrontName') {
      this.cinFrontLabel = file.name;
      this.cinFrontFile = file;
    } else {
      this.cinBackLabel = file.name;
      this.cinBackFile = file;
    }
  }

  onDoctorDiplomasSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const files = input?.files ? Array.from(input.files) : [];

    if (files.length === 0) {
      return;
    }

    const nonPdfOrImage = files.find((file) => !file.type.startsWith('image/') && file.type !== 'application/pdf');
    if (nonPdfOrImage) {
      this.feedback = {
        kind: 'error',
        message: 'Les diplômes doivent être des images ou des PDF.'
      };
      return;
    }

    this.doctorDiplomaFiles = files;
    this.doctorDiplomasLabel = files.length === 1 ? files[0].name : `${files.length} fichiers sélectionnés`;
  }

  onDoctorPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.feedback = {
        kind: 'error',
        message: 'La photo du doctor doit être une image.'
      };
      return;
    }

    this.doctorPhotoFile = file;
    this.doctorPhotoLabel = file.name;
    this.registerForm.controls.doctorPhotoName.setValue(file.name);
    this.registerForm.controls.doctorPhotoName.markAsTouched();
  }

  onFaceImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.captureError = 'Merci de sélectionner un fichier image valide.';
      return;
    }

    this.captureError = '';
    this.saveCapturedFaceFile(file);
    this.feedback = {
      kind: 'success',
      message: 'Photo faciale importée avec succès.'
    };
    this.stopCamera();
    input.value = '';
  }

  async startFacialCapture(): Promise<void> {
    this.captureError = '';
    this.feedback = null;
    this.registerForm.controls.faceCaptured.setValue(false);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.captureError = 'La caméra n\'est pas disponible sur cet appareil.';
      return;
    }

    try {
      this.stopCamera();
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        },
        audio: false
      });

      this.isCameraActive = true;
      this.isCameraReady = false;
      await this.attachStreamToVideo();
    } catch (error) {
      this.captureError = this.describeCameraError(error);
    }
  }

  async captureFacialPhoto(): Promise<void> {
    const video = this.getVideoElement();
    const canvas = this.getCanvasElement();

    if (!video || !canvas) {
      this.captureError = 'Caméra non prête.';
      return;
    }

    if (!this.isCameraReady) {
      this.captureError = 'Le flux caméra n\'est pas encore prêt. Réessayez dans 1 seconde.';
      return;
    }

    // Prefer direct camera capture when supported by the browser.
    const directBlob = await this.captureWithImageCaptureApi();
    if (directBlob) {
      this.saveCapturedFaceBlob(directBlob);
      return;
    }

    // Wait one frame to avoid blank/black capture when stream has just started.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (width <= 0 || height <= 0) {
      this.captureError = 'Flux vidéo indisponible. Réessayez.';
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      this.captureError = 'Capture impossible.';
      return;
    }

    canvas.width = width;
    canvas.height = height;
    context.drawImage(video, 0, 0, width, height);

    if (this.isFrameMostlyBlack(context, width, height)) {
      this.captureError = 'Image noire détectée. Fermez les autres apps caméra, augmentez la lumière puis réessayez.';
      return;
    }

    canvas.toBlob((blob) => {
      if (!blob) {
        this.captureError = 'La capture a échoué.';
        return;
      }

      this.saveCapturedFaceBlob(blob);
    }, 'image/jpeg', 0.92);
  }

  stopFacialCapture(): void {
    this.stopCamera();
  }

  async onRegister(): Promise<void> {
    if (this.isDoctorRegisterMode) {
      const doctorControls = this.getDoctorControlNames();
      doctorControls.forEach((control) => this.registerForm.controls[control].markAsTouched());
      const hasDoctorErrors = doctorControls.some((control) => this.registerForm.controls[control].invalid);
      const doctorRaw = this.registerForm.getRawValue();
      const hasDoctorMissingValues =
        doctorRaw.firstName.trim() === '' ||
        doctorRaw.lastName.trim() === '' ||
        doctorRaw.email.trim() === '' ||
        doctorRaw.phone.trim() === '' ||
        doctorRaw.city.trim() === '' ||
        doctorRaw.address.trim() === '' ||
        doctorRaw.gender.trim() === '' ||
        doctorRaw.spokenLanguage.trim() === '' ||
        doctorRaw.specialty.trim() === '' ||
        doctorRaw.registrationNumber.trim() === '';

      if (
        hasDoctorErrors ||
        hasDoctorMissingValues ||
        this.doctorDiplomaFiles.length === 0 ||
        !this.registerForm.controls.terms.value
      ) {
        this.feedback = {
          kind: 'error',
          message: 'Le formulaire doctor contient des erreurs. Merci de vérifier les champs et les diplômes.'
        };
        return;
      }
    } else {
      this.registerForm.markAllAsTouched();
      if (this.registerForm.invalid || !this.capturedFaceFile || !this.cinFrontFile || !this.cinBackFile) {
        this.feedback = {
          kind: 'error',
          message: 'Le formulaire contient des erreurs. Merci de vérifier toutes les étapes.'
        };
        return;
      }
    }

    this.isSubmittingRegister = true;
    try {
      const raw = this.registerForm.getRawValue();
      const result = this.isDoctorRegisterMode
        ? await this.authService.registerDoctor({
            firstName: raw.firstName,
            lastName: raw.lastName,
            email: raw.email,
            phone: raw.phone,
            city: raw.city,
            address: raw.address,
            gender: raw.gender,
            spokenLanguage: raw.spokenLanguage,
            cnamConventioned: raw.cnamConventioned === 'NO' ? 'NO' : 'YES',
            insuranceConventioned: raw.insuranceConventioned === 'YES' ? 'YES' : 'NO',
            specialty: raw.specialty,
            registrationNumber: raw.registrationNumber,
            yearsExperience: raw.yearsExperience,
            experienceDetails: raw.experienceDetails,
            professionalDetails: raw.professionalDetails,
            profilePhotoFile: this.doctorPhotoFile,
            diplomas: this.doctorDiplomaFiles
          } as RegisterDoctorPayload)
        : await this.authService.register({
            firstName: raw.firstName,
            lastName: raw.lastName,
            email: raw.email,
            age: raw.age,
            cin: raw.cin,
            phone: raw.phone,
            cinFrontFile: this.cinFrontFile,
            cinBackFile: this.cinBackFile,
            faceImageFile: this.capturedFaceFile
          } as RegisterPayload);

      if (!result.success) {
        this.feedback = { kind: 'error', message: result.message };
        return;
      }

      this.registerForm.reset({
        firstName: '',
        lastName: '',
        email: '',
        age: 18,
        phone: '',
        cin: '',
        city: '',
        address: '',
        gender: '',
        spokenLanguage: '',
        cnamConventioned: 'YES',
        insuranceConventioned: 'NO',
        specialty: '',
        registrationNumber: '',
        yearsExperience: 0,
        experienceDetails: '',
        professionalDetails: '',
        doctorPhotoName: '',
        cinFrontName: '',
        cinBackName: '',
        faceCaptured: false,
        terms: false
      });

      this.showLoginForm(false);
      this.feedback = {
        kind: 'success',
        message: result.message
      };
    } catch (error) {
      this.feedback = {
        kind: 'error',
        message: error instanceof Error ? error.message : 'Une erreur inattendue est survenue.'
      };
    } finally {
      this.isSubmittingRegister = false;
    }
  }

  trackStep(step: number): number {
    return step;
  }

  stepState(step: number): 'active' | 'done' | 'todo' {
    if (step < this.registerStep) {
      return 'done';
    }

    if (step === this.registerStep) {
      return 'active';
    }

    return 'todo';
  }

  private getStepControlNames(step: number): Array<keyof typeof this.registerForm.controls> {
    if (step === 1) {
      return ['firstName', 'lastName', 'email', 'age', 'phone'];
    }

    if (step === 2) {
      return ['cin', 'cinFrontName', 'cinBackName'];
    }

    return ['faceCaptured', 'terms'];
  }

  private getDoctorControlNames(): Array<keyof typeof this.registerForm.controls> {
    return [
      'firstName',
      'lastName',
      'email',
      'phone',
      'city',
      'address',
      'gender',
      'spokenLanguage',
      'cnamConventioned',
      'insuranceConventioned',
      'specialty',
      'registrationNumber',
      'yearsExperience'
    ];
  }

  private resetRegisterFiles(): void {
    this.cinFrontFile = null;
    this.cinBackFile = null;
    this.doctorPhotoFile = null;
    this.doctorDiplomaFiles = [];
    this.cinFrontLabel = 'Aucun fichier sélectionné';
    this.cinBackLabel = 'Aucun fichier sélectionné';
    this.doctorPhotoLabel = 'Aucune photo sélectionnée';
    this.doctorDiplomasLabel = 'Aucun diplôme sélectionné';
  }

  private stopCamera(): void {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => track.stop());
      this.cameraStream = null;
    }

    const video = this.getVideoElement();
    if (video) {
      video.srcObject = null;
    }

    this.isCameraActive = false;
    this.isCameraReady = false;
  }

  private clearCapturedFace(): void {
    if (this.capturedFacePreviewUrl) {
      URL.revokeObjectURL(this.capturedFacePreviewUrl);
      this.capturedFacePreviewUrl = '';
    }
    this.capturedFaceFile = null;
    this.registerForm.controls.faceCaptured.setValue(false);
  }

  private async attachStreamToVideo(): Promise<void> {
    // Ensure video element exists in DOM after *ngIf render.
    const video = await this.waitForVideoElement();

    if (!video || !this.cameraStream) {
      this.captureError = 'Caméra indisponible dans la page. Rechargez la page puis réessayez.';
      this.stopCamera();
      return;
    }

    video.srcObject = this.cameraStream;
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 40));
    void video.play().catch(() => {
      // Ignore here; readiness check below handles failures.
    });

    this.isCameraReady = await this.waitForCameraFrame(video, 6000);
    if (!this.isCameraReady && !this.captureError) {
      this.captureError = 'Flux vidéo non disponible. Vérifiez que la caméra n\'est pas utilisée ailleurs.';
      this.stopCamera();
    }
  }

  private async waitForCameraFrame(video: HTMLVideoElement, timeoutMs = 3000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0) {
        return true;
      }
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 80));
    }
    return false;
  }

  private async captureWithImageCaptureApi(): Promise<Blob | null> {
    const track = this.cameraStream?.getVideoTracks()[0];
    const imageCaptureCtor = (window as unknown as {
      ImageCapture?: new (mediaStreamTrack: MediaStreamTrack) => { takePhoto: () => Promise<Blob> }
    }).ImageCapture;

    if (!track || !imageCaptureCtor) {
      return null;
    }

    try {
      const imageCapture = new imageCaptureCtor(track);
      const blob = await imageCapture.takePhoto();
      return blob.size > 0 ? blob : null;
    } catch {
      return null;
    }
  }

  private isFrameMostlyBlack(context: CanvasRenderingContext2D, width: number, height: number): boolean {
    const sampleWidth = Math.min(width, 32);
    const sampleHeight = Math.min(height, 32);
    const imageData = context.getImageData(0, 0, sampleWidth, sampleHeight).data;

    let brightnessSum = 0;
    const pixelsCount = imageData.length / 4;
    for (let i = 0; i < imageData.length; i += 4) {
      brightnessSum += imageData[i] + imageData[i + 1] + imageData[i + 2];
    }

    const averageBrightness = brightnessSum / (pixelsCount * 3);
    return averageBrightness < 10;
  }

  private saveCapturedFaceBlob(blob: Blob): void {
    const mimeType = blob.type || 'image/jpeg';
    const extension = mimeType.includes('png') ? 'png' : 'jpg';
    const fileName = `volontaire_face_${Date.now()}.${extension}`;
    const file = new File([blob], fileName, { type: mimeType });
    this.saveCapturedFaceFile(file);
    this.feedback = {
      kind: 'success',
      message: 'Photo faciale capturée avec succès.'
    };
    this.stopCamera();
  }

  private async waitForVideoElement(): Promise<HTMLVideoElement | null> {
    const deadline = Date.now() + 2500;
    while (Date.now() < deadline) {
      const video = this.getVideoElement();
      if (video) {
        return video;
      }
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 50));
    }
    return null;
  }

  private getVideoElement(): HTMLVideoElement | null {
    if (this.cameraVideo?.nativeElement) {
      return this.cameraVideo.nativeElement;
    }

    if (typeof document !== 'undefined') {
      return document.getElementById('face-camera-video') as HTMLVideoElement | null;
    }

    return null;
  }

  private getCanvasElement(): HTMLCanvasElement | null {
    if (this.captureCanvas?.nativeElement) {
      return this.captureCanvas.nativeElement;
    }

    if (typeof document !== 'undefined') {
      return document.getElementById('face-capture-canvas') as HTMLCanvasElement | null;
    }

    return null;
  }

  private saveCapturedFaceFile(file: File): void {
    this.clearCapturedFace();
    this.capturedFaceFile = file;
    this.capturedFacePreviewUrl = URL.createObjectURL(file);
    this.registerForm.controls.faceCaptured.setValue(true);
    this.registerForm.controls.faceCaptured.markAsTouched();
    this.captureError = '';
  }

  private describeCameraError(error: unknown): string {
    if (!error || typeof error !== 'object' || !('name' in error)) {
      return 'Impossible d\'accéder à la caméra. Vérifiez les permissions du navigateur.';
    }

    const name = String((error as { name?: string }).name ?? '');
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return 'Accès caméra refusé. Autorisez la caméra dans le navigateur pour ce site.';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return 'Aucune caméra détectée sur cet appareil.';
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return 'Caméra occupée par une autre application (Zoom/Meet/Teams).';
    }
    if (name === 'OverconstrainedError') {
      return 'Configuration caméra non supportée sur cet appareil.';
    }
    if (name === 'SecurityError') {
      return 'Contexte non sécurisé. Utilisez localhost ou HTTPS.';
    }

    return 'Impossible d\'accéder à la caméra. Vérifiez les permissions du navigateur.';
  }
}
