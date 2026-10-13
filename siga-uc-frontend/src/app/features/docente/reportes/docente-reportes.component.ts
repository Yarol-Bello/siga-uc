import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
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
}

interface AlumnoNota {
  id_alumno: number;
  nombre_completo: string;
  codigo_estudiante: string;
  calificaciones: { id_competencia: number; calificacion: string | null }[];
}

interface Competencia {
  id_competencia: number;
  nombre_competencia: string;
  orden: number;
}

interface Notificacion {
  id_notificacion: number;
  asunto: string;
  cuerpo: string;
  leido: boolean;
  fecha_envio: string;
  remitente_nombre: string;
  remitente_correo: string;
}

/**
 * Módulo de Reportes de Aula (Docente)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-docente-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './docente-reportes.component.html',
  styleUrl: './docente-reportes.component.scss',
})
export class DocenteReportesComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  usuario = this.authService.usuario;

  // Estado principal
  cargando = signal(true);
  cargandoReporte = signal(false);
  error = signal<string | null>(null);

  cursos = signal<CursoAsignado[]>([]);
  cursoSeleccionado = signal<CursoAsignado | null>(null);
  bimestre = signal<number>(2);

  // Datos del reporte
  competencias = signal<Competencia[]>([]);
  alumnos = signal<AlumnoNota[]>([]);
  estadisticas = signal<any[]>([]);

  // Notificaciones (buzón)
  modalInbox = signal(false);
  notificaciones = signal<Notificacion[]>([]);
  noLeidas = signal<number>(0);
  notificacionDetalle = signal<Notificacion | null>(null);
  vistaDetalle = signal(false);

  ngOnInit(): void {
    this.cargarCursos();
    this.cargarNotificaciones();
  }

  cargarCursos(): void {
    const usuarioActual = this.usuario();
    if (!usuarioActual?.info_adicional?.id_personal) {
      this.error.set('No se encontró el ID del docente');
      this.cargando.set(false);
      return;
    }

    const id_personal = usuarioActual.info_adicional.id_personal;

    this.http.get<any>(`${environment.apiUrl}/carga-curricular/docente/${id_personal}`).subscribe({
      next: (res) => {
        if (res.success) {
          this.cursos.set(res.data);
          if (res.data.length > 0) {
            this.seleccionarCurso(res.data[0]);
          }
        }
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error.set('No se pudieron cargar los cursos');
        this.cargando.set(false);
      },
    });
  }

  seleccionarCurso(curso: CursoAsignado): void {
    this.cursoSeleccionado.set(curso);
    this.cargarReporte();
  }

  cambiarBimestre(): void {
    this.cargarReporte();
  }

  onCursoChange(idCarga: number): void {
    const curso = this.cursos().find((c) => c.id_carga === Number(idCarga));
    if (curso) this.seleccionarCurso(curso);
  }

  cargarReporte(): void {
    const curso = this.cursoSeleccionado();
    if (!curso) return;

    this.cargandoReporte.set(true);
    this.error.set(null);

    const url = `${environment.apiUrl}/calificaciones/curso/${curso.id_curso}/grado/${curso.id_grado}?bimestre=${this.bimestre()}`;

    this.http.get<any>(url).subscribe({
      next: (res) => {
        if (res.success) {
          this.competencias.set(res.data.competencias);
          this.alumnos.set(res.data.alumnos);
          this.calcularEstadisticas();
        }
        this.cargandoReporte.set(false);
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error.set('No se pudo cargar el reporte');
        this.cargandoReporte.set(false);
      },
    });
  }

  /**
   * Calcular estadísticas por competencia
   */
  calcularEstadisticas(): void {
    const comps = this.competencias();
    const alumnos = this.alumnos();
    const total = alumnos.length;

    const stats = comps.map((comp) => {
      let ad = 0,
        a = 0,
        b = 0,
        c = 0;
      alumnos.forEach((alumno) => {
        const cal = alumno.calificaciones.find((c) => c.id_competencia === comp.id_competencia);
        const nota = cal?.calificacion;
        if (nota === 'AD') ad++;
        else if (nota === 'A') a++;
        else if (nota === 'B') b++;
        else if (nota === 'C') c++;
      });

      const predominante =
        ad >= a && ad >= b && ad >= c ? 'AD' : a >= b && a >= c ? 'A' : b >= c ? 'B' : 'C';

      return {
        id_competencia: comp.id_competencia,
        nombre: comp.nombre_competencia,
        orden: comp.orden,
        ad,
        a,
        b,
        c,
        total,
        pct_ad: total > 0 ? Math.round((ad / total) * 100) : 0,
        pct_a: total > 0 ? Math.round((a / total) * 100) : 0,
        pct_b: total > 0 ? Math.round((b / total) * 100) : 0,
        pct_c: total > 0 ? Math.round((c / total) * 100) : 0,
        predominante,
      };
    });

    this.estadisticas.set(stats);
  }

  /**
   * Cargar notificaciones
   */
  cargarNotificaciones(): void {
    this.http.get<any>(`${environment.apiUrl}/notificaciones`).subscribe({
      next: (res) => {
        if (res.success) {
          this.notificaciones.set(res.data);
          this.noLeidas.set(res.data.filter((n: Notificacion) => !n.leido).length);
        }
      },
      error: (err) => console.error('Error notificaciones:', err),
    });
  }

  abrirInbox(): void {
    this.modalInbox.set(true);
    this.vistaDetalle.set(false);
  }

  cerrarInbox(): void {
    this.modalInbox.set(false);
    this.notificacionDetalle.set(null);
    this.vistaDetalle.set(false);
  }

  verDetalle(notif: Notificacion): void {
    this.notificacionDetalle.set(notif);
    this.vistaDetalle.set(true);

    // Marcar como leída
    if (!notif.leido) {
      this.http
        .put<any>(`${environment.apiUrl}/notificaciones/${notif.id_notificacion}/leer`, {})
        .subscribe({
          next: () => {
            notif.leido = true;
            this.noLeidas.set(this.notificaciones().filter((n) => !n.leido).length);
          },
        });
    }
  }

  volverALista(): void {
    this.vistaDetalle.set(false);
    this.notificacionDetalle.set(null);
  }

  marcarTodasLeidas(): void {
    this.http.put<any>(`${environment.apiUrl}/notificaciones/leer-todas`, {}).subscribe({
      next: () => {
        this.notificaciones().forEach((n) => (n.leido = true));
        this.noLeidas.set(0);
      },
    });
  }

  /**
   * Obtener clase CSS para nota
   */
  getNotaClass(nota: string | undefined): string {
    if (!nota) return 'nota-vacia';
    return 'nota-' + nota.toLowerCase();
  }
}
