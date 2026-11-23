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
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar.component';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { AuthService } from '../../../core/services/auth.service';
import { ConfiguracionService } from '../../../core/services/configuracion.service';

const TITULOS_POR_RUTA: Record<string, string> = {
  '/admin': 'Resumen Ejecutivo',
  '/admin/alumnos': 'Padrón de Alumnos',
  '/admin/personal': 'Personal y Usuarios',
  '/admin/carga-curricular': 'Carga Curricular',
  '/admin/horarios': 'Horarios',
  '/admin/anios-lectivos': 'Años Lectivos y Rollover',
  '/admin/promociones': 'Promoción de Alumnos',
  '/admin/asistencia-qr': 'Control de Asistencia QR',
  '/admin/siagie': 'Exportación interna',
  '/admin/auditoria': 'Auditoría y Actas',
  '/admin/tesoreria': 'Tesorería y Pensiones',
  '/admin/caja': 'Cuadre de Caja',
  '/admin/reportes': 'Reportes y Libretas',
  '/admin/historico': 'Histórico por Estudiante',
  '/admin/configuracion': 'Configuración del Sistema',
  '/admin/configuracion/tarifas': 'Tarifas y Conceptos',
  '/admin/configuracion/academico': 'Catálogo Académico',
  '/admin/configuracion/horarios': 'Horarios y Jornada',
  '/admin/configuracion/becas': 'Becas',
};

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, HeaderComponent],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
})
export class AdminLayoutComponent implements OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private configuracion = inject(ConfiguracionService);

  usuario = this.authService.usuario;
  titulo = signal('Resumen Ejecutivo');
  sidebarAbierto = signal(false);
  nombreInstitucion = this.configuracion.nombreInstitucion;

  constructor() {
    this.actualizarTitulo(this.router.url);

    this.router.events
      .pipe(
        filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((evento) => {
        this.cerrarSidebar();
        this.actualizarTitulo(evento.urlAfterRedirects);
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

  private actualizarTitulo(url: string): void {
    const ruta = (url.split('?')[0] || '/admin').replace(/\/+$/, '') || '/admin';
    this.titulo.set(TITULOS_POR_RUTA[ruta] || 'Panel de Administración');
  }
}
