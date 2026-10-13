import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from '../../../../environments/environment';

/**
 * Componente de Restablecimiento de Contraseña
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  token = signal('');
  validando = signal(true);
  tokenValido = signal(false);
  errorToken = signal<string | null>(null);
  usuario = signal<any>(null);

  nuevaPassword = '';
  confirmarPassword = '';
  mostrarPassword = signal(false);
  guardando = signal(false);
  errorPassword = signal<string | null>(null);
  exito = signal(false);

  ngOnInit(): void {
    const tokenParam = this.route.snapshot.queryParamMap.get('token');
    if (!tokenParam) {
      this.errorToken.set('No se proporcionó un token válido.');
      this.validando.set(false);
      return;
    }

    this.token.set(tokenParam);
    this.validarToken();
  }

  validarToken(): void {
    this.http.get<any>(`${environment.apiUrl}/auth/validar-token/${this.token()}`).subscribe({
      next: (res) => {
        if (res.success && res.data?.valido) {
          this.usuario.set(res.data.usuario);
          this.tokenValido.set(true);
        }
        this.validando.set(false);
      },
      error: (err) => {
        this.errorToken.set(err.error?.message || 'Token inválido o expirado.');
        this.validando.set(false);
      },
    });
  }

  togglePassword(): void {
    this.mostrarPassword.update((v) => !v);
  }

  restablecerPassword(): void {
    this.errorPassword.set(null);

    if (!this.nuevaPassword || this.nuevaPassword.length < 6) {
      this.errorPassword.set('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (this.nuevaPassword !== this.confirmarPassword) {
      this.errorPassword.set('Las contraseñas no coinciden.');
      return;
    }

    this.guardando.set(true);

    this.http
      .post<any>(`${environment.apiUrl}/auth/restablecer-password`, {
        token: this.token(),
        password: this.nuevaPassword,
      })
      .subscribe({
        next: (res) => {
          this.guardando.set(false);
          this.exito.set(true);
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 3000);
        },
        error: (err) => {
          this.guardando.set(false);
          this.errorPassword.set(err.error?.message || 'Error al restablecer la contraseña.');
        },
      });
  }

  irAlLogin(): void {
    this.router.navigate(['/login']);
  }
}
