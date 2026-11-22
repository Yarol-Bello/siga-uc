import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  GradoHorario,
  HorarioBloque,
  HorarioService,
  PeriodoClase,
} from '../../../core/services/horario.service';
import { ConfiguracionService } from '../../../core/services/configuracion.service';
import { HorarioGridComponent } from '../../../shared/components/horario-grid/horario-grid.component';

@Component({
  selector: 'app-secretaria-horarios',
  standalone: true,
  imports: [CommonModule, FormsModule, HorarioGridComponent],
  templateUrl: './secretaria-horarios.component.html',
  styleUrl: './secretaria-horarios.component.scss',
})
export class SecretariaHorariosComponent implements OnInit {
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
  resumen = signal({ total: 0, publicados: 0, borradores: 0 });
  cargando = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.cargarGrados();
  }

  onAnioChange(valor: string | number): void {
    this.anioSeleccionado.set(Number(valor));
    this.cargarGrados();
  }

  onGradoChange(valor: string | number): void {
    this.gradoSeleccionado.set(Number(valor));
    this.cargarDatos();
  }

  cargarGrados(): void {
    this.cargando.set(true);
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
    this.horarioService
      .listar(this.anioSeleccionado(), idGrado)
      .subscribe({
        next: (res) => {
          this.periodos.set(res?.data?.periodos || []);
          this.bloques.set(res?.data?.bloques || []);
          this.resumen.set(
            res?.data?.resumen || {
              total: 0,
              publicados: 0,
              borradores: 0,
            },
          );
          this.cargando.set(false);
        },
        error: (err) => {
          this.error.set(this.mensajeError(err));
          this.cargando.set(false);
        },
      });
  }

  private mensajeError(err: any): string {
    return (
      err?.error?.message ||
      err?.message ||
      'No se pudo cargar el horario.'
    );
  }
}
