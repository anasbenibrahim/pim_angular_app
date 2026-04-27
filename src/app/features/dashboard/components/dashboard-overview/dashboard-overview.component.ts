import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit } from '@angular/core';
import { AdminService, AdminUserListItem, UserStats } from '../../../../core/services/admin.service';

interface KpiCard {
  title: string;
  value: string;
  trend: string;
  trendUp: boolean;
  icon: string;
  iconColor: string;
  iconBg: string;
  gradient: string;
}

interface ActivityItem {
  title: string;
  detail: string;
  time: string;
  status: 'success' | 'warning' | 'critical';
  icon: string;
}

interface ChartPoint {
  label: string;
  value: number;
}

interface DonutSegment {
  label: string;
  count: number;
  percentage: number;
  color: string;
}

@Component({
  selector: 'app-dashboard-overview',
  templateUrl: './dashboard-overview.component.html',
  styleUrl: './dashboard-overview.component.css',
  imports: [CommonModule],
  standalone: true
})
export class DashboardOverviewComponent implements OnInit, OnDestroy {
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private readonly requestTimeoutMs = 12000;
  private isDestroyed = false;

  kpis: KpiCard[] = [
    {
      title: 'Patients suivis',
      value: '0',
      trend: 'Données en temps réel',
      trendUp: true,
      icon: 'ri-heart-pulse-line',
      iconColor: '#58a6ff',
      iconBg: 'var(--accent-blue-bg)',
      gradient: 'var(--gradient-card-1)'
    },
    {
      title: 'Volontaires actifs',
      value: '0',
      trend: 'Données en temps réel',
      trendUp: true,
      icon: 'ri-team-line',
      iconColor: '#3fb950',
      iconBg: 'var(--accent-green-bg)',
      gradient: 'var(--gradient-card-2)'
    },
    {
      title: 'Membres famille',
      value: '0',
      trend: 'Données en temps réel',
      trendUp: true,
      icon: 'ri-home-heart-line',
      iconColor: '#f7a44c',
      iconBg: 'var(--accent-orange-bg)',
      gradient: 'var(--gradient-card-3)'
    },
    {
      title: 'Doctors',
      value: '0',
      trend: 'Comptes médecins',
      trendUp: true,
      icon: 'ri-stethoscope-line',
      iconColor: '#0ea5a8',
      iconBg: 'color-mix(in srgb, #0ea5a8 16%, var(--bg-card))',
      gradient: 'var(--gradient-card-2)'
    }
  ];

  readonly activities: ActivityItem[] = [
    {
      title: 'Synchronisation backend active',
      detail: 'Les statistiques utilisateurs sont chargées depuis Spring API.',
      time: 'Maintenant',
      status: 'success',
      icon: 'ri-checkbox-circle-line'
    },
    {
      title: 'Suivi des inscriptions',
      detail: 'Les nouveaux utilisateurs apparaissent dans les listes admin.',
      time: 'Temps réel',
      status: 'warning',
      icon: 'ri-line-chart-line'
    },
    {
      title: 'Surveillance accès admin',
      detail: 'Endpoints /api/admin sécurisés par rôle ADMIN.',
      time: 'Sécurisé',
      status: 'critical',
      icon: 'ri-shield-check-line'
    }
  ];

  donutData: DonutSegment[] = [
    { label: 'Patients', count: 0, percentage: 0, color: '#f7a44c' },
    { label: 'Famille', count: 0, percentage: 0, color: '#3b5bdb' },
    { label: 'Volontaires', count: 0, percentage: 0, color: '#3fb950' },
    { label: 'Admins', count: 0, percentage: 0, color: '#f85149' },
    { label: 'Doctors', count: 0, percentage: 0, color: '#0ea5a8' }
  ];

  chartData: ChartPoint[] = [
    { label: 'M-5', value: 0 },
    { label: 'M-4', value: 0 },
    { label: 'M-3', value: 0 },
    { label: 'M-2', value: 0 },
    { label: 'M-1', value: 0 },
    { label: 'M', value: 0 }
  ];

  isLoading = false;
  statsError = '';
  lastUpdated = '';
  maxChartValue = 1;

