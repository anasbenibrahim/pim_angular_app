import { isPlatformBrowser } from '@angular/common';
import { AfterViewInit, Component, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import {
  AdminService,
  AdminUserListItem,
  GeoZoneItem,
  GeoZonePayload,
  GeoZoneShapeType,
  GeoZoneType,
  PatientZoneRuleItem,
  PatientZoneRulePayload,
  ZoneEventItem,
  ZoneSeverity
} from '../../../../core/services/admin.service';

declare const L: any;

interface DrawPoint {
  lat: number;
  lon: number;
}

@Component({
  selector: 'app-geofencing-management',
  templateUrl: './geofencing-management.component.html',
  styleUrl: './geofencing-management.component.css',
  standalone: false
})
export class GeofencingManagementComponent implements AfterViewInit, OnDestroy {
  private readonly adminService = inject(AdminService);
  private readonly platformId = inject(PLATFORM_ID);

  private map: any | null = null;
  private zoneLayer: any | null = null;
  private drawLayer: any | null = null;

  loading = false;
  errorMessage = '';
  successMessage = '';

  zones: GeoZoneItem[] = [];
  events: ZoneEventItem[] = [];
  patients: AdminUserListItem[] = [];
  patientRules: PatientZoneRuleItem[] = [];

  selectedPatientId: number | null = null;
  selectedZoneId: number | null = null;
  selectedEventPresence: string | null = null;

  drawShape: GeoZoneShapeType = 'CIRCLE';
  zoneName = '';
  zoneType: GeoZoneType = 'DANGER';
  zoneRadiusMeters = 120;
  zoneDescription = '';

  drawCenter: DrawPoint | null = null;
  drawPolygonPoints: DrawPoint[] = [];
  multiPolygonDraft: DrawPoint[][] = [];

  ruleZoneId: number | null = null;
  ruleSeverity: ZoneSeverity = 'HIGH';
  ruleMinDwellSeconds = 120;
  ruleNotifyFamily = true;
  ruleNotifyVolunteer = true;
  ruleNotifyAdmin = true;
  ruleEnterRadiusMeters: number | null = null;
  ruleExitRadiusMeters: number | null = null;
  ruleMaxAccuracyMeters: number | null = 50;
  editingRuleId: number | null = null;

  async ngAfterViewInit(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.initMap();
    await this.refreshAll();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  async refreshAll(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      const [zones, users, events] = await Promise.all([
        this.adminService.getGeoZones(),
        this.adminService.getAllUsers(),
        this.adminService.getZoneEvents({ resolved: false })
      ]);
      this.zones = zones;
      this.patients = users.filter((u) => u.role === 'PATIENT');
      this.events = events;
      if (this.selectedPatientId != null) {
        await this.loadPatientRules(this.selectedPatientId);
      }
      this.renderZones();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Erreur de chargement geofencing.';
    } finally {
      this.loading = false;
    }
  }

  onShapeChange(): void {
    this.clearDrawing();
  }

  onMapClickCapture(event: any): void {
    if (!this.map || !event?.latlng) return;
    const point: DrawPoint = { lat: Number(event.latlng.lat), lon: Number(event.latlng.lng) };
    if (this.drawShape === 'CIRCLE') {
      this.drawCenter = point;
    } else if (this.drawShape === 'POLYGON' || this.drawShape === 'MULTIPOLYGON') {
      this.drawPolygonPoints = [...this.drawPolygonPoints, point];
    }
    this.renderDrawingPreview();
  }

  undoLastPoint(): void {
    if (this.drawShape === 'CIRCLE') {
      this.drawCenter = null;
    } else if (this.drawPolygonPoints.length > 0) {
      this.drawPolygonPoints = this.drawPolygonPoints.slice(0, -1);
    }
    this.renderDrawingPreview();
  }

  addCurrentPolygonToMultiPolygon(): void {
    if (this.drawShape !== 'MULTIPOLYGON') {
      return;
    }
    if (this.drawPolygonPoints.length < 3) {
      this.errorMessage = 'Chaque polygone du MULTIPOLYGON doit contenir au moins 3 points.';
      return;
    }
    this.errorMessage = '';
    this.multiPolygonDraft = [
      ...this.multiPolygonDraft,
      [...this.drawPolygonPoints],
    ];
    this.drawPolygonPoints = [];
    this.renderDrawingPreview();
  }

  removeDraftPolygon(index: number): void {
    if (index < 0 || index >= this.multiPolygonDraft.length) {
      return;
    }
    this.multiPolygonDraft = this.multiPolygonDraft.filter((_, i) => i !== index);
    this.renderDrawingPreview();
  }

  clearDrawing(): void {
    this.drawCenter = null;
    this.drawPolygonPoints = [];
    this.multiPolygonDraft = [];
    if (this.drawLayer) {
      this.drawLayer.clearLayers();
    }
  }

  async createZoneFromDrawing(): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';
    try {
      if (!this.zoneName.trim()) {
        throw new Error('Le nom de la zone est obligatoire.');
      }
      const payload: GeoZonePayload = {
        name: this.zoneName.trim(),
        type: this.zoneType,
        source: 'MANUAL',
        shapeType: this.drawShape,
        description: this.zoneDescription.trim() || null,
        isActive: true
      };

      if (this.drawShape === 'CIRCLE') {
        if (!this.drawCenter) {
          throw new Error('Clique sur la carte pour définir le centre du cercle.');
        }
        payload.centerLat = this.drawCenter.lat;
        payload.centerLon = this.drawCenter.lon;
        payload.radiusMeters = Math.max(1, this.zoneRadiusMeters);
      } else if (this.drawShape === 'POLYGON') {
        if (this.drawPolygonPoints.length < 3) {
          throw new Error('Au moins 3 points sont requis pour un polygone.');
        }
        payload.polygonCoordinates = this.drawPolygonPoints;
      } else {
        const polygons = [
          ...this.multiPolygonDraft.map((p) => [...p]),
          ...(this.drawPolygonPoints.length >= 3 ? [[...this.drawPolygonPoints]] : []),
        ];
        if (polygons.length === 0) {
          throw new Error('Ajoute au moins un polygone pour créer un MULTIPOLYGON.');
        }
        payload.multiPolygonCoordinates = polygons;
      }

      await this.adminService.createGeoZone(payload);
      this.successMessage = 'Zone créée avec succès.';
      this.zoneName = '';
      this.zoneDescription = '';
      this.clearDrawing();
      await this.refreshAll();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Échec de création de zone.';
    }
  }

  async deleteZone(zoneId: number): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';
    try {
      if (!window.confirm('Supprimer cette zone géofencing ?')) {
        return;
      }
      await this.adminService.deleteGeoZone(zoneId);
      this.successMessage = 'Zone supprimée.';
      if (this.ruleZoneId === zoneId) {
        this.ruleZoneId = null;
      }
      await this.refreshAll();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Échec de suppression de zone.';
    }
  }

  async onPatientChange(patientIdRaw: string): Promise<void> {
    const patientId = Number(patientIdRaw);
    this.selectedPatientId = Number.isFinite(patientId) && patientId > 0 ? patientId : null;
    if (this.selectedPatientId == null) {
      this.patientRules = [];
      return;
    }
    await this.loadPatientRules(this.selectedPatientId);
  }

  async loadPatientRules(patientId: number): Promise<void> {
    try {
      this.patientRules = await this.adminService.getPatientZoneRules(patientId);
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Erreur de chargement des règles.';
    }
  }

  async createPatientRule(): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';
    try {
      if (this.selectedPatientId == null) {
        throw new Error('Sélectionne un patient.');
      }
      if (this.ruleZoneId == null) {
        throw new Error('Sélectionne une zone.');
      }
      const payload: PatientZoneRulePayload = {
        zoneId: this.ruleZoneId,
        severity: this.ruleSeverity,
        minDwellSeconds: Math.max(0, this.ruleMinDwellSeconds),
        notifyFamily: this.ruleNotifyFamily,
        notifyVolunteer: this.ruleNotifyVolunteer,
        notifyAdmin: this.ruleNotifyAdmin,
        maxAccuracyMeters: this.ruleMaxAccuracyMeters,
        enterRadiusMeters: this.ruleEnterRadiusMeters,
        exitRadiusMeters: this.ruleExitRadiusMeters,
        isActive: true
      };
      if (this.editingRuleId == null) {
        await this.adminService.createPatientZoneRule(this.selectedPatientId, payload);
        this.successMessage = 'Règle patient-zone créée.';
      } else {
        await this.adminService.updatePatientZoneRule(this.selectedPatientId, this.editingRuleId, payload);
        this.successMessage = 'Règle patient-zone mise à jour.';
      }
      this.editingRuleId = null;
      await this.loadPatientRules(this.selectedPatientId);
      await this.refreshEvents();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Échec enregistrement règle.';
    }
  }

  startEditRule(rule: PatientZoneRuleItem): void {
    this.editingRuleId = rule.id;
    this.ruleZoneId = rule.zoneId;
    this.ruleSeverity = rule.severity;
    this.ruleMinDwellSeconds = rule.minDwellSeconds;
    this.ruleNotifyFamily = rule.notifyFamily;
    this.ruleNotifyVolunteer = rule.notifyVolunteer;
    this.ruleNotifyAdmin = rule.notifyAdmin;
    this.ruleEnterRadiusMeters = rule.enterRadiusMeters;
    this.ruleExitRadiusMeters = rule.exitRadiusMeters;
    this.ruleMaxAccuracyMeters = rule.maxAccuracyMeters;
  }

  cancelEditRule(): void {
    this.editingRuleId = null;
  }

  async deleteRule(rule: PatientZoneRuleItem): Promise<void> {
    if (this.selectedPatientId == null) return;
    this.errorMessage = '';
    this.successMessage = '';
    try {
      if (!window.confirm(`Supprimer la règle "${rule.zoneName}" ?`)) {
        return;
      }
      await this.adminService.deletePatientZoneRule(this.selectedPatientId, rule.id);
      this.successMessage = 'Règle supprimée.';
      if (this.editingRuleId === rule.id) {
        this.editingRuleId = null;
      }
      await this.loadPatientRules(this.selectedPatientId);
      await this.refreshEvents();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Échec suppression règle.';
    }
  }

  async refreshEvents(): Promise<void> {
    this.errorMessage = '';
    try {
      this.events = await this.adminService.getZoneEvents({
        patientId: this.selectedPatientId ?? undefined,
        resolved: false
      });
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Erreur de chargement des événements.';
    }
  }

  async resolveEvent(event: ZoneEventItem): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';
    try {
      await this.adminService.resolveZoneEvent(event.id, { resolved: true, note: 'Résolu depuis dashboard admin' });
      this.successMessage = 'Événement résolu.';
      await this.refreshEvents();
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Échec de résolution.';
    }
  }

  async checkPresence(event: ZoneEventItem): Promise<void> {
    this.selectedEventPresence = null;
    this.errorMessage = '';
    try {
      const presence = await this.adminService.getZonePresence(event.patientId, event.zoneId);
      const base = presence.inside ? 'Toujours dans la zone' : 'Sorti de la zone';
      const distance = presence.distanceMeters == null ? '' : ` (${Math.round(presence.distanceMeters)}m)`;
      this.selectedEventPresence = `${base}${distance}`;
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Échec du re-check présence.';
    }
  }

  trackZone(_: number, zone: GeoZoneItem): number {
    return zone.id;
  }

  trackRule(_: number, rule: PatientZoneRuleItem): number {
    return rule.id;
  }

  trackEvent(_: number, event: ZoneEventItem): number {
    return event.id;
  }

  private initMap(): void {
    const element = document.getElementById('admin-geofencing-map');
    if (!element || this.map) return;

    this.map = L.map(element, {
      center: [36.8065, 10.1815],
      zoom: 12
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.zoneLayer = L.layerGroup().addTo(this.map);
    this.drawLayer = L.layerGroup().addTo(this.map);

    this.map.on('click', (e: any) => this.onMapClickCapture(e));
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private renderZones(): void {
    if (!this.zoneLayer || !this.map) return;
    this.zoneLayer.clearLayers();
    const bounds: any[] = [];

    for (const zone of this.zones) {
      if (!zone.isActive || !zone.geoJson) continue;
      const parsed = this.parseGeoJson(zone.geoJson);
      if (!parsed) continue;
      const color = this.zoneColor(zone.type);

      if (parsed.type === 'Point') {
        const radius = zone.radiusMeters ?? 120;
        const circle = L.circle([parsed.coordinates[1], parsed.coordinates[0]], {
          radius,
          color,
          fillColor: color,
          fillOpacity: 0.2,
          weight: 2
        }).bindPopup(`<strong>${zone.name}</strong><br/>${zone.type} - ${zone.shapeType}`);
        circle.addTo(this.zoneLayer);
        bounds.push(circle.getBounds());
      } else if (parsed.type === 'Polygon') {
        const latlngs = parsed.coordinates[0].map((p: number[]) => [p[1], p[0]]);
        const polygon = L.polygon(latlngs, {
          color,
          fillColor: color,
          fillOpacity: 0.2,
          weight: 2
        }).bindPopup(`<strong>${zone.name}</strong><br/>${zone.type} - ${zone.shapeType}`);
        polygon.addTo(this.zoneLayer);
        bounds.push(polygon.getBounds());
      } else if (parsed.type === 'MultiPolygon') {
        for (const poly of parsed.coordinates) {
          const latlngs = poly[0].map((p: number[]) => [p[1], p[0]]);
          const polygon = L.polygon(latlngs, {
            color,
            fillColor: color,
            fillOpacity: 0.2,
            weight: 2
          }).bindPopup(`<strong>${zone.name}</strong><br/>${zone.type} - ${zone.shapeType}`);
          polygon.addTo(this.zoneLayer);
          bounds.push(polygon.getBounds());
        }
      }
    }

    if (bounds.length > 0) {
      const all = bounds.reduce((acc, b) => (acc ? acc.extend(b) : b), null);
      if (all) {
        this.map.fitBounds(all.pad(0.2));
      }
    }
  }

  private renderDrawingPreview(): void {
    if (!this.drawLayer) return;
    this.drawLayer.clearLayers();

    if (this.drawShape === 'CIRCLE' && this.drawCenter) {
      L.circle([this.drawCenter.lat, this.drawCenter.lon], {
        radius: Math.max(1, this.zoneRadiusMeters),
        color: '#f9623e',
        fillColor: '#f9623e',
        fillOpacity: 0.18,
        dashArray: '6, 4',
        weight: 2
      }).addTo(this.drawLayer);
      return;
    }

    if (this.drawShape === 'MULTIPOLYGON') {
      for (const draft of this.multiPolygonDraft) {
        const latlngs = draft.map((p) => [p.lat, p.lon]);
        L.polygon(latlngs, {
          color: '#0d6078',
          fillColor: '#0d6078',
          fillOpacity: 0.14,
          weight: 2
        }).addTo(this.drawLayer);
      }
    }

    if ((this.drawShape === 'POLYGON' || this.drawShape === 'MULTIPOLYGON') && this.drawPolygonPoints.length > 0) {
      const latlngs = this.drawPolygonPoints.map((p) => [p.lat, p.lon]);
      if (this.drawPolygonPoints.length >= 3) {
        L.polygon(latlngs, {
          color: '#f9623e',
          fillColor: '#f9623e',
          fillOpacity: 0.18,
          dashArray: '6,4',
          weight: 2
        }).addTo(this.drawLayer);
      } else {
        L.polyline(latlngs, {
          color: '#f9623e',
          dashArray: '6,4',
          weight: 2
        }).addTo(this.drawLayer);
      }
    }
  }

  private parseGeoJson(raw: string): any | null {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private zoneColor(type: GeoZoneType): string {
    if (type === 'SAFE') return '#46c67d';
    if (type === 'CAUTION') return '#f8c929';
    return '#f9623e';
  }
}
