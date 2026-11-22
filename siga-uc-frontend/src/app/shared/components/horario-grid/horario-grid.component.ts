import { CommonModule } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import {
  HorarioBloque,
  PeriodoClase,
} from '../../../core/services/horario.service';

export interface CeldaHorario {
  dia: string;
  periodo: PeriodoClase;
  bloque: HorarioBloque | null;
}

@Component({
  selector: 'app-horario-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './horario-grid.component.html',
  styleUrl: './horario-grid.component.scss',
})
export class HorarioGridComponent {
  readonly DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

  periodos = input<PeriodoClase[]>([]);
  bloques = input<HorarioBloque[]>([]);
  puedeEditar = input(false);
  mostrarGrado = input(false);
  celdaClick = output<CeldaHorario>();

  private mapa = computed(() => {
    const mapa = new Map<string, HorarioBloque>();
    for (const bloque of this.bloques()) {
      mapa.set(`${bloque.dia_semana}|${bloque.id_periodo}`, bloque);
    }
    return mapa;
  });

  bloqueEn(dia: string, idPeriodo: number): HorarioBloque | null {
    return this.mapa().get(`${dia}|${idPeriodo}`) || null;
  }

  esEspecial(periodo: PeriodoClase): boolean {
    return periodo.tipo === 'RECREO' || periodo.tipo === 'ALMUERZO';
  }

  hora(periodo: PeriodoClase): string {
    return `${periodo.hora_inicio.substring(0, 5)} - ${periodo.hora_fin.substring(0, 5)}`;
  }

  onClick(dia: string, periodo: PeriodoClase, bloque: HorarioBloque | null): void {
    if (!this.puedeEditar() || this.esEspecial(periodo)) return;
    this.celdaClick.emit({ dia, periodo, bloque });
  }

  trackPeriodo(_: number, periodo: PeriodoClase): number {
    return periodo.id_periodo;
  }
}
