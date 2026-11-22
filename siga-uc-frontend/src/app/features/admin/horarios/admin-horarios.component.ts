import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  CargaHorario,
  GradoHorario,
  HorarioBloque,
  HorarioService,
  PeriodoClase,
  ResultadoGeneracion,
} from '../../../core/services/horario.service';
import { ConfiguracionService } from '../../../core/services/configuracion.service';
import {
  CeldaHorario,
  HorarioGridComponent,
} from '../../../shared/components/horario-grid/horario-grid.component';

interface FormBloque {
  id_carga: number | null;
  dia_semana: string;
  id_periodo: number | null;
  aula: string;
}

interface FormPeriodo {
  id_periodo: number | null;
  nombre: string;
  orden: number | null;
  hora_inicio: string;
  hora_fin: string;
  tipo: 'CLASE' | 'RECREO' | 'ALMUERZO';
  activo: boolean;
}

@Component({
  selector: 'app-admin-horarios',
  standalone: true,
  imports: [CommonModule, FormsModule, HorarioGridComponent],
  templateUrl: './admin-horarios.component.html',
  styleUrl: './admin-horarios.component.scss',
})
export class AdminHorariosComponent implements OnInit {
  private horarioService = inject(HorarioService);
  private configuracion = inject(ConfiguracionService);

  readonly anioActivo = this.configuracion.anioLectivo;
  readonly anios = computed(() => {
    const actual = this.anioActivo();
    return [actual, actual - 1, actual - 2];
  });

  anioSeleccionado = signal(this.anioActivo());
  gradoSeleccionado = signal<number | null>(null);
  grados = signal<GradoHorario[]>([]);
  periodos = signal<PeriodoClase[]>([]);
  bloques = signal<HorarioBloque[]>([]);
  cargas = signal<CargaHorario[]>([]);
  resumen = signal({ total: 0, publicados: 0, borradores: 0 });

  cargando = signal(true);
  guardando = signal(false);
  generando = signal(false);
  publicando = signal(false);
  error = signal<string | null>(null);
  mensaje = signal<string | null>(null);
  advertencias = signal<string[]>([]);
  resultadoGeneracion = signal<ResultadoGeneracion | null>(null);

  esAnioActivo = computed(
    () => Number(this.anioSeleccionado()) === Number(this.anioActivo()),
  );
  puedeEditar = computed(() => this.esAnioActivo());

  modalBloque = signal(false);
  bloqueEditando = signal<HorarioBloque | null>(null);
  errorModal = signal<string | null>(null);
  formBloque: FormBloque = this.formBloqueVacio();

  modalPeriodos = signal(false);
  periodoEditando = signal<PeriodoClase | null>(null);
  errorPeriodo = signal<string | null>(null);
  formPeriodo: FormPeriodo = this.formPeriodoVacio();

  ngOnInit(): void {
    this.cargarGrados();
  }

  private formBloqueVacio(): FormBloque {
    return {
      id_carga: null,
      dia_semana: 'Lunes',
      id_periodo: null,
      aula: '',
    };
  }

  private formPeriodoVacio(): FormPeriodo {
    return {
      id_periodo: null,
      nombre: '',
      orden: null,
      hora_inicio: '',
      hora_fin: '',
      tipo: 'CLASE',
      activo: true,
    };
  }

  onAnioChange(valor: string | number): void {
    this.anioSeleccionado.set(Number(valor));
    this.resultadoGeneracion.set(null);
    this.advertencias.set([]);
    this.cargarGrados();
  }

  onGradoChange(valor: string | number): void {
    this.gradoSeleccionado.set(Number(valor));
    this.resultadoGeneracion.set(null);
    this.advertencias.set([]);
    this.cargarDatos();
  }

  cargarGrados(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.horarioService.listarGrados(this.anioSeleccionado()).subscribe({
      next: (res) => {
        const grados = res?.data || [];
        this.grados.set(grados);
        if (grados.length === 0) {
          this.gradoSeleccionado.set(null);
          this.periodos.set([]);
          this.bloques.set([]);
          this.resumen.set({ total: 0, publicados: 0, borradores: 0 });
          this.cargando.set(false);
          return;
        }
        const actual = grados.some(
          (g: GradoHorario) => g.id_grado === this.gradoSeleccionado(),
        )
          ? this.gradoSeleccionado()
          : grados[0].id_grado;
        this.gradoSeleccionado.set(actual);
        this.cargarDatos();
      },
      error: (err) => {
        this.error.set(this.mensajeError(err));
        this.cargando.set(false);
      },
    });
  }

