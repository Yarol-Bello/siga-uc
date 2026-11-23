import {
  Component,
  DestroyRef,
  HostListener,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SidebarSecretariaComponent } from '../../../shared/components/sidebar-secretaria/sidebar-secretaria.component';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { AuthService } from '../../../core/services/auth.service';

interface Cabecera {
  titulo: string;
  subtitulo: string;
}

const CABECERAS_POR_RUTA: Record<string, Cabecera> = {
  '/secretaria': {
    titulo: 'Panel de Tesorería',
    subtitulo: 'Cobro de pre-tickets, control de pensiones y emisión de boletas internas.',
  },
  '/secretaria/padron': {
    titulo: 'Padrón de Alumnos',
    subtitulo: 'Matrícula anual, datos del estudiante y estado de pago.',
  },
  '/secretaria/tesoreria': {
    titulo: 'Tesorería y Pensiones',
    subtitulo: 'Cronograma de pensiones, cobros y becas por estudiante.',
  },
  '/secretaria/caja': {
    titulo: 'Cuadre de Caja',
    subtitulo: 'Apertura, movimientos, cierre y arqueo del día.',
  },
  '/secretaria/asistencia-qr': {
    titulo: 'Control de Asistencia QR',
    subtitulo: 'Registro de asistencia del personal con credencial QR.',
  },
  '/secretaria/horarios': {
    titulo: 'Horarios',
    subtitulo: 'Consulta de horarios publicados por grado y sección.',
  },
};

/**
 * Layout principal de Secretaría/Tesorería
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-secretaria-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    SidebarSecretariaComponent,
    HeaderComponent,
  ],
  templateUrl: './secretaria-layout.component.html',
  styleUrl: './secretaria-layout.component.scss',
})
export class SecretariaLayoutComponent implements OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  usuario = this.authService.usuario;
  titulo = signal('Panel de Tesorería');
  subtitulo = signal(
    'Cobro de pre-tickets, control de pensiones y emisión de boletas internas.',
  );
  sidebarAbierto = signal(false);

  constructor() {
    this.actualizarCabecera(this.router.url);

    this.router.events
      .pipe(
        filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((evento) => {
        this.cerrarSidebar();
        this.actualizarCabecera(evento.urlAfterRedirects);
      });
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  @HostListener('window:resize')
  onResize(): void {
    if (window.innerWidth > 900 && this.sidebarAbierto()) {
      this.cerrarSidebar();
    }
  }

  abrirSidebar(): void {
    this.sidebarAbierto.set(true);
    document.body.style.overflow = 'hidden';
  }

  cerrarSidebar(): void {
    if (!this.sidebarAbierto()) return;
    this.sidebarAbierto.set(false);
    document.body.style.overflow = '';
  }

  private actualizarCabecera(url: string): void {
    const ruta =
      (url.split('?')[0] || '/secretaria').replace(/\/+$/, '') || '/secretaria';
    const cabecera = CABECERAS_POR_RUTA[ruta] || {
      titulo: 'Módulo de Secretaría',
      subtitulo: 'Gestión administrativa y de tesorería.',
    };
    this.titulo.set(cabecera.titulo);
    this.subtitulo.set(cabecera.subtitulo);
  }
}
