import { Component, inject, Input, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { NotificacionService, Notificacion } from '../../../core/services/notificacion.service';
import { environment } from '../../../../environments/environment';

/**
 * Componente Header superior
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent implements OnInit, OnDestroy {
  @Input() titulo: string = 'Panel';
  @Input() subtitulo: string = '';

  private authService = inject(AuthService);
  private notificacionService = inject(NotificacionService);
  private http = inject(HttpClient);

  usuario = this.authService.usuario;
  noLeidas = this.notificacionService.noLeidas;

  // Modal Notificaciones
  modalInbox = signal(false);
  notificaciones = signal<Notificacion[]>([]);
  cargandoNotif = signal(false);
  vistaDetalle = signal(false);
  notificacionDetalle = signal<Notificacion | null>(null);

  // Modal Carné Digital
  modalCarne = signal(false);
  datosCarne = signal<any>(null);
  qrDataUrl = signal<string>('');
  cargandoCarne = signal(false);

  private intervalo?: any;

  ngOnInit(): void {
    this.cargarNotificaciones();
    this.intervalo = setInterval(() => {
      this.notificacionService.contarNoLeidas().subscribe();
    }, 30000);
  }

  ngOnDestroy(): void {
    if (this.intervalo) {
      clearInterval(this.intervalo);
    }
  }

  cargarNotificaciones(): void {
    this.notificacionService.contarNoLeidas().subscribe();
  }

  abrirNotificaciones(): void {
    this.modalInbox.set(true);
    this.vistaDetalle.set(false);
    this.cargandoNotif.set(true);

    this.notificacionService.listar().subscribe({
      next: (res) => {
        if (res.success) {
          this.notificaciones.set(res.data);
        }
        this.cargandoNotif.set(false);
      },
      error: (err) => {
        console.error('Error al cargar notificaciones:', err);
        this.cargandoNotif.set(false);
      },
    });
  }

  cerrarInbox(): void {
    this.modalInbox.set(false);
    this.vistaDetalle.set(false);
    this.notificacionDetalle.set(null);
  }

  verDetalle(notif: Notificacion): void {
    this.notificacionDetalle.set(notif);
    this.vistaDetalle.set(true);

    if (!notif.leido) {
      this.notificacionService.marcarLeida(notif.id_notificacion).subscribe({
        next: () => {
          notif.leido = true;
        },
      });
    }
  }

  volverALista(): void {
    this.vistaDetalle.set(false);
    this.notificacionDetalle.set(null);
  }

  marcarTodasLeidas(): void {
    this.notificacionService.marcarTodasLeidas().subscribe({
      next: () => {
        this.notificaciones().forEach((n) => (n.leido = true));
      },
    });
  }

  get iniciales(): string {
    const u = this.usuario();
    if (!u) return '??';
    return `${u.nombres.charAt(0)}${u.apellidos.charAt(0)}`.toUpperCase();
  }

  /**
   * Abrir modal de Carné Digital QR
   */
  abrirCarne(): void {
    this.modalCarne.set(true);
    this.cargandoCarne.set(true);

    this.http.get<any>(`${environment.apiUrl}/auth/perfil`).subscribe({
      next: async (res) => {
        if (res.success && res.data) {
          const datos = res.data;
          this.datosCarne.set(datos);

          const codigoQR = datos.credencial_qr?.codigo_qr || `SIGA-UC-${datos.dni}`;
          const QRCode = await import('qrcode');
          const dataUrl = await QRCode.toDataURL(codigoQR, {
            width: 300,
            margin: 1,
            color: { dark: '#1E293B', light: '#FFFFFF' },
          });
          this.qrDataUrl.set(dataUrl);
        }
        this.cargandoCarne.set(false);
      },
      error: (err) => {
        console.error('Error al cargar carné:', err);
        this.cargandoCarne.set(false);
      },
    });
  }

  cerrarCarne(): void {
    this.modalCarne.set(false);
    this.datosCarne.set(null);
    this.qrDataUrl.set('');
  }

  /**
   * Imprimir el carné digital
   */
  imprimirCarne(): void {
    window.print();
  }

  fechaRelativa(fecha: string): string {
    const ahora = new Date();
    const f = new Date(fecha);
    const diff = ahora.getTime() - f.getTime();
    const minutos = Math.floor(diff / 60000);
    const horas = Math.floor(diff / 3600000);
    const dias = Math.floor(diff / 86400000);

    if (minutos < 1) return 'Ahora';
    if (minutos < 60) return `Hace ${minutos} min`;
    if (horas < 24) return `Hace ${horas}h`;
    if (dias < 7) return `Hace ${dias}d`;
    return f.toLocaleDateString('es-PE');
  }
}
