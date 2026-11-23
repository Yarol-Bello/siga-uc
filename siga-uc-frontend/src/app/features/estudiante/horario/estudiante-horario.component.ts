import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { ConfiguracionService } from '../../../core/services/configuracion.service';
import {
  HorarioBloque,
  HorarioService,
  PeriodoClase,
} from '../../../core/services/horario.service';
import { HorarioGridComponent } from '../../../shared/components/horario-grid/horario-grid.component';

/**
 * Módulo de Horario de Clases (Estudiante)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-estudiante-horario',
  standalone: true,
  imports: [CommonModule, HorarioGridComponent],
  templateUrl: './estudiante-horario.component.html',
  styleUrl: './estudiante-horario.component.scss',
})
export class EstudianteHorarioComponent implements OnInit {
  private horarioService = inject(HorarioService);
  private authService = inject(AuthService);
  private configuracion = inject(ConfiguracionService);

  usuario = this.authService.usuario;
  anioLectivo = this.configuracion.anioLectivo;

  cargando = signal(true);
  error = signal<string | null>(null);
  dias = signal<string[]>(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']);
  periodos = signal<PeriodoClase[]>([]);
  bloques = signal<HorarioBloque[]>([]);
  publicado = signal(false);
  grado = signal<string>('');
  seccion = signal<string>('');
  anio = signal<number | null>(null);

  ngOnInit(): void {
    this.cargarHorario();
  }

  cargarHorario(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.horarioService.miHorario().subscribe({
      next: (res) => {
        const data = res?.data;
        this.anio.set(data?.anio || null);
        this.grado.set(data?.grado || '');
        this.seccion.set(data?.seccion || '');
        this.publicado.set(Boolean(data?.publicado));
        this.dias.set(data?.dias_clase || this.dias());
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
