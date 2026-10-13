import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

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
  imports: [CommonModule, FormsModule],
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
  cargarBitacora(): void {
    this.cargando.set(true);
    this.error.set(null);

    const params: any = {};
    if (this.filtroModulo()) params.modulo = this.filtroModulo();
    if (this.filtroAccion()) params.accion = this.filtroAccion();
    if (this.filtroBusqueda()) params.search = this.filtroBusqueda();

    this.http.get<any>(`${environment.apiUrl}/auditoria`, { params }).subscribe({
      next: (res) => {
        if (res.success) this.bitacora.set(res.data);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error.set('No se pudo cargar la bitácora');
        this.cargando.set(false);
      },
    });
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
    this.cargarBitacora();
  }

  limpiarFiltros(): void {
    this.filtroModulo.set('');
    this.filtroAccion.set('');
    this.filtroBusqueda.set('');
    this.cargarBitacora();
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
      case 'ANULAR':
        return 'anular';
      case 'LOGIN':
        return 'login';
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
      case 'ANULAR':
        return 'fa-ban';
      case 'LOGIN':
        return 'fa-sign-in-alt';
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
