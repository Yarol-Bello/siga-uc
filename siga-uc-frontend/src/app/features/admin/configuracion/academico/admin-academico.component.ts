import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfiguracionAdminService } from '../../../../core/services/configuracion-admin.service';

type Seccion = 'areas' | 'cursos' | 'competencias';

/**
 * Catálogo académico: áreas, cursos y competencias (Fase 3 / H76).
 */
@Component({
  selector: 'app-admin-academico',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-academico.component.html',
  styleUrl: './admin-academico.component.scss',
})
export class AdminAcademicoComponent implements OnInit {
  private adminService = inject(ConfiguracionAdminService);

  seccion = signal<Seccion>('areas');
  cargando = signal(true);
  guardando = signal(false);
  error = signal<string | null>(null);
  exito = signal<string | null>(null);

  areas = signal<any[]>([]);
  cursos = signal<any[]>([]);
  competencias = signal<any[]>([]);
  cursoSeleccionado = signal<any | null>(null);
  incluirInactivos = signal(true);

  modalArea = signal(false);
  editandoArea = signal<any | null>(null);
  formArea: any = {};
  errorArea = signal<string | null>(null);

  modalCurso = signal(false);
  editandoCurso = signal<any | null>(null);
  formCurso: any = {};
  errorCurso = signal<string | null>(null);

  modalCompetencia = signal(false);
  editandoCompetencia = signal<any | null>(null);
  formCompetencia: any = {};
  errorCompetencia = signal<string | null>(null);

  modalEliminar = signal(false);
  entidadEliminar = signal<{
    tipo: 'area' | 'curso' | 'competencia';
    id: number;
    nombre: string;
  } | null>(null);
  motivoEliminar = signal('');
  errorEliminar = signal<string | null>(null);

  ngOnInit(): void {
    this.cargarTodo();
  }

  cambiarSeccion(seccion: Seccion): void {
    this.seccion.set(seccion);
    this.error.set(null);
    this.exito.set(null);
  }

  cargarTodo(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.adminService.listarAreas(this.incluirInactivos()).subscribe({
      next: (areas) => {
        if (areas.success) this.areas.set(areas.data || []);
        this.adminService.listarCursosAdmin(this.incluirInactivos()).subscribe({
          next: (cursos) => {
            this.cargando.set(false);
            if (cursos.success) this.cursos.set(cursos.data || []);
            if (this.cursoSeleccionado()) {
              this.cargarCompetencias(this.cursoSeleccionado().id_curso);
            }
          },
          error: (err) => {
            this.cargando.set(false);
            this.error.set(this.mensajeError(err));
          },
        });
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(this.mensajeError(err));
      },
    });
  }

  seleccionarCurso(curso: any): void {
    this.cursoSeleccionado.set(curso);
    this.seccion.set('competencias');
    this.cargarCompetencias(curso.id_curso);
  }

  cargarCompetencias(idCurso: number): void {
    this.adminService
      .listarCompetenciasAdmin(idCurso, this.incluirInactivos())
      .subscribe({
        next: (res) => {
          if (res.success) this.competencias.set(res.data || []);
        },
        error: (err) => this.error.set(this.mensajeError(err)),
      });
  }

  abrirNuevaArea(): void {
    this.editandoArea.set(null);
    this.formArea = { nombre: '', orden: 0, activo: true, motivo: '' };
    this.errorArea.set(null);
    this.modalArea.set(true);
  }

  abrirEditarArea(area: any): void {
    this.editandoArea.set(area);
    this.formArea = {
      nombre: area.nombre,
      orden: area.orden,
      activo: area.activo,
      motivo: '',
    };
    this.errorArea.set(null);
    this.modalArea.set(true);
  }

