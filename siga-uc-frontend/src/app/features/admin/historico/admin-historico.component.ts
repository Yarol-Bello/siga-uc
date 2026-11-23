import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { ConfiguracionService } from '../../../core/services/configuracion.service';

interface FilaAnio {
  anio: number;
  id_alumno: number;
  id_usuario: number;
  id_grado: number | null;
  dni: string;
  nombre_completo: string;
  codigo_estudiante: string;
  condicion: string;
  estado_matricula: string;
  grado: string | null;
  seccion: string | null;
  resultado_promocion: string | null;
  anio_destino_promocion: number | null;
  notas_ad: number;
  notas_a: number;
  notas_b: number;
  notas_c: number;
  total_notas: number;
  total_asistencias: number;
  total_faltas: number;
  porcentaje_asistencia: number | null;
  total_pagado: number;
  deuda_pendiente: number;
  total_pensiones: number;
  pensiones_pagadas: number;
}

interface Consolidado {
  usuario: {
    id_usuario: number;
    dni: string;
    nombre_completo: string;
  };
  anios: FilaAnio[];
  totales: {
    anios: number;
    total_pagado: number;
    deuda_pendiente: number;
    total_notas: number;
    total_pensiones: number;
  };
}

interface Asistencia {
  id_asistencia: number;
  fecha: string;
  dia_semana: string;
  estado: string;
  observacion: string;
  nombre_curso: string;
}

/**
 * Consolidado histórico por estudiante (Fase 6.4).
 * Busca por DNI y muestra una fila por año lectivo, agrupada por id_usuario.
 */
@Component({
  selector: 'app-admin-historico',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-historico.component.html',
  styleUrl: './admin-historico.component.scss',
})
export class AdminHistoricoComponent {
  private http = inject(HttpClient);
  private configuracion = inject(ConfiguracionService);

  anioActivo = this.configuracion.anioLectivo;

  dni = signal('');
  buscando = signal(false);
  error = signal<string | null>(null);
  data = signal<Consolidado | null>(null);

  modalAsistencia = signal(false);
  cargandoAsistencia = signal(false);
  errorAsistencia = signal<string | null>(null);
  asistencias = signal<Asistencia[]>([]);
  alumnoAsistencia = signal<FilaAnio | null>(null);

  buscar(): void {
    const dni = this.dni().trim();

    if (!/^\d{8}$/.test(dni)) {
      this.error.set('Ingrese un DNI de 8 dígitos.');
      return;
    }

    this.buscando.set(true);
    this.error.set(null);
    this.data.set(null);

    this.http
      .get<any>(`${environment.apiUrl}/reportes/consolidado/${dni}`)
      .subscribe({
        next: (res) => {
          if (res.success) this.data.set(res.data);
          this.buscando.set(false);
        },
        error: (err) => {
          this.error.set(
            err.error?.message || 'No se pudo cargar el consolidado.',
          );
          this.buscando.set(false);
        },
      });
  }

  limpiar(): void {
    this.dni.set('');
    this.data.set(null);
    this.error.set(null);
    this.cerrarAsistencia();
  }

  esAnioActivo(fila: FilaAnio): boolean {
    return Number(fila.anio) === Number(this.anioActivo());
  }

  estadoPromocion(fila: FilaAnio): string {
    if (!fila.resultado_promocion) return 'Sin promoción';
    return fila.anio_destino_promocion
      ? `${fila.resultado_promocion} → ${fila.anio_destino_promocion}`
      : fila.resultado_promocion;
  }

  colorPromocion(fila: FilaAnio): string {
    switch (fila.resultado_promocion) {
      case 'PROMOVIDO':
        return 'promo-ok';
      case 'REPITENTE':
        return 'promo-repite';
      case 'EGRESADO':
        return 'promo-egresado';
      case 'RETIRADO':
        return 'promo-retirado';
      case 'PENDIENTE':
        return 'promo-pendiente';
      default:
        return 'promo-sin';
    }
  }

  verAsistencia(fila: FilaAnio): void {
    this.alumnoAsistencia.set(fila);
    this.modalAsistencia.set(true);
    this.cargandoAsistencia.set(true);
    this.errorAsistencia.set(null);
    this.asistencias.set([]);

    this.http
      .get<any>(
        `${environment.apiUrl}/asistencias/alumno/${fila.id_alumno}?anio=${fila.anio}`,
      )
      .subscribe({
        next: (res) => {
          if (res.success) this.asistencias.set(res.data || []);
          this.cargandoAsistencia.set(false);
        },
        error: (err) => {
          this.errorAsistencia.set(
            err.error?.message || 'No se pudo cargar la asistencia.',
          );
          this.cargandoAsistencia.set(false);
        },
      });
  }

  cerrarAsistencia(): void {
    this.modalAsistencia.set(false);
    this.alumnoAsistencia.set(null);
    this.asistencias.set([]);
    this.errorAsistencia.set(null);
  }

  getEstadoTexto(estado: string): string {
    switch (estado) {
      case 'P':
        return 'Presente';
      case 'T':
        return 'Tardanza';
      case 'F':
        return 'Falta';
      default:
        return estado || '-';
    }
  }

  getEstadoClass(estado: string): string {
    switch (estado) {
      case 'P':
        return 'estado-p';
      case 'T':
        return 'estado-t';
      case 'F':
        return 'estado-f';
      default:
        return '';
    }
  }
}
