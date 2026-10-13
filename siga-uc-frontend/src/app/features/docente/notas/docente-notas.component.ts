import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';

interface Competencia {
  id_competencia: number;
  nombre_competencia: string;
  orden: number;
  calificacion?: string | null;
}

interface AlumnoCalificacion {
  id_alumno: number;
  dni: string;
  nombre_completo: string;
  codigo_estudiante: string;
  calificaciones: Competencia[];
}

interface CursoAsignado {
  id_carga: number;
  id_grado: number;
  nombre_grado: string;
  seccion: string;
  id_curso: number;
  nombre_curso: string;
  area_academica: string;
}

/**
 * Módulo de Registro de Notas del Docente
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-docente-notas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './docente-notas.component.html',
  styleUrl: './docente-notas.component.scss',
})
export class DocenteNotasComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  usuario = this.authService.usuario;

  // Estado
  cargando = signal(true);
  cargandoNotas = signal(false);
  guardando = signal(false);
  error = signal<string | null>(null);
  mensajeExito = signal<string | null>(null);

  cursos = signal<CursoAsignado[]>([]);
  competencias = signal<Competencia[]>([]);
  alumnos = signal<AlumnoCalificacion[]>([]);

  // Selección
  cursoSeleccionado = signal<CursoAsignado | null>(null);
  bimestre = signal<number>(2);

  // Cache de calificaciones modificadas (id_alumno-id_competencia -> valor)
  calificacionesModificadas: { [key: string]: string } = {};

  ngOnInit(): void {
    this.cargarCursos();
  }

  /**
   * Cargar los cursos asignados al docente
   */
  cargarCursos(): void {
    const usuarioActual = this.usuario();
    if (!usuarioActual?.info_adicional?.id_personal) {
      this.error.set('No se encontró el ID del docente');
      this.cargando.set(false);
      return;
    }

    const id_personal = usuarioActual.info_adicional.id_personal;

    this.http.get<any>(`${environment.apiUrl}/carga-curricular/docente/${id_personal}`).subscribe({
      next: (res) => {
        if (res.success) {
          this.cursos.set(res.data);
          // Si hay cursos, seleccionar el primero automáticamente
          if (res.data.length > 0) {
            this.seleccionarCurso(res.data[0]);
          }
        }
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error.set('No se pudieron cargar los cursos');
        this.cargando.set(false);
      },
    });
  }

  /**
   * Seleccionar un curso y cargar sus calificaciones
   */
  seleccionarCurso(curso: CursoAsignado): void {
    this.cursoSeleccionado.set(curso);
    this.calificacionesModificadas = {};
    this.mensajeExito.set(null);
    this.cargarCalificaciones();
  }

  /**
   * Cambiar bimestre
   */
  cambiarBimestre(): void {
    this.calificacionesModificadas = {};
    this.mensajeExito.set(null);
    this.cargarCalificaciones();
  }

  /**
   * Cargar calificaciones del aula
   */
  cargarCalificaciones(): void {
    const curso = this.cursoSeleccionado();
    if (!curso) return;

    this.cargandoNotas.set(true);
    this.error.set(null);

    const url = `${environment.apiUrl}/calificaciones/curso/${curso.id_curso}/grado/${curso.id_grado}?bimestre=${this.bimestre()}`;

    this.http.get<any>(url).subscribe({
      next: (res) => {
        if (res.success) {
          this.competencias.set(res.data.competencias);
          this.alumnos.set(res.data.alumnos);
        }
        this.cargandoNotas.set(false);
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error.set('No se pudieron cargar las calificaciones');
        this.cargandoNotas.set(false);
      },
    });
  }

  /**
   * Cambiar la calificación de un alumno (guarda en cache)
   */
  cambiarCalificacion(idAlumno: number, idCompetencia: number, valor: string): void {
    const key = `${idAlumno}-${idCompetencia}`;
    this.calificacionesModificadas[key] = valor;
    this.mensajeExito.set(null);
  }

  /**
   * Obtener la calificación actual (modificada o guardada)
   */
  getCalificacion(idAlumno: number, competencia: Competencia): string {
    const key = `${idAlumno}-${competencia.id_competencia}`;
    if (this.calificacionesModificadas[key] !== undefined) {
      return this.calificacionesModificadas[key];
    }
    return competencia.calificacion || '';
  }

  /**
   * Contar cuántas notas están modificadas
   */
  get totalModificadas(): number {
    return Object.keys(this.calificacionesModificadas).length;
  }

  /**
   * Guardar todas las calificaciones modificadas (masivo)
   */
  guardarCalificaciones(): void {
    const curso = this.cursoSeleccionado();
    if (!curso) return;

    const total = this.totalModificadas;
    if (total === 0) {
      alert('No hay cambios para guardar');
      return;
    }

    if (!confirm(`¿Guardar ${total} calificacion(es)?`)) return;

    const usuarioActual = this.usuario();
    const id_personal = usuarioActual?.info_adicional?.id_personal;

    // Construir registros
    const registros: any[] = [];
    Object.keys(this.calificacionesModificadas).forEach((key) => {
      const [idAlumno, idCompetencia] = key.split('-').map(Number);
      registros.push({
        id_alumno: idAlumno,
        id_curso: curso.id_curso,
        id_competencia: idCompetencia,
        id_personal,
        id_grado: curso.id_grado,
        bimestre: this.bimestre(),
        anio_lectivo: 2026,
        calificacion: this.calificacionesModificadas[key],
      });
    });

    this.guardando.set(true);
    this.mensajeExito.set(null);

    this.http.post<any>(`${environment.apiUrl}/calificaciones/masivo`, { registros }).subscribe({
      next: (res) => {
        this.guardando.set(false);
        if (res.success) {
          this.mensajeExito.set(`✅ ${res.data.insertados} calificaciones guardadas exitosamente`);
          this.calificacionesModificadas = {};
          // Recargar después de 1.5s
          setTimeout(() => this.cargarCalificaciones(), 1500);
        }
      },
      error: (err) => {
        this.guardando.set(false);
        console.error('❌ Error:', err);
        alert('Error al guardar: ' + (err.error?.message || 'Error desconocido'));
      },
    });
  }

  onCursoChange(idCarga: number): void {
    const curso = this.cursos().find((c) => c.id_carga === Number(idCarga));
    if (curso) {
      this.seleccionarCurso(curso);
    }
  }

  onBimestreChange(bimestre: number): void {
    this.bimestre.set(Number(bimestre));
    this.cambiarBimestre();
  }
}
