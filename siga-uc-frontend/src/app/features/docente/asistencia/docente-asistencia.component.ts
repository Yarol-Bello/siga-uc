import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';

interface AlumnoAsistencia {
  id_alumno: number;
  dni: string;
  nombre_completo: string;
  codigo_estudiante: string;
  id_asistencia: number | null;
  estado: string | null;
  observacion: string | null;
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
 * Módulo de Control de Asistencia del Docente
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-docente-asistencia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './docente-asistencia.component.html',
  styleUrl: './docente-asistencia.component.scss',
})
export class DocenteAsistenciaComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  usuario = this.authService.usuario;

  // Estado
  cargando = signal(true);
  cargandoLista = signal(false);
  guardando = signal(false);
  error = signal<string | null>(null);
  mensajeExito = signal<string | null>(null);

  cursos = signal<CursoAsignado[]>([]);
  alumnos = signal<AlumnoAsistencia[]>([]);

  // Selección
  cursoSeleccionado = signal<CursoAsignado | null>(null);
  fecha = signal<string>(new Date().toISOString().split('T')[0]);

  // Cache de cambios (id_alumno -> {estado, observacion})
  cambios: { [key: number]: { estado: string; observacion: string } } = {};

  ngOnInit(): void {
    this.cargarCursos();
  }

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

  seleccionarCurso(curso: CursoAsignado): void {
    this.cursoSeleccionado.set(curso);
    this.cambios = {};
    this.mensajeExito.set(null);
    this.cargarAsistencia();
  }

  cambiarFecha(): void {
    this.cambios = {};
    this.mensajeExito.set(null);
    this.cargarAsistencia();
  }

  cargarAsistencia(): void {
    const curso = this.cursoSeleccionado();
    if (!curso) return;

    this.cargandoLista.set(true);
    this.error.set(null);

    const url = `${environment.apiUrl}/asistencias/curso/${curso.id_curso}/fecha/${this.fecha()}?id_grado=${curso.id_grado}`;

    this.http.get<any>(url).subscribe({
      next: (res) => {
        if (res.success) {
          this.alumnos.set(res.data);
        }
        this.cargandoLista.set(false);
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error.set('No se pudo cargar la lista');
        this.cargandoLista.set(false);
      },
    });
  }

  /**
   * Cambiar estado de asistencia (P/T/F)
   */
  cambiarEstado(idAlumno: number, estado: string): void {
    if (!this.cambios[idAlumno]) {
      this.cambios[idAlumno] = { estado: '', observacion: '' };
    }
    this.cambios[idAlumno].estado = estado;
    this.mensajeExito.set(null);
  }

  /**
   * Cambiar observación
   */
  cambiarObservacion(idAlumno: number, observacion: string): void {
    if (!this.cambios[idAlumno]) {
      this.cambios[idAlumno] = { estado: this.getEstado(idAlumno), observacion: '' };
    }
    this.cambios[idAlumno].observacion = observacion;
  }

  /**
   * Obtener estado actual (cambio o guardado)
   */
  getEstado(idAlumno: number): string {
    if (this.cambios[idAlumno]?.estado) {
      return this.cambios[idAlumno].estado;
    }
    const alumno = this.alumnos().find((a) => a.id_alumno === idAlumno);
    return alumno?.estado || '';
  }

  /**
   * Obtener observación actual
   */
  getObservacion(idAlumno: number): string {
    if (this.cambios[idAlumno]?.observacion !== undefined) {
      return this.cambios[idAlumno].observacion;
    }
    const alumno = this.alumnos().find((a) => a.id_alumno === idAlumno);
    return alumno?.observacion || '';
  }

  /**
   * Marcar todos como presentes
   */
  marcarTodosPresentes(): void {
    if (!confirm('¿Marcar a todos los alumnos como PRESENTES?')) return;
    this.alumnos().forEach((alumno) => {
      this.cambiarEstado(alumno.id_alumno, 'P');
    });
  }

  /**
   * Contar cambios
   */
  get totalCambios(): number {
    return Object.keys(this.cambios).length;
  }

  /**
   * Contar por estado (según los cambios o valores guardados)
   */
  contarPorEstado(estado: string): number {
    let total = 0;
    this.alumnos().forEach((alumno) => {
      const estadoActual = this.cambios[alumno.id_alumno]?.estado || alumno.estado;
      if (estadoActual === estado) total++;
    });
    return total;
  }

  /**
   * Guardar asistencia masivamente
   */
  guardarAsistencia(): void {
    const curso = this.cursoSeleccionado();
    if (!curso) return;

    if (this.totalCambios === 0) {
      alert('No hay cambios para guardar');
      return;
    }

    if (!confirm(`¿Guardar la asistencia de ${this.totalCambios} estudiante(s)?`)) return;

    const usuarioActual = this.usuario();
    const id_personal = usuarioActual?.info_adicional?.id_personal;
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const diaSemana = diasSemana[new Date(this.fecha()).getDay()];

    const registros: any[] = [];
    Object.keys(this.cambios).forEach((key) => {
      const idAlumno = Number(key);
      const cambio = this.cambios[idAlumno];
      if (cambio.estado) {
        registros.push({
          id_alumno: idAlumno,
          id_curso: curso.id_curso,
          id_personal,
          id_grado: curso.id_grado,
          fecha: this.fecha(),
          dia_semana: diaSemana,
          estado: cambio.estado,
          observacion: cambio.observacion || null,
        });
      }
    });

    this.guardando.set(true);
    this.mensajeExito.set(null);

    this.http.post<any>(`${environment.apiUrl}/asistencias/masivo`, { registros }).subscribe({
      next: (res) => {
        this.guardando.set(false);
        if (res.success) {
          this.mensajeExito.set(`✅ ${res.data.insertados} asistencias guardadas exitosamente`);
          this.cambios = {};
          setTimeout(() => this.cargarAsistencia(), 1500);
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
    if (curso) this.seleccionarCurso(curso);
  }
}
