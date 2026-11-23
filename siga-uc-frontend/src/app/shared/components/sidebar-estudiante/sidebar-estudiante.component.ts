import { Component, computed, EventEmitter, inject, Input, Output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { ConfiguracionService } from '../../../core/services/configuracion.service';

/**
 * Componente Sidebar para el rol Estudiante
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-sidebar-estudiante',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar-estudiante.component.html',
  styleUrl: './sidebar-estudiante.component.scss',
})
export class SidebarEstudianteComponent {
  @Input() abierto = false;
  @Output() cerrar = new EventEmitter<void>();

  private authService = inject(AuthService);
  private configuracion = inject(ConfiguracionService);

  usuario = this.authService.usuario;

  gradoAlumno = computed(() => {
    const info = this.usuario()?.info_adicional;
    if (info?.matricula_activa === false) {
      return `Sin matrícula ${this.configuracion.anioLectivo()}`;
    }
    return info?.nombre_grado || `Sin matrícula ${this.configuracion.anioLectivo()}`;
  });

  menuItems = [
    { path: '/estudiante', label: 'Mis Cursos y Notas', icon: 'fa-book-open' },
    { path: '/estudiante/asistencia', label: 'Mi Asistencia', icon: 'fa-clipboard-user' },
    { path: '/estudiante/horario', label: 'Horario de Clases', icon: 'fa-calendar-days' },
  ];

  logout(): void {
    if (confirm('¿Está seguro de cerrar sesión?')) {
      this.authService.logout();
    }
  }
}
