import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';

interface Horario {
  id_horario: number;
  dia_semana: string;
  hora_inicio: string;
  hora_fin: string;
  tipo_bloque: string;
  id_curso: number | null;
  nombre_curso: string | null;
  area_academica: string | null;
  docente_nombre: string | null;
}

interface BloqueHorario {
  hora: string;
  lunes: Horario | null;
  martes: Horario | null;
  miercoles: Horario | null;
  jueves: Horario | null;
  viernes: Horario | null;
}

/**
 * Módulo de Horario de Clases (Estudiante)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-estudiante-horario',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './estudiante-horario.component.html',
  styleUrl: './estudiante-horario.component.scss',
})
export class EstudianteHorarioComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  usuario = this.authService.usuario;

  // Estado
  cargando = signal(true);
  error = signal<string | null>(null);
  horarios = signal<Horario[]>([]);
  bloques = signal<BloqueHorario[]>([]);

  // Info del alumno
  nombreGrado = signal<string>('');
  seccion = signal<string>('');

  ngOnInit(): void {
    this.cargarHorario();
  }

  /**
   * Cargar el horario del grado del estudiante
   */
  cargarHorario(): void {
    const usuarioActual = this.usuario();
    const infoAlumno = usuarioActual?.info_adicional;

    if (!infoAlumno?.id_grado) {
      this.error.set('No se encontró el grado del estudiante');
      this.cargando.set(false);
      return;
    }

    this.nombreGrado.set(infoAlumno.nombre_grado || '');
    this.seccion.set(infoAlumno.seccion || '');

    this.cargando.set(true);
    this.error.set(null);

    this.http.get<any>(`${environment.apiUrl}/horarios/grado/${infoAlumno.id_grado}`).subscribe({
      next: (res) => {
        if (res.success) {
          this.horarios.set(res.data);
          this.agruparPorHora(res.data);
        }
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error.set('No se pudo cargar el horario');
        this.cargando.set(false);
      },
    });
  }

  /**
   * Agrupar los horarios por bloque de hora
   */
  agruparPorHora(horarios: Horario[]): void {
    const bloquesMap = new Map<string, BloqueHorario>();

    horarios.forEach((h) => {
      const horaInicio = h.hora_inicio.substring(0, 5);
      const horaFin = h.hora_fin.substring(0, 5);
      const horaKey = `${horaInicio} - ${horaFin}`;

      if (!bloquesMap.has(horaKey)) {
        bloquesMap.set(horaKey, {
          hora: horaKey,
          lunes: null,
          martes: null,
          miercoles: null,
          jueves: null,
          viernes: null,
        });
      }

      const bloque = bloquesMap.get(horaKey)!;

      switch (h.dia_semana) {
        case 'Lunes':
          bloque.lunes = h;
          break;
        case 'Martes':
          bloque.martes = h;
          break;
        case 'Miércoles':
          bloque.miercoles = h;
          break;
        case 'Jueves':
          bloque.jueves = h;
          break;
        case 'Viernes':
          bloque.viernes = h;
          break;
      }
    });

    const bloquesArray = Array.from(bloquesMap.values()).sort((a, b) => {
      const horaA = a.hora.split(' - ')[0];
      const horaB = b.hora.split(' - ')[0];
      return horaA.localeCompare(horaB);
    });

    this.bloques.set(bloquesArray);
  }

  /**
   * Verificar si un bloque es de tipo especial (recreo / almuerzo)
   */
  esBloqueEspecial(bloque: Horario | null): boolean {
    if (!bloque) return false;
    return bloque.tipo_bloque === 'RECREO' || bloque.tipo_bloque === 'ALMUERZO';
  }

  /**
   * Obtener el nombre legible del bloque especial
   */
  getTipoBloqueTexto(tipo: string | null): string {
    switch (tipo) {
      case 'RECREO':
        return 'Receso Matutino';
      case 'ALMUERZO':
        return 'Horario de Almuerzo';
      default:
        return '';
    }
  }
}
