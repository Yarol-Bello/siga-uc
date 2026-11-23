import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Componente Sidebar para el rol Docente
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-sidebar-docente',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar-docente.component.html',
  styleUrl: './sidebar-docente.component.scss',
})
export class SidebarDocenteComponent {
  @Input() abierto = false;
  @Output() cerrar = new EventEmitter<void>();

  private authService = inject(AuthService);

  usuario = this.authService.usuario;

  menuItems = [
    { path: '/docente', label: 'Mis Cursos y Horarios', icon: 'fa-book-open' },
    { path: '/docente/horario', label: 'Mi Horario', icon: 'fa-calendar-days' },
    { path: '/docente/asistencia', label: 'Control de Asistencia', icon: 'fa-clipboard-user' },
    { path: '/docente/notas', label: 'Registro de Notas', icon: 'fa-marker' },
    {
      path: '/docente/conclusiones',
      label: 'Conclusiones Descriptivas',
      icon: 'fa-comment-dots',
    },
    { path: '/docente/ficha-estudiante', label: 'Ficha del Estudiante', icon: 'fa-id-card' },
    { path: '/docente/reportes', label: 'Reportes de Aula', icon: 'fa-chart-line' },
  ];

  logout(): void {
    if (confirm('¿Está seguro de cerrar sesión?')) {
      this.authService.logout();
    }
  }
}