  constructor(
    private readonly adminService: AdminService,
    private readonly ngZone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {}

  async ngOnInit(): Promise<void> {
    this.recomputeChartMax();
    this.buildDonutOffsets();
    await this.loadStats();
    this.refreshTimer = setInterval(() => {
      void this.loadStats(false);
    }, 10000);
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  barHeight(value: number): number {
    return (value / this.maxChartValue) * 100;
  }

  getDonutDashArray(percentage: number): string {
    const circumference = 2 * Math.PI * 45;
    const dashLength = (percentage / 100) * circumference;
    return `${dashLength} ${circumference - dashLength}`;
  }

  getDonutOffset(index: number): number {
    const circumference = 2 * Math.PI * 45;
    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += (this.donutData[i].percentage / 100) * circumference;
    }
    return -offset;
  }

  async manualRefresh(): Promise<void> {
    await this.loadStats();
  }

  private async loadStats(showLoader = true): Promise<void> {
    this.runInAngular(() => {
      if (showLoader) {
        this.isLoading = true;
      }
    });
    try {
      const stats = await this.withTimeout(this.adminService.getUserStats(), this.requestTimeoutMs);
      if (this.isSuspiciousStats(stats)) {
        const fallbackUsers = await this.withTimeout(this.adminService.getAllUsers(), this.requestTimeoutMs);
        this.runInAngular(() => {
          this.applyStats(this.buildStatsFromUsers(fallbackUsers));
        });
      } else {
        this.runInAngular(() => {
          this.applyStats(stats);
        });
      }
      this.runInAngular(() => {
        this.statsError = '';
        this.lastUpdated = new Date().toLocaleTimeString('fr-FR');
      });
    } catch (error) {
      try {
        const fallbackUsers = await this.withTimeout(this.adminService.getAllUsers(), this.requestTimeoutMs);
        this.runInAngular(() => {
          this.applyStats(this.buildStatsFromUsers(fallbackUsers));
          this.statsError = '';
          this.lastUpdated = new Date().toLocaleTimeString('fr-FR');
        });
      } catch (fallbackError) {
        this.runInAngular(() => {
          this.statsError =
            fallbackError instanceof Error
              ? fallbackError.message
              : error instanceof Error
                ? error.message
                : 'Impossible de charger les statistiques.';
        });
      }
    } finally {
      this.runInAngular(() => {
        this.isLoading = false;
      });
    }
  }

  private applyStats(stats: UserStats): void {
    const inferredDoctors = Math.max(
      stats.totalUsers - (stats.totalPatients + stats.totalFamilyMembers + stats.totalVolontaires + stats.totalAdmins),
      0
    );
    const totalDoctors = stats.totalDoctors ?? inferredDoctors;

    this.kpis = [
      {
        ...this.kpis[0],
        value: String(stats.totalPatients),
        trend: `Total utilisateurs: ${stats.totalUsers}`
      },
      {
        ...this.kpis[1],
        value: String(stats.totalVolontaires),
        trend: 'Suivi des volontaires'
      },
      {
        ...this.kpis[2],
        value: String(stats.totalFamilyMembers),
        trend: 'Famille liée aux patients'
      },
      {
        ...this.kpis[3],
        value: String(totalDoctors),
        trend: 'Comptes médecins'
      }
    ];

    this.chartData = stats.monthlyRegistrations.map((point) => ({
      label: point.month,
      value: point.total
    }));

    const total = Math.max(
      stats.totalPatients + stats.totalFamilyMembers + stats.totalVolontaires + stats.totalAdmins + totalDoctors,
      1
    );

    const toPercentage = (count: number): number => Number(((count / total) * 100).toFixed(1));
    this.donutData = [
      {
        label: 'Patients',
        count: stats.totalPatients,
        percentage: toPercentage(stats.totalPatients),
        color: '#f7a44c'
      },
      {
        label: 'Famille',
        count: stats.totalFamilyMembers,
        percentage: toPercentage(stats.totalFamilyMembers),
        color: '#3b5bdb'
      },
      {
        label: 'Volontaires',
        count: stats.totalVolontaires,
        percentage: toPercentage(stats.totalVolontaires),
        color: '#3fb950'
      },
      {
        label: 'Admins',
        count: stats.totalAdmins,
        percentage: toPercentage(stats.totalAdmins),
        color: '#f85149'
      },
      {
        label: 'Doctors',
        count: totalDoctors,
        percentage: toPercentage(totalDoctors),
        color: '#0ea5a8'
      }
    ];

    this.recomputeChartMax();
    this.buildDonutOffsets();
  }

  private recomputeChartMax(): void {
    this.maxChartValue = Math.max(...this.chartData.map((point) => point.value), 1);
  }

  private buildDonutOffsets(): void {
    // used internally
  }

  private isSuspiciousStats(stats: UserStats): boolean {
    const allZeroTotals =
      stats.totalUsers === 0 &&
      stats.totalPatients === 0 &&
      stats.totalFamilyMembers === 0 &&
      stats.totalVolontaires === 0 &&
      stats.totalAdmins === 0 &&
      (stats.totalDoctors ?? 0) === 0;
    return allZeroTotals;
  }

  private buildStatsFromUsers(users: AdminUserListItem[]): UserStats {
    const totalPatients = users.filter((u) => u.role === 'PATIENT').length;
    const totalFamilyMembers = users.filter((u) => u.role === 'FAMILY_MEMBER').length;
    const totalVolontaires = users.filter((u) => u.role === 'VOLONTAIRE').length;
    const totalAdmins = users.filter((u) => u.role === 'ADMIN').length;
    const totalDoctors = users.filter((u) => u.role === 'DOCTOR').length;

    const now = new Date();
    const monthKeys: string[] = [];
    const monthlyMap = new Map<
      string,
      {
        month: string;
        total: number;
        patients: number;
        familyMembers: number;
        volontaires: number;
        admins: number;
        doctors: number;
      }
    >();

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthKeys.push(key);
      monthlyMap.set(key, {
        month: date.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
        total: 0,
        patients: 0,
        familyMembers: 0,
        volontaires: 0,
        admins: 0,
        doctors: 0
      });
    }

    for (const user of users) {
      if (!user.createdAt) {
        continue;
      }
      const created = new Date(user.createdAt);
      if (Number.isNaN(created.getTime())) {
        continue;
      }
      const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
      const point = monthlyMap.get(key);
      if (!point) {
        continue;
      }
      point.total += 1;
      if (user.role === 'PATIENT') point.patients += 1;
      if (user.role === 'FAMILY_MEMBER') point.familyMembers += 1;
      if (user.role === 'VOLONTAIRE') point.volontaires += 1;
      if (user.role === 'ADMIN') point.admins += 1;
      if (user.role === 'DOCTOR') point.doctors += 1;
    }

    return {
      totalUsers: users.length,
      totalPatients,
      totalFamilyMembers,
      totalVolontaires,
      totalAdmins,
      totalDoctors,
      monthlyRegistrations: monthKeys
        .map((key) => monthlyMap.get(key))
        .filter((point): point is NonNullable<typeof point> => point !== undefined)
    };
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error('Timeout de chargement des statistiques.'));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  private runInAngular(fn: () => void): void {
    if (this.isDestroyed) {
      return;
    }
    this.ngZone.run(() => {
      fn();
      this.cdr.detectChanges();
    });
  }
}
