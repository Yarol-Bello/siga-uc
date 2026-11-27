import { Component, computed, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  FormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { ConfiguracionService } from '../../../core/services/configuracion.service';
import { LoginRequest } from '../../../core/models/usuario.model';
import { environment } from '../../../../environments/environment';

/**
 * Componente de Login
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  readonly esperandoServidor = this.authService.esperandoServidor;
  readonly mensajeConexion = this.authService.mensajeConexion;
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private configuracion = inject(ConfiguracionService);

  readonly nombreInstitucion = this.configuracion.nombreInstitucion;
  readonly anioActual = new Date().getFullYear();
  readonly iniciales = computed(() => {
    const palabras = this.nombreInstitucion()
      .replace(/[^\p{L}\p{N} ]/gu, '')
      .split(/\s+/)
      .filter(Boolean);
    const primera = palabras[0] || 'SIGA';
    const segunda = palabras[1] || primera;
    return `${primera.charAt(0)}${segunda.charAt(0)}`.toUpperCase();
  });

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

  // Estado del modal de recuperación
  recoveryInput = '';
  enviandoRecuperacion = signal(false);

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
        console.log('Login exitoso:', response.data.usuario.rol);

        // Si tiene una contraseña temporal, forzar el cambio antes de entrar
        if (response.data.usuario.requiere_cambio_password) {
          this.router.navigate(['/cambiar-password']);
          return;
        }

        // Volver a la ruta protegida original, solo si es una ruta interna.
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        if (this.esReturnUrlValido(returnUrl)) {
          this.router.navigateByUrl(returnUrl!);
          return;
        }

        // Sin returnUrl válido, redirigir según el rol.
        this.router.navigateByUrl(this.authService.getDashboardUrl());
      },
      error: (error) => {
        this.cargando.set(false);
        const msg =
          error.error?.message ||
          error.message ||
          'Error al iniciar sesión. Verifique sus credenciales.';
        this.errorMensaje.set(msg);
      },
      complete: () => {
        this.cargando.set(false);
      },
    });
  }

  /**
   * Solo acepta rutas internas absolutas. Rechaza `//dominio`, URLs externas
   * y el propio login para evitar bucles (H72).
   */
  private esReturnUrlValido(returnUrl: string | null): boolean {
    return (
      !!returnUrl &&
      returnUrl.startsWith('/') &&
      !returnUrl.startsWith('//') &&
      !returnUrl.startsWith('/login')
    );
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
    this.recoveryInput = '';
    this.mostrarModalRecuperar.set(true);
  }

  /**
   * Cerrar modal de recuperación
   */
  cerrarRecuperar(): void {
    this.mostrarModalRecuperar.set(false);
  }

  /**
   * Enviar solicitud de recuperación al backend
   */
  enviarRecuperacion(): void {
    const identificador = this.recoveryInput?.trim();

    if (!identificador) {
      alert('⚠️ Por favor ingrese su DNI o correo electrónico.');
      return;
    }

    this.enviandoRecuperacion.set(true);

    this.http
      .post<any>(`${environment.apiUrl}/auth/recuperar-password`, {
        identificador,
      })
      .subscribe({
        next: (res) => {
          this.enviandoRecuperacion.set(false);
          this.cerrarRecuperar();

          if (res.data?.tieneCorreo === false) {
            alert(
              '⚠️ No tiene un correo registrado en el sistema.\n\n' +
                'Por favor, contacte al Administrador para que restablezca su contraseña.',
            );
          } else if (res.data?.enviado === false) {
            alert(
              '⚠️ No se pudo enviar el correo de recuperación.\n\n' +
                'Verifique la configuración de correo o contacte al Administrador.',
            );
          } else {
            alert(
              '✅ Solicitud enviada exitosamente.\n\n' +
                'Revise su correo personal para encontrar el enlace de restablecimiento.',
            );
          }
        },
        error: (err) => {
          this.enviandoRecuperacion.set(false);
          console.error('Error al solicitar recuperación:', err);
          alert(
            '❌ Error al procesar la solicitud: ' + (err.error?.message || 'Error desconocido'),
          );
        },
      });
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
