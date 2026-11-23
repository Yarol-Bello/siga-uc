import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ConfiguracionAdminService } from '../../../../core/services/configuracion-admin.service';
import { ConfiguracionService } from '../../../../core/services/configuracion.service';
import { AnioLectivoService } from '../../../../core/services/anio-lectivo.service';
import { HorarioService, PeriodoClase } from '../../../../core/services/horario.service';
import { SelectorAnioComponent } from '../../../../shared/components/selector-anio/selector-anio.component';

/**
 * Jornada, días y límites del año (Fase 4 / H77).
 */
@Component({
  selector: 'app-admin-horario-config',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SelectorAnioComponent],
  templateUrl: './admin-horario-config.component.html',
  styleUrl: './admin-horario-config.component.scss',
})
export class AdminHorarioConfigComponent implements OnInit {
  private adminService = inject(ConfiguracionAdminService);
  private configuracion = inject(ConfiguracionService);
  private anioLectivoService = inject(AnioLectivoService);
  private horarioService = inject(HorarioService);

  readonly diasValidos = [
    'Lunes',
    'Martes',
    'Miércoles',
    'Jueves',
    'Viernes',
    'Sábado',
    'Domingo',
  ];

  anioActivo = this.configuracion.anioLectivo;
  anioSeleccionado = signal(this.anioActivo());
  anios = computed(() =>
    this.anioLectivoService.anios().map((item) => Number(item.anio)),
  );
  esHistorico = computed(
    () => this.anioSeleccionado() !== this.anioActivo(),
  );

  cargando = signal(true);
  guardando = signal(false);
  error = signal<string | null>(null);
  exito = signal<string | null>(null);
  periodos = signal<PeriodoClase[]>([]);
  configuracionAnio = signal<any | null>(null);

  form = {
    dias_clase: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'],
    hora_inicio_jornada: '07:30',
    hora_fin_jornada: '14:30',
    duracion_min_bloque: 45,
    max_bloques_curso_dia: 2,
    horas_default_carga: 2,
  };

  modalGuardar = signal(false);
  motivo = signal('');
  errorModal = signal<string | null>(null);

  ngOnInit(): void {
    this.anioLectivoService.asegurarCargado().catch(() => {});
    this.cargar();
  }

  cambiarAnio(anio: number): void {
    this.anioSeleccionado.set(anio);
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.exito.set(null);
    const anio = this.anioSeleccionado();
    forkJoin({
      configuracion: this.adminService.obtenerHorarioAnio(anio),
      periodos: this.horarioService.listarPeriodos(anio),
    }).subscribe({
      next: ({ configuracion, periodos }) => {
        this.cargando.set(false);
        if (!configuracion.success) {
          this.error.set('No se pudo cargar la jornada.');
          return;
        }
        this.configuracionAnio.set(configuracion.data);
        this.periodos.set(periodos?.data || []);
        this.form = {
          dias_clase: [...(configuracion.data?.dias_clase || [])],
          hora_inicio_jornada: (configuracion.data?.hora_inicio_jornada || '07:30:00').substring(0, 5),
          hora_fin_jornada: (configuracion.data?.hora_fin_jornada || '14:30:00').substring(0, 5),
          duracion_min_bloque: Number(configuracion.data?.duracion_min_bloque || 45),
          max_bloques_curso_dia: Number(configuracion.data?.max_bloques_curso_dia || 2),
          horas_default_carga: Number(configuracion.data?.horas_default_carga || 2),
        };
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(this.mensajeError(err));
      },
    });
  }

  toggleDia(dia: string, marcado: boolean): void {
    if (this.esHistorico()) return;
    const actuales = new Set(this.form.dias_clase);
    if (marcado) actuales.add(dia);
    else actuales.delete(dia);
    this.form.dias_clase = this.diasValidos.filter((d) => actuales.has(d));
  }

  diaMarcado(dia: string): boolean {
    return this.form.dias_clase.includes(dia);
  }

  abrirGuardar(): void {
    if (this.esHistorico()) return;
    if (this.form.dias_clase.length === 0) {
      this.error.set('Seleccione al menos un día de clase.');
      return;
    }
    if (this.form.hora_fin_jornada <= this.form.hora_inicio_jornada) {
      this.error.set('La hora de fin debe ser mayor que la hora de inicio.');
      return;
    }
    this.error.set(null);
    this.motivo.set('');
    this.errorModal.set(null);
    this.modalGuardar.set(true);
  }

  cerrarModal(): void {
    if (this.guardando()) return;
    this.modalGuardar.set(false);
    this.errorModal.set(null);
  }

  confirmar(): void {
    const motivo = this.motivo().trim();
    if (motivo.length < 10) {
      this.errorModal.set('El motivo debe tener al menos 10 caracteres.');
      return;
    }
    this.guardando.set(true);
    this.errorModal.set(null);
    this.adminService
      .actualizarHorarioAnio(this.anioSeleccionado(), {
        ...this.form,
        motivo,
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.modalGuardar.set(false);
          this.exito.set('Jornada y límites guardados correctamente.');
          this.cargar();
        },
        error: (err) => {
          this.guardando.set(false);
          this.errorModal.set(this.mensajeError(err));
        },
      });
  }

  jornadaTexto(): string {
    return `${this.form.hora_inicio_jornada}–${this.form.hora_fin_jornada}`;
  }

  private mensajeError(err: any): string {
    return (
      err?.error?.message ||
      err?.message ||
      'No se pudo completar la operación. Intente nuevamente.'
    );
  }
}
