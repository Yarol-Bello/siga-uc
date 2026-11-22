import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

interface Bitacora {
  id_bitacora: string;
  id_usuario: number | null;
  fecha_hora: string;
  modulo_afectado: string;
  accion: string;
  descripcion: string;
  ip_origen: string | null;
  valor_anterior: any;
  valor_nuevo: any;
  usuario_nombre: string | null;
  usuario_dni: string | null;
  nombre_rol: string | null;
}

interface Acta {
  id_acta: number;
  periodo: string;
  anio_lectivo: number;
  id_grado: number | null;
  estado: string;
  fecha_cierre: string | null;
  cerrado_por: number | null;
  hash_integridad: string | null;
  nombre_grado: string | null;
  cerrado_por_nombre: string | null;
}

interface Estadisticas {
  total_registros: string;
  total_usuarios: string;
  total_logins: string;
  total_modificaciones: string;
  total_creaciones: string;
  total_anulaciones: string;
}

/**
 * Módulo de Auditoría y Actas (Admin)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-admin-auditoria',
  standalone: true,
  imports: [CommonModule, FormsModule, PaginationComponent],
  templateUrl: './admin-auditoria.component.html',
  styleUrl: './admin-auditoria.component.scss',
})
export class AdminAuditoriaComponent implements OnInit {
  private http = inject(HttpClient);

  // Estado
  tabActiva = signal<'bitacora' | 'actas'>('bitacora');
  cargando = signal(true);
  error = signal<string | null>(null);

  bitacora = signal<Bitacora[]>([]);
  actas = signal<Acta[]>([]);
  modulos = signal<string[]>([]);
  estadisticas = signal<Estadisticas | null>(null);
  actaPdfId = signal<number | null>(null);
  errorActaPdf = signal<string | null>(null);

  // Paginación server-side (logs: 50 por página)
  readonly pageSize = 50;
  pagina = signal(1);
  totalRegistros = signal(0);
  totalPaginas = signal(1);

  // Filtros
  filtroModulo = signal<string>('');
  filtroAccion = signal<string>('');
  filtroBusqueda = signal<string>('');

  // Modal detalle
  modalDetalle = signal(false);
  registroDetalle = signal<Bitacora | null>(null);

  ngOnInit(): void {
    this.cargarBitacora();
    this.cargarActas();
    this.cargarModulos();
    this.cargarEstadisticas();
  }

  /**
   * Cambiar pestaña
   */
  cambiarTab(tab: 'bitacora' | 'actas'): void {
    this.tabActiva.set(tab);
    if (tab === 'actas') {
      this.cargarActas();
    }
  }

  /**
   * Cargar bitácora
   */
  cargarBitacora(pagina = 1): void {
    this.cargando.set(true);
    this.error.set(null);

    const params: any = { page: pagina, pageSize: this.pageSize };
    if (this.filtroModulo()) params.modulo = this.filtroModulo();
    if (this.filtroAccion()) params.accion = this.filtroAccion();
    if (this.filtroBusqueda()) params.search = this.filtroBusqueda();

    this.http.get<any>(`${environment.apiUrl}/auditoria`, { params }).subscribe({
      next: (res) => {
        if (res.success) {
          this.bitacora.set(res.data || []);

          const pagination = res.pagination;
          this.totalRegistros.set(
            pagination?.total ?? (res.data || []).length,
          );
          this.totalPaginas.set(pagination?.totalPages ?? 1);
          this.pagina.set(pagination?.page ?? pagina);
        }
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error.set('No se pudo cargar la bitácora');
        this.cargando.set(false);
      },
    });
  }

  irPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas()) return;
    this.cargarBitacora(pagina);
  }

  /**
   * Cargar actas
   */
  cargarActas(): void {
    this.http.get<any>(`${environment.apiUrl}/auditoria/actas`).subscribe({
      next: (res) => {
        if (res.success) this.actas.set(res.data);
      },
      error: (err) => console.error('Error actas:', err),
    });
  }

  /**
   * Descargar el acta de cierre con la matriz real de notas.
   */
  descargarActaPdf(acta: Acta): void {
    if (this.actaPdfId() !== null) return;

    this.actaPdfId.set(acta.id_acta);
    this.errorActaPdf.set(null);

    this.http
      .get(`${environment.apiUrl}/auditoria/actas/${acta.id_acta}/pdf`, {
        observe: 'response',
        responseType: 'blob',
      })
      .pipe(finalize(() => this.actaPdfId.set(null)))
      .subscribe({
        next: (response) => {
          const blob = response.body;
          if (!blob) {
            this.errorActaPdf.set(
              'No se pudo generar el acta en PDF. Intente nuevamente.',
            );
            return;
          }

          const fileName =
            this.extraerNombreArchivo(
              response.headers.get('content-disposition'),
            ) ||
            `acta_${acta.id_acta}_${acta.anio_lectivo}.pdf`;

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
          this.errorActaPdf.set(mensaje);
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
      return 'No tienes permisos para descargar esta acta.';
    }
    if (error?.status === 404) {
      return 'No se encontró el acta solicitada.';
    }

    return 'No se pudo generar el acta en PDF. Intente nuevamente.';
  }

  /**
   * Cargar módulos disponibles
   */
  cargarModulos(): void {
    this.http.get<any>(`${environment.apiUrl}/auditoria/modulos`).subscribe({
      next: (res) => {
        if (res.success) this.modulos.set(res.data);
      },
    });
  }

  /**
   * Cargar estadísticas
   */
  cargarEstadisticas(): void {
    this.http.get<any>(`${environment.apiUrl}/auditoria/estadisticas`).subscribe({
      next: (res) => {
        if (res.success) this.estadisticas.set(res.data);
      },
    });
  }

  aplicarFiltros(): void {
    this.cargarBitacora(1);
  }

  limpiarFiltros(): void {
    this.filtroModulo.set('');
    this.filtroAccion.set('');
    this.filtroBusqueda.set('');
    this.cargarBitacora(1);
  }

  /**
   * Ver detalle de un registro
   */
  verDetalle(registro: Bitacora): void {
    this.registroDetalle.set(registro);
    this.modalDetalle.set(true);
  }

  cerrarModalDetalle(): void {
    this.modalDetalle.set(false);
    this.registroDetalle.set(null);
  }

  /**
   * Cerrar acta bimestral
   */
  cerrarActa(acta: Acta): void {
    if (acta.estado === 'CERRADO') {
      alert('Esta acta ya está cerrada');
      return;
    }

    if (
      !confirm(
        `¿Está seguro de cerrar y firmar digitalmente el ${acta.periodo}?\n\n` +
          `Una vez bloqueado, ningún docente podrá alterar notas sin autorización.`,
      )
    )
      return;

    this.http
      .post<any>(`${environment.apiUrl}/auditoria/actas/cerrar`, {
        periodo: acta.periodo,
        anio_lectivo: acta.anio_lectivo,
        id_grado: acta.id_grado,
      })
      .subscribe({
        next: (res) => {
          if (res.success) {
            alert(
              `✅ ${acta.periodo} cerrado y firmado digitalmente\n\n` +
                `Hash de integridad: ${res.data.hash_integridad}`,
            );
            this.cargarActas();
            this.cargarEstadisticas();
          }
        },
        error: (err) => alert('Error: ' + (err.error?.message || 'Error al cerrar acta')),
      });
  }

  /**
   * Obtener clase de acción
   */
  getAccionClass(accion: string): string {
    switch (accion) {
      case 'CREAR':
        return 'crear';
      case 'MODIFICAR':
        return 'modificar';
      case 'ELIMINAR':
        return 'eliminar';
      case 'ANULAR':
        return 'anular';
      case 'PUBLICAR':
        return 'publicar';
      case 'DESPUBLICAR':
        return 'despublicar';
      case 'GENERAR':
        return 'generar';
      case 'LOGIN':
        return 'login';
      case 'LOGIN_FALLIDO':
        return 'login-fallido';
      case 'LOGOUT':
        return 'logout';
      case 'ABRIR':
        return 'abrir';
      case 'CERRAR':
        return 'cerrar';
      case 'RETIRAR':
        return 'retirar';
      case 'CESAR':
        return 'cesar';
      case 'DESCARGAR':
        return 'descargar';
      case 'IMPORTAR':
        return 'importar';
      case 'ENVIAR':
        return 'enviar';
      case 'RESET_PASSWORD':
        return 'reset-password';
      default:
        return 'default';
    }
  }

  /**
   * Obtener icono de acción
   */
  getAccionIcon(accion: string): string {
    switch (accion) {
      case 'CREAR':
        return 'fa-plus-circle';
      case 'MODIFICAR':
        return 'fa-pen-to-square';
      case 'ELIMINAR':
        return 'fa-trash';
      case 'ANULAR':
        return 'fa-ban';
      case 'PUBLICAR':
        return 'fa-bullhorn';
      case 'DESPUBLICAR':
        return 'fa-eye-slash';
      case 'GENERAR':
        return 'fa-wand-magic-sparkles';
      case 'LOGIN':
        return 'fa-sign-in-alt';
      case 'LOGIN_FALLIDO':
        return 'fa-user-lock';
      case 'LOGOUT':
        return 'fa-right-from-bracket';
      case 'ABRIR':
        return 'fa-lock-open';
      case 'CERRAR':
        return 'fa-lock';
      case 'RETIRAR':
        return 'fa-user-slash';
      case 'CESAR':
        return 'fa-user-xmark';
      case 'DESCARGAR':
        return 'fa-download';
      case 'IMPORTAR':
        return 'fa-file-import';
      case 'ENVIAR':
        return 'fa-paper-plane';
      case 'RESET_PASSWORD':
        return 'fa-key';
      default:
        return 'fa-info-circle';
    }
  }

  /**
   * Formatear JSON para mostrar
   */
  formatearJson(obj: any): string {
    if (!obj) return '—';
    return JSON.stringify(obj, null, 2);
  }
}
