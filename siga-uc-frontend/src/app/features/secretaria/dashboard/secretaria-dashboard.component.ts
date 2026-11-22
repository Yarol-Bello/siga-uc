import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { ConfiguracionService } from '../../../core/services/configuracion.service';

interface Estadisticas {
  recaudado: { total: number; total_pagos: number };
  pendiente: { total_pretickets: number; monto_pendiente: number };
}

interface PreTicket {
  id_preticket: number;
  id_alumno: number;
  monto: string;
  estado: string;
  fecha_emision: string;
  alumno_nombre: string;
  nombre_grado: string;
  concepto_nombre: string;
}

/**
 * Dashboard de Secretaría/Tesorería
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-secretaria-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './secretaria-dashboard.component.html',
  styleUrl: './secretaria-dashboard.component.scss',
})
export class SecretariaDashboardComponent implements OnInit {
  private http = inject(HttpClient);
  private configuracion = inject(ConfiguracionService);
  private router = inject(Router);

  cargando = signal(true);
  error = signal<string | null>(null);
  estadisticas = signal<Estadisticas | null>(null);
  preTickets = signal<PreTicket[]>([]);

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.cargando.set(true);
    this.error.set(null);

    const anioActual = this.configuracion.anioLectivo();
    const mesActual = new Date().getMonth() + 1;

    // Cargar estadísticas
    this.http
      .get<any>(`${environment.apiUrl}/tesoreria/estadisticas?anio=${anioActual}&mes=${mesActual}`)
      .subscribe({
        next: (res) => {
          if (res.success) this.estadisticas.set(res.data);
        },
        error: (err) => console.error('Error estadísticas:', err),
      });

    // Cargar pre-tickets pendientes
    this.http.get<any>(`${environment.apiUrl}/tesoreria/pre-tickets?estado=PENDIENTE`).subscribe({
      next: (res) => {
        if (res.success) this.preTickets.set(res.data);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error pre-tickets:', err);
        this.error.set('No se pudieron cargar los datos.');
        this.cargando.set(false);
      },
    });
  }

  cobrarPreticket(id: number): void {
    const preTicket = this.preTickets().find((pt) => pt.id_preticket === id);
    const queryParams: Record<string, number> = { id_preticket: id };

    if (preTicket?.id_alumno) {
      queryParams['id_alumno'] = preTicket.id_alumno;
    }

    this.router.navigate(['/secretaria/tesoreria'], { queryParams });
  }
}
