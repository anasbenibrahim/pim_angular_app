import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { OfflineSyncIndicatorComponent } from './core/components/offline-sync-indicator/offline-sync-indicator.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  imports: [RouterOutlet, OfflineSyncIndicatorComponent],
  standalone: true,
  styleUrl: './app.css'
})
export class App {}