  cargarDatos(): void {
    const idGrado = this.gradoSeleccionado();
    if (!idGrado) {
      this.cargando.set(false);
      return;
    }

    this.cargando.set(true);
    this.error.set(null);

    forkJoin({
      horario: this.horarioService.listar(
        this.anioSeleccionado(),
        idGrado,
      ),
      cargas: this.horarioService.listarCargas(
        this.anioSeleccionado(),
        idGrado,
      ),
    }).subscribe({
      next: ({ horario, cargas }) => {
        this.periodos.set(horario?.data?.periodos || []);
        this.bloques.set(horario?.data?.bloques || []);
        this.resumen.set(
          horario?.data?.resumen || {
            total: 0,
            publicados: 0,
            borradores: 0,
          },
        );
        this.cargas.set(cargas?.data || []);
        this.cargando.set(false);
      },
      error: (err) => {
        this.error.set(this.mensajeError(err));
        this.cargando.set(false);
      },
    });
  }

  abrirCelda(celda: CeldaHorario): void {
    if (!this.puedeEditar()) return;
    if (!celda.periodo.activo && !celda.bloque) {
      this.error.set('El período seleccionado está inactivo.');
      return;
    }
    this.errorModal.set(null);
    this.bloqueEditando.set(celda.bloque);
    if (celda.bloque) {
      this.formBloque = {
        id_carga: celda.bloque.id_carga,
        dia_semana: celda.bloque.dia_semana,
        id_periodo: celda.bloque.id_periodo,
        aula: celda.bloque.aula || '',
      };
    } else {
      this.formBloque = {
        id_carga: null,
        dia_semana: celda.dia,
        id_periodo: celda.periodo.id_periodo,
        aula: '',
      };
    }
    this.modalBloque.set(true);
  }

  nuevoBloque(): void {
    if (!this.puedeEditar()) return;
    const periodo = this.periodos().find((p) => p.tipo === 'CLASE' && p.activo);
    if (!periodo) {
      this.error.set('No hay un período de clase activo para crear bloques.');
      return;
    }
    this.errorModal.set(null);
    this.bloqueEditando.set(null);
    this.formBloque = {
      id_carga: null,
      dia_semana: 'Lunes',
      id_periodo: periodo.id_periodo,
      aula: '',
    };
    this.modalBloque.set(true);
  }

  cerrarModalBloque(): void {
    if (this.guardando()) return;
    this.modalBloque.set(false);
    this.errorModal.set(null);
  }

