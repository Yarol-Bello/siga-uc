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
import { SidebarDocenteComponent } from '../../../shared/components/sidebar-docente/sidebar-docente.component';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { AuthService } from '../../../core/services/auth.service';

interface Cabecera {
  titulo: string;
  subtitulo: string;
}

const CABECERAS_POR_RUTA: Record<string, Cabecera> = {
  '/docente': {
    titulo: 'Mis Cursos y Horarios',
    subtitulo:
      'Carga horaria asignada y control rápido de asistencia y calificaciones.',
  },
  '/docente/horario': {
    titulo: 'Mi Horario',
    subtitulo: 'Distribución semanal de clases, recesos y almuerzo.',
  },
  '/docente/asistencia': {
    titulo: 'Control de Asistencia',
    subtitulo: 'Registro diario de asistencia por curso y sección.',
  },
  '/docente/notas': {
    titulo: 'Registro de Notas',
    subtitulo: 'Calificaciones por competencia y bimestre.',
  },
  '/docente/conclusiones': {
    titulo: 'Conclusiones Descriptivas',
    subtitulo:
      'Nivel de logro, avance, dificultad y sugerencia por estudiante.',
  },
  '/docente/ficha-estudiante': {
    titulo: 'Ficha del Estudiante',
    subtitulo: 'Consulta integral del expediente y los resultados del aula.',
  },
  '/docente/reportes': {
    titulo: 'Reportes de Aula',
    subtitulo: 'Consolidados estadísticos y reportes por competencia.',
  },
};

/**
 * Layout principal del Docente
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-docente-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarDocenteComponent, HeaderComponent],
  templateUrl: './docente-layout.component.html',
  styleUrl: './docente-layout.component.scss',
})
export class DocenteLayoutComponent implements OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  usuario = this.authService.usuario;
  titulo = signal('Mis Cursos y Horarios');
  subtitulo = signal(
    'Carga horaria asignada y control rápido de asistencia y calificaciones.',
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
      (url.split('?')[0] || '/docente').replace(/\/+$/, '') || '/docente';
    const cabecera = CABECERAS_POR_RUTA[ruta] || {
      titulo: 'Panel Docente',
      subtitulo: 'Gestión académica del aula.',
    };
    this.titulo.set(cabecera.titulo);
    this.subtitulo.set(cabecera.subtitulo);
  }
}
