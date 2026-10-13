import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarSecretariaComponent } from '../../../shared/components/sidebar-secretaria/sidebar-secretaria.component';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Layout principal de Secretaría/Tesorería
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-secretaria-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarSecretariaComponent, HeaderComponent],
  templateUrl: './secretaria-layout.component.html',
  styleUrl: './secretaria-layout.component.scss',
})
export class SecretariaLayoutComponent {
  private authService = inject(AuthService);
  usuario = this.authService.usuario;
}