  guardarBloque(): void {
    if (!this.formBloque.id_carga || !this.formBloque.id_periodo) {
      this.errorModal.set('Seleccione una carga y un período.');
      return;
    }

    let confirmar = false;
    if (this.resumen().publicados > 0) {
      confirmar = confirm(
        'El horario de este grado está publicado. Si continúa, todo el grado volverá a BORRADOR y los estudiantes dejarán de verlo hasta que lo publique de nuevo. ¿Continuar?',
      );
      if (!confirmar) return;
    }

    const payload = {
      id_carga: Number(this.formBloque.id_carga),
      dia_semana: this.formBloque.dia_semana,
      id_periodo: Number(this.formBloque.id_periodo),
      aula: this.formBloque.aula?.trim() || null,
      confirmar,
    };

    this.guardando.set(true);
    this.errorModal.set(null);

    const peticion = this.bloqueEditando()
      ? this.horarioService.actualizarBloque(
          this.bloqueEditando()!.id_horario,
          payload,
        )
      : this.horarioService.crearBloque(payload);

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.modalBloque.set(false);
        this.mensaje.set('Bloque guardado correctamente.');
        this.cargarDatos();
      },
      error: (err) => {
        this.guardando.set(false);
        this.errorModal.set(this.mensajeError(err));
      },
    });
  }

  eliminarBloque(): void {
    const bloque = this.bloqueEditando();
    if (!bloque) return;
    if (
      !confirm(
        `¿Eliminar el bloque de ${bloque.nombre_curso} (${bloque.dia_semana}, ${bloque.periodo_nombre})?`,
      )
    ) {
      return;
    }

    let confirmar = false;
    if (this.resumen().publicados > 0) {
      confirmar = confirm(
        'El horario está publicado. Al eliminar, todo el grado volverá a BORRADOR. ¿Continuar?',
      );
      if (!confirmar) return;
    }

    this.guardando.set(true);
    this.horarioService
      .eliminarBloque(bloque.id_horario, confirmar)
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.modalBloque.set(false);
          this.mensaje.set('Bloque eliminado.');
          this.cargarDatos();
        },
        error: (err) => {
          this.guardando.set(false);
          this.errorModal.set(this.mensajeError(err));
        },
      });
  }

  generar(forzar = false): void {
    if (!this.puedeEditar() || this.generando()) return;
    if (this.resumen().publicados > 0) {
      this.error.set(
        'Despublique el horario del grado antes de generar uno nuevo.',
      );
      return;
    }
    if (
      !forzar &&
      !confirm(
        'Se reemplazarán los bloques en BORRADOR de este grado. ¿Generar el horario automáticamente?',
      )
    ) {
      return;
    }

    this.generando.set(true);
    this.error.set(null);
    this.mensaje.set(null);

    this.horarioService
      .generar({
        anio: this.anioSeleccionado(),
        id_grado: this.gradoSeleccionado(),
        forzar,
      })
      .subscribe({
        next: (res) => {
          this.generando.set(false);
          const data = res?.data as ResultadoGeneracion;
          this.resultadoGeneracion.set(data);
          this.advertencias.set(data?.advertencias || []);
          this.mensaje.set(
            `Generación completada: ${data?.generados || 0} bloque(s) en BORRADOR.`,
          );
          this.cargarDatos();
        },
        error: (err) => {
          this.generando.set(false);
          const codigo = err?.error?.errors?.codigo;
          if (codigo === 'SOBRECARGA_HORARIO' && !forzar) {
            const detalles = err.error.errors;
            const detalleDocentes = (detalles.docentes || [])
              .filter((d: any) => d.sobrecargado)
              .map(
                (d: any) =>
                  `${d.docente_nombre}: ${d.horas} h / ${d.capacidad} h`,
              )
              .join('\n');
            const detalleGrados = (detalles.grados || [])
              .filter((g: any) => g.sobrecargado)
              .map(
                (g: any) =>
                  `${g.nombre_grado} ${g.seccion}: ${g.horas} h / ${g.capacidad} h`,
              )
              .join('\n');
            this.advertencias.set(
              [detalleDocentes, detalleGrados].filter(Boolean),
            );
            if (
              confirm(
                `${err.error.message}\n\n${detalleDocentes}\n${detalleGrados}\n\n¿Generar de todos modos y dejar las horas sin ubicar?`,
              )
            ) {
              this.generar(true);
            } else {
              this.error.set(err.error.message);
            }
            return;
          }
          this.error.set(this.mensajeError(err));
        },
      });
  }

  publicar(permitirParcial = false): void {
    if (!this.puedeEditar() || this.publicando()) return;
    if (this.resumen().total === 0) {
      this.error.set('No hay bloques para publicar.');
      return;
    }
    if (
      !permitirParcial &&
      !confirm(
        'Se publicará el horario del grado y los estudiantes podrán verlo. ¿Continuar?',
      )
    ) {
      return;
    }

    this.publicando.set(true);
    this.error.set(null);
    this.mensaje.set(null);

    this.horarioService
      .publicar({
        anio: this.anioSeleccionado(),
        id_grado: this.gradoSeleccionado(),
        permitir_parcial: permitirParcial,
      })
      .subscribe({
        next: (res) => {
          this.publicando.set(false);
          this.mensaje.set(
            `Horario publicado${res?.data?.parcial ? ' (parcial)' : ''}.`,
          );
          this.cargarDatos();
        },
        error: (err) => {
          this.publicando.set(false);
          const codigo = err?.error?.errors?.codigo;
          if (codigo === 'HORARIO_INCOMPLETO' && !permitirParcial) {
            const faltantes = err?.error?.errors?.faltantes || [];
            const total = faltantes.reduce(
              (suma: number, f: any) => suma + Number(f.faltan || 0),
              0,
            );
            if (
              confirm(
                `El horario está incompleto: faltan ${total} hora(s). ¿Publicar de todos modos?`,
              )
            ) {
              this.publicar(true);
            } else {
              this.error.set(err.error.message);
            }
            return;
          }
          this.error.set(this.mensajeError(err));
        },
      });
  }

  despublicar(): void {
    if (!this.puedeEditar() || this.publicando()) return;
    if (this.resumen().publicados === 0) {
      this.error.set('El horario del grado no está publicado.');
      return;
    }
    if (
      !confirm(
        'El horario dejará de ser visible para docentes y estudiantes. ¿Despublicar?',
      )
    ) {
      return;
    }

    this.publicando.set(true);
    this.horarioService
      .despublicar({
        anio: this.anioSeleccionado(),
        id_grado: this.gradoSeleccionado(),
      })
      .subscribe({
        next: () => {
          this.publicando.set(false);
          this.mensaje.set('Horario despublicado.');
          this.cargarDatos();
        },
        error: (err) => {
          this.publicando.set(false);
          this.error.set(this.mensajeError(err));
        },
      });
  }

  abrirPeriodos(): void {
    if (!this.puedeEditar()) return;
    this.errorPeriodo.set(null);
    this.periodoEditando.set(null);
    this.formPeriodo = this.formPeriodoVacio();
    this.modalPeriodos.set(true);
  }

  cerrarPeriodos(): void {
    this.modalPeriodos.set(false);
    this.periodoEditando.set(null);
  }

  nuevoPeriodo(): void {
    const maxOrden = this.periodos().reduce(
      (max, p) => Math.max(max, Number(p.orden) || 0),
      0,
    );
    this.periodoEditando.set(null);
    this.formPeriodo = {
      id_periodo: null,
      nombre: '',
      orden: maxOrden + 1,
      hora_inicio: '',
      hora_fin: '',
      tipo: 'CLASE',
      activo: true,
    };
    this.errorPeriodo.set(null);
  }

  editarPeriodo(periodo: PeriodoClase): void {
    this.periodoEditando.set(periodo);
    this.formPeriodo = {
      id_periodo: periodo.id_periodo,
      nombre: periodo.nombre,
      orden: periodo.orden,
      hora_inicio: periodo.hora_inicio.substring(0, 5),
      hora_fin: periodo.hora_fin.substring(0, 5),
      tipo: periodo.tipo,
      activo: periodo.activo,
    };
    this.errorPeriodo.set(null);
  }

  guardarPeriodo(): void {
    if (
      !this.formPeriodo.nombre?.trim() ||
      !this.formPeriodo.orden ||
      !this.formPeriodo.hora_inicio ||
      !this.formPeriodo.hora_fin
    ) {
      this.errorPeriodo.set('Complete nombre, orden y horas del período.');
      return;
    }

    const payload = {
      anio_lectivo: this.anioSeleccionado(),
      nombre: this.formPeriodo.nombre.trim(),
      orden: Number(this.formPeriodo.orden),
      hora_inicio: this.formPeriodo.hora_inicio,
      hora_fin: this.formPeriodo.hora_fin,
      tipo: this.formPeriodo.tipo,
      activo: this.formPeriodo.activo,
    };

    this.guardando.set(true);
    this.errorPeriodo.set(null);
    const peticion = this.periodoEditando()
      ? this.horarioService.actualizarPeriodo(
          this.periodoEditando()!.id_periodo,
          payload,
        )
      : this.horarioService.crearPeriodo(payload);

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.mensaje.set('Malla de períodos actualizada.');
        this.nuevoPeriodo();
        this.cargarDatos();
      },
      error: (err) => {
        this.guardando.set(false);
        this.errorPeriodo.set(this.mensajeError(err));
      },
    });
  }

  eliminarPeriodo(periodo: PeriodoClase): void {
    if (
      !confirm(
        `¿Eliminar el período "${periodo.nombre}"? No se puede si tiene bloques.`,
      )
    ) {
      return;
    }
    this.guardando.set(true);
    this.horarioService.eliminarPeriodo(periodo.id_periodo).subscribe({
      next: () => {
        this.guardando.set(false);
        this.mensaje.set('Período eliminado.');
        this.cargarDatos();
      },
      error: (err) => {
        this.guardando.set(false);
        this.errorPeriodo.set(this.mensajeError(err));
      },
    });
  }

  private mensajeError(err: any): string {
    const codigo = err?.error?.errors?.codigo;
    if (codigo === 'HORARIO_PUBLICADO') {
      return (
        err?.error?.message ||
        'El horario está publicado. Despublíquelo antes de continuar.'
      );
    }
    if (codigo === 'CONFLICTO_DOCENTE' && err?.error?.message) {
      return err.error.message;
    }
    return (
      err?.error?.message ||
      err?.message ||
      'No se pudo completar la operación.'
    );
  }
}
