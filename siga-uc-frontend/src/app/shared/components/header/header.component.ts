import { Component, inject, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

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
export class HeaderComponent implements OnInit {
  @Input() titulo: string = 'Panel';
  @Input() subtitulo: string = '';

  private authService = inject(AuthService);
  usuario = this.authService.usuario;

  notificacionesNoLeidas = 0;

  ngOnInit(): void {
    // Placeholder: aquí cargaremos las notificaciones después
    this.notificacionesNoLeidas = 0;
  }

  /**
   * Obtener iniciales del usuario
   */
  get iniciales(): string {
    const u = this.usuario();
    if (!u) return '??';
    return `${u.nombres.charAt(0)}${u.apellidos.charAt(0)}`.toUpperCase();
  }

  /**
   * Abrir modal de carné QR
   */
  abrirCarne(): void {
    alert('🚧 El Carné Digital QR se implementará próximamente.');
  }

  /**
   * Abrir bandeja de notificaciones
   */
  abrirNotificaciones(): void {
    alert('🚧 El buzón de notificaciones se implementará próximamente.');
  }
}
