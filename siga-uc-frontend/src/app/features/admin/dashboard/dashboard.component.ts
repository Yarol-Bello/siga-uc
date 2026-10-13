import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface DashboardData {
  total_alumnos: string;
  total_personal: string;
  recaudacion_anual: string;
  pre_tickets_pendientes: string;
  monto_pendiente: string;
  total_retirados: string;
  total_grados: string;
  total_cursos: string;
}

/**
 * Dashboard Ejecutivo del Administrador
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private http = inject(HttpClient);

  // Estado
  cargando = signal(true);
  datos = signal<DashboardData | null>(null);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.cargarDashboard();
  }

  /**
   * Cargar datos del dashboard desde el backend
   */
  cargarDashboard(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.http.get<any>(`${environment.apiUrl}/reportes/dashboard`).subscribe({
      next: (response) => {
        if (response.success) {
          this.datos.set(response.data);
        }
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('❌ Error al cargar dashboard:', err);
        this.error.set('No se pudieron cargar los datos del dashboard.');
        this.cargando.set(false);
      },
    });
  }
}
