import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface Grado {
  id_grado: number;
  nombre_grado: string;
  seccion: string;
}

interface Curso {
  id_curso: number;
  nombre_curso: string;
  area_academica: string;
  horas_semanales: number;
}

interface Docente {
  id_personal: number;
  nombre_completo: string;
  especialidad: string;
  cargo: string;
}

interface Asignacion {
  id_carga: number;
  id_grado: number;
  id_curso: number;
  id_personal: number;
  anio_lectivo: number;
  horas_asignadas: number;
  nombre_grado: string;
  nombre_curso: string;
  area_academica: string;
  docente_nombre_completo: string;
}

/**
 * Módulo de Carga Curricular (Admin)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-admin-carga-curricular',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-carga-curricular.component.html',
  styleUrl: './admin-carga-curricular.component.scss',
})
export class AdminCargaCurricularComponent implements OnInit {
  private http = inject(HttpClient);

  // Estado principal
  cargando = signal(true);
  error = signal<string | null>(null);
  grados = signal<Grado[]>([]);
  cursos = signal<Curso[]>([]);
  docentes = signal<Docente[]>([]);
  asignaciones = signal<Asignacion[]>([]);
  tutorActual = signal<any>(null);

  // Grado seleccionado
  gradoSeleccionado = signal<number | null>(null);

  // Modal asignación
  modalAsignar = signal(false);
  guardando = signal(false);
  errorModal = signal<string | null>(null);
  asignacionEditando = signal<Asignacion | null>(null);
  formAsignar: any = {
    id_curso: '',
    id_personal: '',
    horas_asignadas: 2,
  };

  // Modal tutor
  modalTutor = signal(false);
  tutorSeleccionado = signal<number | null>(null);
  guardandoTutor = signal(false);

  ngOnInit(): void {
    this.cargarGrados();
    this.cargarCursos();
    this.cargarDocentes();
  }

  /**
   * Cargar grados
   */
  cargarGrados(): void {
    this.http.get<any>(`${environment.apiUrl}/grados`).subscribe({
      next: (res) => {
        if (res.success) {
          this.grados.set(res.data);
          if (res.data.length > 0) {
            this.seleccionarGrado(res.data[1].id_grado); // Por defecto 2do Sec
          }
        }
      },
      error: (err) => console.error('Error grados:', err),
    });
  }

  /**
   * Cargar cursos
   */
  cargarCursos(): void {
    this.http.get<any>(`${environment.apiUrl}/cursos`).subscribe({
      next: (res) => {
        if (res.success) this.cursos.set(res.data);
      },
      error: (err) => console.error('Error cursos:', err),
    });
  }

  /**
   * Cargar docentes (personal con rol DOCENTE)
   */
  cargarDocentes(): void {
    this.http.get<any>(`${environment.apiUrl}/personal?id_rol=2&estado=ACTIVO`).subscribe({
      next: (res) => {
        if (res.success) this.docentes.set(res.data);
      },
      error: (err) => console.error('Error docentes:', err),
    });
  }

  /**
   * Seleccionar grado y cargar su carga curricular
   */
  seleccionarGrado(idGrado: number): void {
    this.gradoSeleccionado.set(idGrado);
    this.cargando.set(true);
    this.error.set(null);

    // Cargar asignaciones del grado
    this.http.get<any>(`${environment.apiUrl}/carga-curricular/grado/${idGrado}`).subscribe({
      next: (res) => {
        if (res.success) this.asignaciones.set(res.data);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('Error carga:', err);
        this.error.set('No se pudo cargar la carga curricular');
        this.cargando.set(false);
      },
    });

    // Cargar tutor del grado
    this.http.get<any>(`${environment.apiUrl}/carga-curricular/grado/${idGrado}/tutor`).subscribe({
      next: (res) => {
        if (res.success) this.tutorActual.set(res.data);
      },
      error: () => this.tutorActual.set(null),
    });
  }

  onGradoChange(idGrado: string): void {
    this.seleccionarGrado(Number(idGrado));
  }

  /**
   * Abrir modal de asignación (nueva o edición)
   */
  abrirModalAsignar(asignacion?: Asignacion): void {
    if (asignacion) {
      this.asignacionEditando.set(asignacion);
      this.formAsignar = {
        id_curso: asignacion.id_curso,
        id_personal: asignacion.id_personal,
        horas_asignadas: asignacion.horas_asignadas || 2,
      };
    } else {
      this.asignacionEditando.set(null);
      this.formAsignar = {
        id_curso: '',
        id_personal: '',
        horas_asignadas: 2,
      };
    }
    this.errorModal.set(null);
    this.modalAsignar.set(true);
  }

  cerrarModalAsignar(): void {
    this.modalAsignar.set(false);
    this.asignacionEditando.set(null);
  }

  /**
   * Guardar asignación (crear o editar)
   */
  guardarAsignacion(): void {
    if (!this.formAsignar.id_curso || !this.formAsignar.id_personal) {
      this.errorModal.set('Debe seleccionar un curso y un docente');
      return;
    }

    this.guardando.set(true);
    this.errorModal.set(null);

    const esEdicion = !!this.asignacionEditando();

    if (esEdicion) {
      // Editar
      const payload = {
        id_personal: parseInt(this.formAsignar.id_personal),
        horas_asignadas: parseInt(this.formAsignar.horas_asignadas),
      };

      this.http
        .put<any>(
          `${environment.apiUrl}/carga-curricular/${this.asignacionEditando()!.id_carga}`,
          payload,
        )
        .subscribe({
          next: (res) => {
            this.guardando.set(false);
            if (res.success) {
              alert('✅ Asignación actualizada exitosamente');
              this.cerrarModalAsignar();
              this.seleccionarGrado(this.gradoSeleccionado()!);
            }
          },
          error: (err) => {
            this.guardando.set(false);
            console.error('Error al actualizar:', err);
            this.errorModal.set(err.error?.message || 'Error al actualizar la asignación');
          },
        });
    } else {
      // Crear
      const payload = {
        id_grado: this.gradoSeleccionado(),
        id_curso: parseInt(this.formAsignar.id_curso),
        id_personal: parseInt(this.formAsignar.id_personal),
        anio_lectivo: 2026,
        horas_asignadas: parseInt(this.formAsignar.horas_asignadas),
      };

      this.http.post<any>(`${environment.apiUrl}/carga-curricular`, payload).subscribe({
        next: (res) => {
          this.guardando.set(false);
          if (res.success) {
            alert('✅ Asignación creada exitosamente');
            this.cerrarModalAsignar();
            this.seleccionarGrado(this.gradoSeleccionado()!);
          }
        },
        error: (err) => {
          // ⚠️ IMPORTANTE: Siempre desactivar el loading primero
          this.guardando.set(false);
          console.error('Error al crear:', err);

          // Detectar error de llave duplicada
          const mensaje = err.error?.message || err.message || '';
          if (mensaje.includes('llave duplicada') || mensaje.includes('duplicate key')) {
            this.errorModal.set(
              '⚠️ Este curso ya está asignado a este grado. ' +
                'Usa el botón "Editar" (✏️) en la tabla para cambiar el docente.',
            );
          } else {
            this.errorModal.set(mensaje || 'Error al crear la asignación');
          }
        },
      });
    }
  }

  /**
   * Abrir modal de tutor
   */
  abrirModalTutor(): void {
    this.tutorSeleccionado.set(this.tutorActual()?.id_personal || null);
    this.modalTutor.set(true);
  }

  cerrarModalTutor(): void {
    this.modalTutor.set(false);
  }

  /**
   * Guardar tutor
   */
  guardarTutor(): void {
    if (!this.tutorSeleccionado()) {
      alert('Seleccione un docente');
      return;
    }

    this.guardandoTutor.set(true);

    const payload = {
      id_grado: this.gradoSeleccionado(),
      id_personal: this.tutorSeleccionado(),
      anio_lectivo: 2026,
    };

    this.http.post<any>(`${environment.apiUrl}/carga-curricular/tutor`, payload).subscribe({
      next: (res) => {
        this.guardandoTutor.set(false);
        if (res.success) {
          alert('✅ Tutor asignado');
          this.cerrarModalTutor();
          this.seleccionarGrado(this.gradoSeleccionado()!);
        }
      },
      error: (err) => {
        this.guardandoTutor.set(false);
        alert('Error: ' + (err.error?.message || 'Error al asignar tutor'));
      },
    });
  }

  /**
   * Eliminar asignación
   */
  eliminarAsignacion(a: Asignacion): void {
    if (!confirm(`¿Eliminar la asignación de ${a.nombre_curso}?`)) return;

    this.http.delete<any>(`${environment.apiUrl}/carga-curricular/${a.id_carga}`).subscribe({
      next: (res) => {
        if (res.success) {
          alert('✅ Asignación eliminada');
          this.seleccionarGrado(this.gradoSeleccionado()!);
        }
      },
      error: (err) => alert('Error: ' + (err.error?.message || 'Error al eliminar')),
    });
  }

  /**
   * Obtener clase por área académica
   */
  getAreaClass(area: string): string {
    switch (area) {
      case 'Matemáticas':
        return 'area-mate';
      case 'Lenguaje y Letras':
        return 'area-letras';
      case 'Ciencias Naturales':
        return 'area-ciencias';
      case 'Ciencias Sociales':
        return 'area-sociales';
      default:
        return '';
    }
  }
}
