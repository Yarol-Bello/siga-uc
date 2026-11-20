import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Componente de Cambio de Contraseña
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-cambiar-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cambiar-password.component.html',
  styleUrl: './cambiar-password.component.scss',
})
export class CambiarPasswordComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  usuario = this.authService.usuario;

  passwordActual = '';
  passwordNueva = '';
  confirmarPassword = '';

  mostrarPassword = signal(false);
  guardando = signal(false);
  errorMensaje = signal<string | null>(null);
  exito = signal(false);

  get cambioObligatorio(): boolean {
    return this.authService.requiereCambioPassword();
  }

  togglePassword(): void {
    this.mostrarPassword.update((v) => !v);
  }

  cambiarPassword(): void {
    this.errorMensaje.set(null);

    if (!this.passwordActual) {
      this.errorMensaje.set('Ingrese su contraseña actual.');
      return;
    }

    if (!this.passwordNueva || this.passwordNueva.length < 6) {
      this.errorMensaje.set('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (this.passwordNueva !== this.confirmarPassword) {
      this.errorMensaje.set('Las contraseñas no coinciden.');
      return;
    }

    if (this.passwordNueva === this.passwordActual) {
      this.errorMensaje.set('La nueva contraseña debe ser diferente a la actual.');
      return;
    }

    this.guardando.set(true);

    this.authService
      .cambiarPassword({
        password_actual: this.passwordActual,
        password_nueva: this.passwordNueva,
        confirmar_password: this.confirmarPassword,
      })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.authService.marcarPasswordCambiada();
          this.exito.set(true);

          setTimeout(() => {
            this.router.navigate([this.authService.getDashboardUrl()]);
          }, 2000);
        },
        error: (err) => {
          this.guardando.set(false);
          this.errorMensaje.set(
            err.error?.message || 'Error al cambiar la contraseña.'
          );
        },
      });
  }

  cerrarSesion(): void {
    this.authService.logout();
  }
}
