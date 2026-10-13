import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';

interface AlumnoFicha {
  id_alumno: number;
  dni: string;
  nombres: string;
  apellidos: string;
  nombre_completo: string;
  fecha_nacimiento: string;
  codigo_estudiante: string;
  nombre_grado: string;
  seccion: string;
  condicion: string;
  estado_matricula: string;
  apoderado_nombre?: string;
  apoderado_telefono?: string;
}

interface Asistencia {
  id_asistencia: number;
  fecha: string;
  dia_semana: string;
  estado: string;
  observacion: string;
  nombre_curso: string;
}

interface NotaFinal {
  id_curso: number;
  nombre_curso: string;
  area_academica: string;
  bimestres: { [key: string]: string };
  conclusion?: string;
}

/**
 * Módulo de Ficha del Estudiante (Docente)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-docente-ficha',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './docente-ficha.component.html',
  styleUrl: './docente-ficha.component.scss',
})
export class DocenteFichaComponent {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  usuario = this.authService.usuario;

  // Búsqueda
  dniBusqueda = signal('');
  buscando = signal(false);
  errorBusqueda = signal<string | null>(null);

  // Datos del alumno
  alumno = signal<AlumnoFicha | null>(null);
  cargandoDatos = signal(false);
  asistencias = signal<Asistencia[]>([]);
  notas = signal<NotaFinal[]>([]);
  resumenAsistencia = signal<any>(null);

  /**
   * Buscar alumno por DNI
   */
  buscarAlumno(): void {
    const dni = this.dniBusqueda().trim();

    if (!dni || dni.length !== 8) {
      this.errorBusqueda.set('Ingrese un DNI de 8 dígitos');
      return;
    }

    this.buscando.set(true);
    this.errorBusqueda.set(null);
    this.alumno.set(null);
    this.asistencias.set([]);
    this.notas.set([]);
    this.resumenAsistencia.set(null);

    this.http.get<any>(`${environment.apiUrl}/alumnos/dni/${dni}`).subscribe({
      next: (res) => {
        if (res.success) {
          this.alumno.set(res.data);
          this.cargarAsistencias(res.data.id_alumno);
          this.cargarNotas(res.data.id_alumno);
          this.cargarResumenAsistencia(res.data.id_alumno);
        }
        this.buscando.set(false);
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.errorBusqueda.set(err.error?.message || 'No se encontró el alumno con ese DNI');
        this.buscando.set(false);
      },
    });
  }

  /**
   * Cargar historial de asistencias
   */
  cargarAsistencias(idAlumno: number): void {
    this.cargandoDatos.set(true);

    this.http.get<any>(`${environment.apiUrl}/asistencias/alumno/${idAlumno}`).subscribe({
      next: (res) => {
        if (res.success) {
          this.asistencias.set(res.data);
        }
        this.cargandoDatos.set(false);
      },
      error: (err) => {
        console.error('Error asistencias:', err);
        this.cargandoDatos.set(false);
      },
    });
  }

  /**
   * Cargar notas finales
   */
  cargarNotas(idAlumno: number): void {
    this.http
      .get<any>(`${environment.apiUrl}/calificaciones/notas-finales/alumno/${idAlumno}`)
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.notas.set(res.data.cursos);
          }
        },
        error: (err) => console.error('Error notas:', err),
      });
  }

  /**
   * Cargar resumen de asistencia
   */
  cargarResumenAsistencia(idAlumno: number): void {
    this.http.get<any>(`${environment.apiUrl}/asistencias/alumno/${idAlumno}/resumen`).subscribe({
      next: (res) => {
        if (res.success) {
          this.resumenAsistencia.set(res.data.estadisticas);
        }
      },
      error: (err) => console.error('Error resumen:', err),
    });
  }

  /**
   * Limpiar búsqueda
   */
  limpiarBusqueda(): void {
    this.dniBusqueda.set('');
    this.alumno.set(null);
    this.asistencias.set([]);
    this.notas.set([]);
    this.resumenAsistencia.set(null);
    this.errorBusqueda.set(null);
  }

  /**
   * Obtener clase CSS para badge de estado
   */
  getEstadoClass(estado: string): string {
    switch (estado) {
      case 'P':
        return 'status-p';
      case 'T':
        return 'status-t';
      case 'F':
        return 'status-f';
      default:
        return '';
    }
  }

  /**
   * Obtener texto del estado
   */
  getEstadoTexto(estado: string): string {
    switch (estado) {
      case 'P':
        return 'Presente';
      case 'T':
        return 'Tardanza';
      case 'F':
        return 'Falta';
      default:
        return '-';
    }
  }

  /**
   * Obtener clase CSS para nota
   */
  getNotaClass(nota: string | undefined): string {
    if (!nota) return 'nota-vacia';
    return 'nota-' + nota.toLowerCase();
  }
}
