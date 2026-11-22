import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';

interface CursoAsignado {
  id_carga: number;
  id_grado: number;
  nombre_grado: string;
  seccion: string;
  id_curso: number;
  nombre_curso: string;
  area_academica: string;
  horas_asignadas: number;
}

/**
 * Dashboard del Docente
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-docente-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './docente-dashboard.component.html',
  styleUrl: './docente-dashboard.component.scss',
})
export class DocenteDashboardComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private router = inject(Router);

  usuario = this.authService.usuario;

  cargando = signal(true);
  cursos = signal<CursoAsignado[]>([]);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.cargarCursos();
  }

  cargarCursos(): void {
    const usuarioActual = this.usuario();
    if (!usuarioActual?.info_adicional?.id_personal) {
      this.error.set('No se encontró el ID de personal del docente');
      this.cargando.set(false);
      return;
    }

    const id_personal = usuarioActual.info_adicional.id_personal;
    this.cargando.set(true);
    this.error.set(null);

    this.http.get<any>(`${environment.apiUrl}/carga-curricular/docente/${id_personal}`).subscribe({
      next: (response) => {
        if (response.success) {
          this.cursos.set(response.data);
        }
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error.set('No se pudieron cargar los cursos asignados.');
        this.cargando.set(false);
      },
    });
  }

  /**
   * Contar cursos por área académica
   */
  get cursosAgrupados(): { [area: string]: CursoAsignado[] } {
    const grupos: { [area: string]: CursoAsignado[] } = {};
    this.cursos().forEach((c) => {
      if (!grupos[c.area_academica]) {
        grupos[c.area_academica] = [];
      }
      grupos[c.area_academica].push(c);
    });
    return grupos;
  }

  /**
   * Obtener lista de áreas
   */
  get areas(): string[] {
    return Object.keys(this.cursosAgrupados);
  }

  /**
   * Ir al módulo de Asistencia con el curso/grado ya elegido.
   */
  irAAsistencia(curso: CursoAsignado): void {
    this.router.navigate(['/docente/asistencia'], {
      queryParams: {
        id_curso: curso.id_curso,
        id_grado: curso.id_grado,
      },
    });
  }

  /**
   * Ir al módulo de Notas con el curso/grado ya elegido.
   */
  irANotas(curso: CursoAsignado): void {
    this.router.navigate(['/docente/notas'], {
      queryParams: {
        id_curso: curso.id_curso,
        id_grado: curso.id_grado,
      },
    });
  }
}
