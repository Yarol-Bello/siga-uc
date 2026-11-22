import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

/**
 * Página 404 para rutas internas desconocidas (H72).
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss',
})
export class NotFoundComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  usuario = this.authService.usuario;

  irAlPanel(): void {
    this.router.navigateByUrl(this.authService.getDashboardUrl());
  }

  cerrarSesion(): void {
    this.authService.logout();
  }
}
