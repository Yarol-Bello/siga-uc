import {
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  Subject,
  catchError,
  debounceTime,
  finalize,
  of,
  switchMap,
} from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ConfiguracionService } from '../../../core/services/configuracion.service';
import {
  EnviarNotificacionRequest,
  NotificacionService,
} from '../../../core/services/notificacion.service';

interface DashboardData {
  total_alumnos: string;
  total_personal: string;
  recaudacion_anual: string;
  pre_tickets_pendientes: string;
  monto_pendiente: string;
  total_retirados: string;
  total_grados: string;
  total_cursos: string;
}

interface GradoNotif {
  id_grado: number;
  nombre_grado: string;
  seccion: string;
}

interface AlumnoNotif {
  id_alumno: number;
  nombre_completo: string;
  dni: string;
  id_grado: number;
  nombre_grado: string;
  seccion: string;
}

type TipoDestinatario = 'TODOS' | 'GRADO' | 'ALUMNO';

/**
 * Dashboard Ejecutivo del Administrador
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private http = inject(HttpClient);
  private configuracion = inject(ConfiguracionService);
  private notificacionService = inject(NotificacionService);
  private destroyRef = inject(DestroyRef);

  @ViewChild('alumnoInput')
  private alumnoInput?: ElementRef<HTMLInputElement>;

  anioLectivo = this.configuracion.anioLectivo;

  // Estado
  cargando = signal(true);
  datos = signal<DashboardData | null>(null);
  error = signal<string | null>(null);

  // Modal Nueva Notificación
  modalNotificacion = signal(false);
  enviandoNotificacion = signal(false);
  cargandoDestinatarios = signal(false);
  errorNotificacion = signal<string | null>(null);
  exitoNotificacion = signal<string | null>(null);
  warningNotificacion = signal<string | null>(null);

  gradosNotif = signal<GradoNotif[]>([]);
  tipoDestinatario: TipoDestinatario = 'TODOS';
  gradoNotif: number | null = null;
  alumnoNotif: number | null = null;
  asuntoNotif = '';
  cuerpoNotif = '';

  // Buscador de alumnos
  busquedaAlumno = '';
  resultadosAlumnos = signal<AlumnoNotif[]>([]);
  buscandoAlumnos = signal(false);
  dropdownAlumnos = signal(false);
  errorBusquedaAlumnos = signal(false);
  private busquedaAlumno$ = new Subject<string>();

  ngOnInit(): void {
    this.cargarDashboard();

    this.busquedaAlumno$
      .pipe(
        debounceTime(300),
        switchMap((texto) => {
          if (!texto) {
            this.buscandoAlumnos.set(false);
            return of({ success: true, data: [] });
          }

          this.buscandoAlumnos.set(true);
          this.errorBusquedaAlumnos.set(false);

          return this.http
            .get<any>(`${environment.apiUrl}/alumnos`, {
              params: {
                search: texto,
                anio: this.anioLectivo(),
                limit: 10,
                solo_activos: 1,
              },
            })
            .pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        this.buscandoAlumnos.set(false);

        if (!response) {
          this.resultadosAlumnos.set([]);
          this.errorBusquedaAlumnos.set(true);
          return;
        }

        this.resultadosAlumnos.set(
          response?.success && Array.isArray(response.data) ? response.data : [],
        );
      });
  }

  /**
   * Cargar datos del dashboard desde el backend
   */
  cargarDashboard(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.http.get<any>(`${environment.apiUrl}/reportes/dashboard`).subscribe({
      next: (response) => {
        if (response.success) {
          this.datos.set(response.data);
        }
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('❌ Error al cargar dashboard:', err);
        this.error.set('No se pudieron cargar los datos del dashboard.');
        this.cargando.set(false);
      },
    });
  }

  abrirModalNotificacion(): void {
    this.modalNotificacion.set(true);
    this.dropdownAlumnos.set(false);
    this.errorNotificacion.set(null);
    this.exitoNotificacion.set(null);
    this.warningNotificacion.set(null);
  }

  cerrarModalNotificacion(): void {
    if (this.enviandoNotificacion()) return;

    this.modalNotificacion.set(false);
    this.dropdownAlumnos.set(false);
    this.errorNotificacion.set(null);
    this.exitoNotificacion.set(null);
    this.warningNotificacion.set(null);
  }

  cargarGrados(): void {
    if (this.gradosNotif().length > 0) return;

    this.cargandoDestinatarios.set(true);
    this.http
      .get<any>(`${environment.apiUrl}/grados`, {
        params: { anio: this.anioLectivo() },
      })
      .pipe(finalize(() => this.cargandoDestinatarios.set(false)))
      .subscribe({
        next: (response) => {
          this.gradosNotif.set(
            response?.success && Array.isArray(response.data) ? response.data : [],
          );
        },
        error: (err) => {
          console.error('Error al cargar grados:', err);
          this.errorNotificacion.set('No se pudieron cargar los grados.');
        },
      });
  }

  onBuscarAlumno(valor: string): void {
    const texto = String(valor || '');
    this.alumnoNotif = null;

    if (texto.trim().length < 2) {
      this.resultadosAlumnos.set([]);
      this.buscandoAlumnos.set(false);
      this.errorBusquedaAlumnos.set(false);
      this.dropdownAlumnos.set(false);
      this.busquedaAlumno$.next('');
      return;
    }

    this.dropdownAlumnos.set(true);
    this.busquedaAlumno$.next(texto.trim());
  }

  onFocusAlumno(): void {
    if (this.resultadosAlumnos().length > 0) {
      this.dropdownAlumnos.set(true);
      return;
    }

    const texto = this.busquedaAlumno.trim();
    if (texto.length >= 2) {
      this.busquedaAlumno$.next(texto);
      this.dropdownAlumnos.set(true);
    }
  }

  cerrarDropdownAlumnos(): void {
    this.dropdownAlumnos.set(false);
  }

  seleccionarAlumno(alumno: AlumnoNotif): void {
    this.alumnoNotif = alumno.id_alumno;
    this.busquedaAlumno = alumno.nombre_completo;
    this.resultadosAlumnos.set([]);
    this.errorBusquedaAlumnos.set(false);
    this.dropdownAlumnos.set(false);
    this.alumnoInput?.nativeElement.blur();
  }

  private limpiarBuscadorAlumno(): void {
    this.busquedaAlumno = '';
    this.alumnoNotif = null;
    this.resultadosAlumnos.set([]);
    this.errorBusquedaAlumnos.set(false);
    this.buscandoAlumnos.set(false);
    this.dropdownAlumnos.set(false);
    this.busquedaAlumno$.next('');
  }

  onTipoDestinatarioChange(tipo: TipoDestinatario): void {
    this.tipoDestinatario = tipo;
    this.gradoNotif = null;
    this.alumnoNotif = null;
    this.errorNotificacion.set(null);
    this.exitoNotificacion.set(null);
    this.warningNotificacion.set(null);

    if (tipo !== 'ALUMNO') {
      this.limpiarBuscadorAlumno();
    }

    if (tipo === 'GRADO') {
      this.cargarGrados();
    }
  }

  enviarNotificacion(): void {
    if (this.enviandoNotificacion()) return;

    const asunto = this.asuntoNotif.trim();
    const cuerpo = this.cuerpoNotif.trim();

    this.errorNotificacion.set(null);
    this.exitoNotificacion.set(null);
    this.warningNotificacion.set(null);

    if (!asunto || !cuerpo) {
      this.errorNotificacion.set('Complete el asunto y el mensaje.');
      return;
    }

    if (this.tipoDestinatario === 'GRADO' && !this.gradoNotif) {
      this.errorNotificacion.set('Seleccione un grado.');
      return;
    }

    if (this.tipoDestinatario === 'ALUMNO' && !this.alumnoNotif) {
      this.errorNotificacion.set(
        'Busque y seleccione un alumno de la lista.',
      );
      return;
    }

    const idDestino =
      this.tipoDestinatario === 'GRADO'
        ? Number(this.gradoNotif)
        : this.tipoDestinatario === 'ALUMNO'
          ? Number(this.alumnoNotif)
          : null;

    const payload: EnviarNotificacionRequest = {
      asunto,
      cuerpo,
      destinatarios: {
        tipo: this.tipoDestinatario,
        id: idDestino,
      },
    };

    this.enviandoNotificacion.set(true);

    this.notificacionService
      .enviarMasivo(payload)
      .pipe(finalize(() => this.enviandoNotificacion.set(false)))
      .subscribe({
        next: (response) => {
          const data = response?.data || {};
          const total = Number(data.total_destinatarios) || 0;
          const enviados = Number(data.correos_enviados) || 0;
          const fallidos = Number(data.correos_fallidos) || 0;
          const sinDestino = Number(data.correos_sin_destino) || 0;

          this.exitoNotificacion.set(
            `Notificación enviada a ${total} destinatario(s). ${enviados} correo(s) enviado(s).`,
          );

          if (fallidos > 0 || sinDestino > 0) {
            this.warningNotificacion.set(
              `${fallidos} correo(s) fallido(s) y ${sinDestino} sin correo registrado. La notificación sí quedó guardada en la campanita.`,
            );
          }

          this.notificacionService.actualizarContador();

          this.asuntoNotif = '';
          this.cuerpoNotif = '';
          this.gradoNotif = null;
          this.limpiarBuscadorAlumno();
          this.tipoDestinatario = 'TODOS';
        },
        error: (err) => {
          console.error('Error al enviar notificación:', err);
          this.errorNotificacion.set(
            err?.error?.message ||
              'No se pudo enviar la notificación. Intente nuevamente.',
          );
        },
      });
  }
}