  guardarArea(): void {
    if (!this.formArea.nombre?.trim()) {
      this.errorArea.set('El nombre es obligatorio.');
      return;
    }
    if (String(this.formArea.motivo || '').trim().length < 10) {
      this.errorArea.set('El motivo debe tener al menos 10 caracteres.');
      return;
    }
    this.guardando.set(true);
    this.errorArea.set(null);
    const payload = { ...this.formArea };
    const peticion = this.editandoArea()
      ? this.adminService.actualizarArea(this.editandoArea().id_area, payload)
      : this.adminService.crearArea(payload);
    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.modalArea.set(false);
        this.exito.set('Área guardada correctamente.');
        this.cargarTodo();
      },
      error: (err) => {
        this.guardando.set(false);
        this.errorArea.set(this.mensajeError(err));
      },
    });
  }

  abrirNuevoCurso(): void {
    this.editandoCurso.set(null);
    this.formCurso = {
      nombre_curso: '',
      area_academica: this.areas().find((a) => a.activo)?.nombre || '',
      horas_semanales: 2,
      orden: 0,
      activo: true,
      descripcion: '',
      motivo: '',
    };
    this.errorCurso.set(null);
    this.modalCurso.set(true);
  }

  abrirEditarCurso(curso: any): void {
    this.editandoCurso.set(curso);
    this.formCurso = {
      nombre_curso: curso.nombre_curso,
      area_academica: curso.area_academica,
      horas_semanales: curso.horas_semanales,
      orden: curso.orden,
      activo: curso.activo,
      descripcion: curso.descripcion || '',
      motivo: '',
    };
    this.errorCurso.set(null);
    this.modalCurso.set(true);
  }

  guardarCurso(): void {
    if (!this.formCurso.nombre_curso?.trim()) {
      this.errorCurso.set('El nombre del curso es obligatorio.');
      return;
    }
    if (!this.formCurso.area_academica) {
      this.errorCurso.set('Seleccione un área académica.');
      return;
    }
    if (String(this.formCurso.motivo || '').trim().length < 10) {
      this.errorCurso.set('El motivo debe tener al menos 10 caracteres.');
      return;
    }
    this.guardando.set(true);
    this.errorCurso.set(null);
    const payload = { ...this.formCurso };
    const peticion = this.editandoCurso()
      ? this.adminService.actualizarCurso(
          this.editandoCurso().id_curso,
          payload,
        )
      : this.adminService.crearCurso(payload);
    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.modalCurso.set(false);
        this.exito.set('Curso guardado correctamente.');
        this.cargarTodo();
      },
      error: (err) => {
        this.guardando.set(false);
        this.errorCurso.set(this.mensajeError(err));
      },
    });
  }

  abrirNuevaCompetencia(): void {
    const curso = this.cursoSeleccionado();
    if (!curso) return;
    const siguiente = Math.max(0, ...this.competencias().map((c) => Number(c.orden) || 0)) + 1;
    this.editandoCompetencia.set(null);
    this.formCompetencia = {
      nombre_competencia: '',
      orden: siguiente,
      activo: true,
      descripcion: '',
      motivo: '',
    };
    this.errorCompetencia.set(null);
    this.modalCompetencia.set(true);
  }

  abrirEditarCompetencia(competencia: any): void {
    this.editandoCompetencia.set(competencia);
    this.formCompetencia = {
      nombre_competencia: competencia.nombre_competencia,
      orden: competencia.orden,
      activo: competencia.activo,
      descripcion: competencia.descripcion || '',
      motivo: '',
    };
    this.errorCompetencia.set(null);
    this.modalCompetencia.set(true);
  }

  guardarCompetencia(): void {
    if (!this.formCompetencia.nombre_competencia?.trim()) {
      this.errorCompetencia.set('El nombre de la competencia es obligatorio.');
      return;
    }
    if (String(this.formCompetencia.motivo || '').trim().length < 10) {
      this.errorCompetencia.set('El motivo debe tener al menos 10 caracteres.');
      return;
    }
    const curso = this.cursoSeleccionado();
    if (!curso) return;

    this.guardando.set(true);
    this.errorCompetencia.set(null);
    const payload = { ...this.formCompetencia };
    const peticion = this.editandoCompetencia()
      ? this.adminService.actualizarCompetencia(
          this.editandoCompetencia().id_competencia,
          payload,
        )
      : this.adminService.crearCompetencia(curso.id_curso, payload);
    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.modalCompetencia.set(false);
        this.exito.set('Competencia guardada correctamente.');
        this.cargarCompetencias(curso.id_curso);
      },
      error: (err) => {
        this.guardando.set(false);
        this.errorCompetencia.set(this.mensajeError(err));
      },
    });
  }

  abrirEliminar(
    tipo: 'area' | 'curso' | 'competencia',
    entidad: any,
  ): void {
    this.entidadEliminar.set({
      tipo,
      id:
        tipo === 'area'
          ? entidad.id_area
          : tipo === 'curso'
            ? entidad.id_curso
            : entidad.id_competencia,
      nombre:
        tipo === 'area'
          ? entidad.nombre
          : tipo === 'curso'
            ? entidad.nombre_curso
            : entidad.nombre_competencia,
    });
    this.motivoEliminar.set('');
    this.errorEliminar.set(null);
    this.modalEliminar.set(true);
  }

  confirmarEliminar(): void {
    const entidad = this.entidadEliminar();
    if (!entidad) return;
    const motivo = this.motivoEliminar().trim();
    if (motivo.length < 10) {
      this.errorEliminar.set('El motivo debe tener al menos 10 caracteres.');
      return;
    }
    this.guardando.set(true);
    this.errorEliminar.set(null);
    const peticion =
      entidad.tipo === 'area'
        ? this.adminService.eliminarArea(entidad.id, motivo)
        : entidad.tipo === 'curso'
          ? this.adminService.eliminarCurso(entidad.id, motivo)
          : this.adminService.eliminarCompetencia(entidad.id, motivo);
    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.modalEliminar.set(false);
        this.entidadEliminar.set(null);
        this.exito.set('Registro eliminado correctamente.');
        if (entidad.tipo === 'competencia' && this.cursoSeleccionado()) {
          this.cargarCompetencias(this.cursoSeleccionado().id_curso);
        } else {
          this.cargarTodo();
        }
      },
      error: (err) => {
        this.guardando.set(false);
        this.errorEliminar.set(this.mensajeError(err));
      },
    });
  }

  totalDependenciasCurso(curso: any): number {
    return (
      Number(curso.total_carga || 0) +
      Number(curso.total_horarios || 0) +
      Number(curso.total_calificaciones || 0) +
      Number(curso.total_notas || 0) +
      Number(curso.total_asistencias || 0) +
      Number(curso.total_competencias || 0)
    );
  }

  puedeEliminarCurso(curso: any): boolean {
    return this.totalDependenciasCurso(curso) === 0;
  }

  puedeEliminarArea(area: any): boolean {
    return Number(area.total_cursos || 0) === 0;
  }

  puedeEliminarCompetencia(competencia: any): boolean {
    return Number(competencia.calificaciones || 0) === 0;
  }

  private mensajeError(err: any): string {
    return (
      err?.error?.message ||
      err?.message ||
      'No se pudo completar la operación. Intente nuevamente.'
    );
  }
}
