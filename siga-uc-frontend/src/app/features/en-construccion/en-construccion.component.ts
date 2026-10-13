import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

/**
 * Componente temporal "En Construcción"
 * Se usa mientras se desarrollan los dashboards de Docente/Estudiante/Secretaría
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-en-construccion',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './en-construccion.component.html',
  styleUrl: './en-construccion.component.scss',
})
export class EnConstruccionComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);

  usuario = this.authService.usuario;
  rol = this.route.snapshot.queryParamMap.get('rol') || 'Usuario';

  /**
   * Cerrar sesión
   */
  logout(): void {
    if (confirm('¿Cerrar sesión?')) {
      this.authService.logout();
    }
  }

  /**
   * Ir al login
   */
  irAlLogin(): void {
    this.authService.logout();
  }
}
