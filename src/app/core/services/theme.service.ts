import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Theme = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
    private static readonly STORAGE_KEY = 'pim_theme';
    private readonly themeSubject = new BehaviorSubject<Theme>(this.loadTheme());

    readonly theme$ = this.themeSubject.asObservable();

    get currentTheme(): Theme {
        return this.themeSubject.value;
    }

    get isDark(): boolean {
        return this.themeSubject.value === 'dark';
    }

    constructor() {
        this.applyTheme(this.currentTheme);
    }

    toggleTheme(): void {
        const next: Theme = this.isDark ? 'light' : 'dark';
        this.setTheme(next);
    }

    setTheme(theme: Theme): void {
        this.themeSubject.next(theme);
        this.applyTheme(theme);
        this.saveTheme(theme);
    }

    private applyTheme(theme: Theme): void {
        if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('data-theme', theme);
        }
    }

    private loadTheme(): Theme {
        if (typeof window === 'undefined') {
            return 'dark';
        }

        const saved = localStorage.getItem(ThemeService.STORAGE_KEY);
        if (saved === 'light' || saved === 'dark') {
            return saved;
        }

        return 'dark';
    }

    private saveTheme(theme: Theme): void {
        if (typeof window !== 'undefined') {
            localStorage.setItem(ThemeService.STORAGE_KEY, theme);
        }
    }
}
