import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Componente Sidebar para el rol Secretaría/Tesorería
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-sidebar-secretaria',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar-secretaria.component.html',
  styleUrl: './sidebar-secretaria.component.scss',
})
export class SidebarSecretariaComponent {
  private authService = inject(AuthService);

  usuario = this.authService.usuario;

  menuItems = [
    { path: '/secretaria', label: 'Panel de Tesorería', icon: 'fa-chart-pie' },
    { path: '/secretaria/padron', label: 'Padrón de Alumnos', icon: 'fa-users' },
    { path: '/secretaria/tesoreria', label: 'Tesorería y Pensiones', icon: 'fa-wallet' },
    { path: '/secretaria/caja', label: 'Cuadre de Caja', icon: 'fa-cash-register' },
    { path: '/secretaria/asistencia-qr', label: 'Control Asistencia QR', icon: 'fa-qrcode' },
  ];

  logout(): void {
    if (confirm('¿Está seguro de cerrar sesión?')) {
      this.authService.logout();
    }
  }
}
