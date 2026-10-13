import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { LoginRequest } from '../../../core/models/usuario.model';

/**
 * Componente de Login
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  // Formulario reactivo
  loginForm: FormGroup = this.fb.group({
    dni: ['', [Validators.required, Validators.pattern(/^[0-9]{8}$/)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  // Estado del componente
  cargando = signal(false);
  errorMensaje = signal<string | null>(null);
  mostrarPassword = signal(false);
  mostrarModalRecuperar = signal(false);

  /**
   * Enviar formulario de login
   */
  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.errorMensaje.set(null);

    const credentials: LoginRequest = this.loginForm.value;

    this.authService.login(credentials).subscribe({
      next: (response) => {
        console.log('✅ Login exitoso:', response.data.usuario);

        // Redirigir según el rol
        const rol = response.data.usuario.rol;
        switch (rol) {
          case 'ADMIN':
            this.router.navigate(['/admin']);
            break;
          case 'DOCENTE':
            this.router.navigate(['/en-construccion'], { queryParams: { rol: 'DOCENTE' } });
            break;
          case 'ESTUDIANTE':
            this.router.navigate(['/en-construccion'], { queryParams: { rol: 'ESTUDIANTE' } });
            break;
          case 'SECRETARIA':
            this.router.navigate(['/en-construccion'], { queryParams: { rol: 'SECRETARIA' } });
            break;
          default:
            this.router.navigate(['/']);
        }
      },
      error: (error) => {
        this.cargando.set(false);
        const msg = error.error?.message || 'Error al iniciar sesión. Verifique sus credenciales.';
        this.errorMensaje.set(msg);
      },
      complete: () => {
        this.cargando.set(false);
      },
    });
  }

  /**
   * Alternar visibilidad de la contraseña
   */
  togglePassword(): void {
    this.mostrarPassword.update((v) => !v);
  }

  /**
   * Abrir modal de recuperación
   */
  abrirRecuperar(event: Event): void {
    event.preventDefault();
    this.mostrarModalRecuperar.set(true);
  }

  /**
   * Cerrar modal de recuperación
   */
  cerrarRecuperar(): void {
    this.mostrarModalRecuperar.set(false);
  }

  // ============================================================
  // GETTERS PARA VALIDACIÓN
  // ============================================================
  get dni() {
    return this.loginForm.get('dni');
  }
  get password() {
    return this.loginForm.get('password');
  }
}
