import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import {
  HorarioBloque,
  HorarioService,
  PeriodoClase,
} from '../../../core/services/horario.service';
import { HorarioGridComponent } from '../../../shared/components/horario-grid/horario-grid.component';

@Component({
  selector: 'app-docente-horario',
  standalone: true,
  imports: [CommonModule, HorarioGridComponent],
  templateUrl: './docente-horario.component.html',
  styleUrl: './docente-horario.component.scss',
})
export class DocenteHorarioComponent implements OnInit {
  private horarioService = inject(HorarioService);

  cargando = signal(true);
  error = signal<string | null>(null);
  periodos = signal<PeriodoClase[]>([]);
  bloques = signal<HorarioBloque[]>([]);
  anio = signal<number | null>(null);
  docente = signal<string>('');
  publicado = signal(false);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.horarioService.miHorario().subscribe({
      next: (res) => {
        const data = res?.data;
        this.anio.set(data?.anio || null);
        this.docente.set(data?.docente || '');
        this.publicado.set(Boolean(data?.publicado));
        this.periodos.set(data?.periodos || []);
        this.bloques.set(data?.bloques || []);
        this.cargando.set(false);
      },
      error: (err) => {
        this.error.set(
          err?.error?.message || 'No se pudo cargar el horario.',
        );
        this.cargando.set(false);
      },
    });
  }
}
