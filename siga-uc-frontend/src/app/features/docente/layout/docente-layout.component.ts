import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarDocenteComponent } from '../../../shared/components/sidebar-docente/sidebar-docente.component';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { AuthService } from '../../../core/services/auth.service';

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
export class DocenteLayoutComponent {
  private authService = inject(AuthService);

  usuario = this.authService.usuario;
}
