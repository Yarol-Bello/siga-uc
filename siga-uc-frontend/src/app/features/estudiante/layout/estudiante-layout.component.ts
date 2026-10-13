import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
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
export class EstudianteLayoutComponent {
  private authService = inject(AuthService);
  usuario = this.authService.usuario;
}
