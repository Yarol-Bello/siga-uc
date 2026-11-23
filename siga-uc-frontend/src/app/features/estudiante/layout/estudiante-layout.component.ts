import {
  Component,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter, Subscription } from 'rxjs';
import { SidebarEstudianteComponent } from '../../../shared/components/sidebar-estudiante/sidebar-estudiante.component';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Layout principal del Estudiante
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-estudiante-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarEstudianteComponent, HeaderComponent],
  templateUrl: './estudiante-layout.component.html',
  styleUrl: './estudiante-layout.component.scss',
})
export class EstudianteLayoutComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);

  usuario = this.authService.usuario;
  sidebarAbierto = signal(false);
  tituloHeader = signal('Mis Cursos y Calificaciones');
  subtituloHeader = signal(
    'Consulta tus asignaturas matriculadas y tus niveles de logro alcanzados.',
  );
  private routerSub?: Subscription;

  ngOnInit(): void {
    this.actualizarCabecera(this.router.url);

    // El menú móvil se cierra al cambiar de pantalla y el encabezado se
    // ajusta a la sección activa.
    this.routerSub = this.router.events
      .pipe(filter((evento) => evento instanceof NavigationEnd))
      .subscribe((evento) => {
        this.cerrarSidebar();
        this.actualizarCabecera((evento as NavigationEnd).urlAfterRedirects);
      });
  }

  private actualizarCabecera(url: string): void {
    if (url.includes('/estudiante/asistencia')) {
      this.tituloHeader.set('Mi Asistencia');
      this.subtituloHeader.set(
        'Consulta tus registros y el porcentaje de asistencia por curso.',
      );
      return;
    }

    if (url.includes('/estudiante/horario')) {
      this.tituloHeader.set('Horario de Clases');
      this.subtituloHeader.set(
        'Distribución semanal de clases, recesos y almuerzo.',
      );
      return;
    }

    this.tituloHeader.set('Mis Cursos y Calificaciones');
    this.subtituloHeader.set(
      'Consulta tus asignaturas matriculadas y tus niveles de logro alcanzados.',
    );
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
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
}
