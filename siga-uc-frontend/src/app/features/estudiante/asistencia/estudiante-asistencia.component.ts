import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';

interface Curso {
  id_curso: number;
  nombre_curso: string;
  area_academica: string;
}

interface ResumenCurso {
  id_curso: number;
  nombre_curso: string;
  area_academica: string;
  total_presente: string;
  total_tardanza: string;
  total_falta: string;
  total_clases: string;
  porcentaje_asistencia: string;
}

interface Asistencia {
  id_asistencia: number;
  fecha: string;
  dia_semana: string;
  estado: string;
  observacion: string;
  nombre_curso: string;
  docente_registro: string;
}

interface Estadisticas {
  total_registros: string;
  total_presente: string;
  total_tardanza: string;
  total_falta: string;
  total_justificadas: string;
  porcentaje_global: string;
}

/**
 * Módulo de Mi Asistencia (Estudiante)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-estudiante-asistencia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './estudiante-asistencia.component.html',
  styleUrl: './estudiante-asistencia.component.scss',
})
export class EstudianteAsistenciaComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  usuario = this.authService.usuario;

  // Estado
  cargando = signal(true);
  cargandoDetalle = signal(false);
  error = signal<string | null>(null);

  // Datos
  resumenPorCurso = signal<ResumenCurso[]>([]);
  estadisticas = signal<Estadisticas | null>(null);
  asistencias = signal<Asistencia[]>([]);

  // Selección de curso
  cursoSeleccionado = signal<number | null>(null);

  ngOnInit(): void {
    this.cargarResumen();
  }

  /**
   * Cargar resumen general de asistencia
   */
  cargarResumen(): void {
    const usuarioActual = this.usuario();
    if (!usuarioActual?.info_adicional?.id_alumno) {
      this.error.set('No se encontró el ID del alumno');
      this.cargando.set(false);
      return;
    }

    const idAlumno = usuarioActual.info_adicional.id_alumno;
    this.cargando.set(true);
    this.error.set(null);

    this.http.get<any>(`${environment.apiUrl}/asistencias/alumno/${idAlumno}/resumen`).subscribe({
      next: (res) => {
        if (res.success) {
          this.estadisticas.set(res.data.estadisticas);
          this.resumenPorCurso.set(res.data.por_curso);

          // Seleccionar el primer curso automáticamente
          if (res.data.por_curso.length > 0) {
            this.seleccionarCurso(res.data.por_curso[0].id_curso);
          }
        }
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error.set('No se pudo cargar el resumen de asistencia');
        this.cargando.set(false);
      },
    });
  }

  /**
   * Seleccionar un curso para ver su historial
   */
  seleccionarCurso(idCurso: number): void {
    this.cursoSeleccionado.set(idCurso);

    const usuarioActual = this.usuario();
    const idAlumno = usuarioActual?.info_adicional?.id_alumno;
    if (!idAlumno) return;

    this.cargandoDetalle.set(true);

    this.http
      .get<any>(`${environment.apiUrl}/asistencias/alumno/${idAlumno}?id_curso=${idCurso}`)
      .subscribe({
        next: (res) => {
          if (res.success) this.asistencias.set(res.data);
          this.cargandoDetalle.set(false);
        },
        error: (err) => {
          console.error('Error al cargar detalle:', err);
          this.cargandoDetalle.set(false);
        },
      });
  }

  /**
   * Cambiar curso desde el selector
   */
  onCursoChange(idCurso: string | number): void {
    this.seleccionarCurso(Number(idCurso));
  }

  /**
   * Obtener el resumen del curso actual
   */
  get resumenCursoActual(): ResumenCurso | null {
    const cursoId = this.cursoSeleccionado();
    if (!cursoId) return null;
    return this.resumenPorCurso().find((c) => c.id_curso === cursoId) || null;
  }

  /**
   * Obtener clase CSS del estado de asistencia
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
}
