import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ConfiguracionService } from '../../../core/services/configuracion.service';

interface Grado {
  id_grado: number;
  nombre_grado: string;
  seccion: string;
}

interface Alumno {
  id_alumno: number;
  dni: string;
  nombres: string;
  apellidos: string;
  nombre_completo: string;
  codigo_estudiante: string;
  nombre_grado: string;
}

interface CuadroMerito {
  puesto: string;
  id_alumno: number;
  nombre_completo: string;
  codigo_estudiante: string;
  dni: string;
  total_cursos: string;
  total_ad: string;
  total_a: string;
  total_b: string;
  total_c: string;
  puntaje_total: string;
  promedio_ponderado: string;
}

interface AlumnoRiesgo {
  id_alumno: number;
  dni: string;
  nombre_completo: string;
  codigo_estudiante: string;
  nombre_grado: string;
  cursos_con_c: string;
  cursos_detalle: string;
  tutor_nombre: string;
}

interface LibretaData {
  alumno: any;
  tutor: any;
  notas: any[];
  asistencia: any;
  bimestre: number;
  anio_lectivo: number;
}

/**
 * Módulo de Reportes y Libretas (Admin)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-admin-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-reportes.component.html',
  styleUrl: './admin-reportes.component.scss',
})
export class AdminReportesComponent implements OnInit {
  private http = inject(HttpClient);
  private configuracion = inject(ConfiguracionService);

  anioLectivo = this.configuracion.anioLectivo;

  // Estado general
  cargando = signal(true);
  error = signal<string | null>(null);

  // Pestañas
  tabActiva = signal<'libretas' | 'merito' | 'riesgo'>('libretas');

  // Filtros
  grados = signal<Grado[]>([]);
  gradoSeleccionado = signal<number>(3); // Por defecto 3ro
  bimestre = signal<number>(2);

  // Datos de cada pestaña
  alumnos = signal<Alumno[]>([]);
  cuadroMerito = signal<CuadroMerito[]>([]);
  alumnosRiesgo = signal<AlumnoRiesgo[]>([]);

  // Modal de libreta
  modalLibreta = signal(false);
  libretaData = signal<LibretaData | null>(null);
  cargandoLibreta = signal(false);
  generandoPdf = signal(false);
  errorPdf = signal<string | null>(null);

  ngOnInit(): void {
    this.cargarGrados();
  }

  /**
   * Cargar grados disponibles
   */
  cargarGrados(): void {
    this.http
      .get<any>(`${environment.apiUrl}/grados`, {
        params: { anio: this.anioLectivo() },
      })
      .subscribe({
        next: (res) => {
          if (res.success && res.data.length > 0) {
            this.grados.set(res.data);

            const actual = this.gradoSeleccionado();
            if (!res.data.some((g: Grado) => g.id_grado === actual)) {
              this.gradoSeleccionado.set(res.data[0].id_grado);
            }

            this.cargarAlumnos();
          }
        },
        error: (err) => console.error('Error grados:', err),
      });
  }

  /**
   * Cambiar pestaña
   */
  cambiarTab(tab: 'libretas' | 'merito' | 'riesgo'): void {
    this.tabActiva.set(tab);
    switch (tab) {
      case 'libretas':
        this.cargarAlumnos();
        break;
      case 'merito':
        this.cargarCuadroMerito();
        break;
      case 'riesgo':
        this.cargarAlumnosRiesgo();
        break;
    }
  }

  /**
   * Cambiar grado
   */
  cambiarGrado(): void {
    const tab = this.tabActiva();
    if (tab === 'libretas') this.cargarAlumnos();
    else if (tab === 'merito') this.cargarCuadroMerito();
    else this.cargarAlumnosRiesgo();
  }

  /**
   * Cambiar bimestre
   */
  cambiarBimestre(): void {
    const tab = this.tabActiva();
    if (tab === 'merito') this.cargarCuadroMerito();
    else if (tab === 'riesgo') this.cargarAlumnosRiesgo();
  }

  /**
   * Cargar alumnos del grado (para libretas)
   */
  cargarAlumnos(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.http
      .get<any>(`${environment.apiUrl}/alumnos`, {
        params: {
          id_grado: this.gradoSeleccionado(),
          anio: this.anioLectivo(),
        },
      })
      .subscribe({
        next: (res) => {
          if (res.success) this.alumnos.set(res.data);
          this.cargando.set(false);
        },
        error: (err) => {
          console.error('Error alumnos:', err);
          this.error.set('No se pudieron cargar los alumnos');
          this.cargando.set(false);
        },
      });
  }

  /**
   * Cargar cuadro de mérito
   */
  cargarCuadroMerito(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.http
      .get<any>(
        `${environment.apiUrl}/reportes/cuadro-merito/${this.gradoSeleccionado()}?bimestre=${this.bimestre()}&anio=${this.anioLectivo()}`,
      )
      .subscribe({
        next: (res) => {
          if (res.success) this.cuadroMerito.set(res.data);
          this.cargando.set(false);
        },
        error: (err) => {
          console.error('Error mérito:', err);
          this.error.set('No se pudo cargar el cuadro de mérito');
          this.cargando.set(false);
        },
      });
  }

  /**
   * Cargar alumnos en riesgo
   */
  cargarAlumnosRiesgo(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.http
      .get<any>(
        `${environment.apiUrl}/reportes/alumnos-riesgo/${this.gradoSeleccionado()}?bimestre=${this.bimestre()}&anio=${this.anioLectivo()}`,
      )
      .subscribe({
        next: (res) => {
          if (res.success) this.alumnosRiesgo.set(res.data);
          this.cargando.set(false);
        },
        error: (err) => {
          console.error('Error riesgo:', err);
          this.error.set('No se pudo cargar el listado de alumnos en riesgo');
          this.cargando.set(false);
        },
      });
  }

  /**
   * Abrir modal de libreta de un alumno
   */
  verLibreta(alumno: Alumno): void {
    this.modalLibreta.set(true);
    this.cargandoLibreta.set(true);
    this.libretaData.set(null);
    this.errorPdf.set(null);

    this.http
      .get<any>(
        `${environment.apiUrl}/reportes/libreta/${alumno.id_alumno}?bimestre=${this.bimestre()}&anio=${this.anioLectivo()}`,
      )
      .subscribe({
        next: (res) => {
          if (res.success) this.libretaData.set(res.data);
          this.cargandoLibreta.set(false);
        },
        error: (err) => {
          console.error('Error libreta:', err);
          this.cargandoLibreta.set(false);
          alert('No se pudo cargar la libreta');
        },
      });
  }

  cerrarModalLibreta(): void {
    this.modalLibreta.set(false);
    this.libretaData.set(null);
    this.errorPdf.set(null);
  }

  /**
   * Descargar la libreta como PDF real generado por el backend.
   */
  descargarLibretaPdf(): void {
    const data = this.libretaData();

    // Evita doble clic / doble petición.
    if (!data?.alumno || this.generandoPdf()) return;

    const idAlumno = data.alumno.id_alumno;
    const bimestre = this.bimestre();
    const anio = this.anioLectivo();

    this.generandoPdf.set(true);
    this.errorPdf.set(null);

    this.http
      .get(`${environment.apiUrl}/reportes/libreta/${idAlumno}/pdf`, {
        params: { bimestre, anio },
        observe: 'response',
        responseType: 'blob',
      })
      .pipe(finalize(() => this.generandoPdf.set(false)))
      .subscribe({
        next: (response) => {
          const blob = response.body;
          if (!blob) {
            this.errorPdf.set(
              'No se pudo generar la libreta en PDF. Intente nuevamente.',
            );
            return;
          }

          const fileName =
            this.extraerNombreArchivo(
              response.headers.get('content-disposition'),
            ) ||
            `libreta_${data.alumno.dni || idAlumno}_BIM${bimestre}_${anio}.pdf`;

          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        },
        error: async (error) => {
          const mensaje = await this.obtenerMensajeErrorPdf(error);
          this.errorPdf.set(mensaje);
        },
      });
  }

  private extraerNombreArchivo(
    contentDisposition: string | null,
  ): string | null {
    if (!contentDisposition) return null;

    const match = /filename\*?=(?:UTF-8'')?["']?([^;"']+)/i.exec(
      contentDisposition,
    );

    if (!match?.[1]) return null;

    try {
      return decodeURIComponent(match[1].trim());
    } catch {
      return match[1].trim();
    }
  }

  private async obtenerMensajeErrorPdf(error: any): Promise<string> {
    const body = error?.error;

    if (body instanceof Blob) {
      try {
        const texto = await body.text();
        const json = JSON.parse(texto);
        if (json?.message) return json.message;
      } catch {
        // El cuerpo no era JSON; se usa el mensaje por estado.
      }
    } else if (body?.message) {
      return body.message;
    }

    if (error?.status === 401) {
      return 'Tu sesión expiró. Vuelve a iniciar sesión.';
    }
    if (error?.status === 403) {
      return 'No tienes permisos para descargar esta libreta.';
    }
    if (error?.status === 404) {
      return 'No se encontró la libreta del alumno.';
    }

    return 'No se pudo generar la libreta en PDF. Intente nuevamente.';
  }

  /**
   * Obtener clase CSS por nota
   */
  getNotaClass(nota: string | undefined): string {
    if (!nota) return 'nota-vacia';
    return 'nota-' + nota.toLowerCase();
  }

  /**
   * Obtener icono de medalla por puesto
   */
  getMedalla(puesto: string): string {
    const p = parseInt(puesto);
    if (p === 1) return '🥇';
    if (p === 2) return '🥈';
    if (p === 3) return '🥉';
    return `#${p}`;
  }

  /**
   * Verificar si un puesto está en el top 3
   */
  esTop3(puesto: string): boolean {
    return Number(puesto) <= 3;
  }
}
