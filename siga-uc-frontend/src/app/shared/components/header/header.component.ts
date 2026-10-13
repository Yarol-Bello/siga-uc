import { Component, inject, Input, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { NotificacionService, Notificacion } from '../../../core/services/notificacion.service';

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

  usuario = this.authService.usuario;
  noLeidas = this.notificacionService.noLeidas;

  // Modal
  modalInbox = signal(false);
  notificaciones = signal<Notificacion[]>([]);
  cargandoNotif = signal(false);
  vistaDetalle = signal(false);
  notificacionDetalle = signal<Notificacion | null>(null);

  private intervalo?: any;

  ngOnInit(): void {
    // Cargar notificaciones al iniciar
    this.cargarNotificaciones();

    // Polling cada 30 segundos
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

    // Marcar como leída si no lo está
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

  abrirCarne(): void {
    alert('🚧 El Carné Digital QR se implementará próximamente.');
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
