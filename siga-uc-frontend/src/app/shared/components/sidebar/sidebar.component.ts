import { Component, inject, Input } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { UiService } from '../../../core/services/ui.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  @Input() rol: string = 'ADMIN';

  private authService = inject(AuthService);
  private router = inject(Router);
  private uiService = inject(UiService);

  usuario = this.authService.usuario;

  /** Estado del sidebar (móvil) */
  sidebarAbierto = this.uiService.sidebarAbierto;

  menuItems = [
    { path: '/admin', label: 'Resumen Ejecutivo', icon: 'fa-chart-pie', roles: ['ADMIN'] },
    {
      path: '/admin/alumnos',
      label: 'Padrón de Alumnos',
      icon: 'fa-users',
      roles: ['ADMIN', 'SECRETARIA'],
    },
    {
      path: '/admin/personal',
      label: 'Personal & Usuarios',
      icon: 'fa-user-gear',
      roles: ['ADMIN'],
    },
    {
      path: '/admin/asistencia-qr',
      label: 'Control Asistencia QR',
      icon: 'fa-qrcode',
      roles: ['ADMIN', 'SECRETARIA'],
    },
    {
      path: '/admin/carga-curricular',
      label: 'Carga Curricular',
      icon: 'fa-chalkboard-user',
      roles: ['ADMIN'],
    },
    {
      path: '/admin/tesoreria',
      label: 'Tesorería y Pensiones',
      icon: 'fa-wallet',
      roles: ['ADMIN', 'SECRETARIA'],
    },
    {
      path: '/admin/caja',
      label: 'Cuadre de Caja',
      icon: 'fa-cash-register',
      roles: ['ADMIN', 'SECRETARIA'],
    },
    { path: '/admin/siagie', label: 'Exportación SIAGIE', icon: 'fa-file-excel', roles: ['ADMIN'] },
    {
      path: '/admin/reportes',
      label: 'Reportes y Libretas',
      icon: 'fa-file-invoice',
      roles: ['ADMIN'],
    },
    {
      path: '/admin/auditoria',
      label: 'Auditoría y Actas',
      icon: 'fa-shield-halved',
      roles: ['ADMIN'],
    },
  ];

  /** Cierra el sidebar (móvil). Se llama al hacer clic en el overlay o en un link */
  cerrarSidebar(): void {
    this.uiService.cerrarSidebar();
  }

  logout(): void {
    if (confirm('¿Está seguro de cerrar sesión?')) {
      this.authService.logout();
    }
  }
}