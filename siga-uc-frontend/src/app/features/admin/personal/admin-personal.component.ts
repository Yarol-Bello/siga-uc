import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface Personal {
  id_personal: number;
  id_usuario: number;
  dni: string;
  nombres: string;
  apellidos: string;
  nombre_completo: string;
  correo_institucional: string;
  telefono: string;
  estado: string;
  id_rol: number;
  nombre_rol: string;
  especialidad: string;
  cargo: string;
  fecha_ingreso: string;
  fecha_cese: string;
  motivo_cese: string;
}

interface Rol {
  id_rol: number;
  nombre_rol: string;
  descripcion: string;
}

/**
 * Módulo de Personal y Usuarios (Admin)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-admin-personal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-personal.component.html',
  styleUrl: './admin-personal.component.scss',
})
export class AdminPersonalComponent implements OnInit {
  private http = inject(HttpClient);

  // Estado principal
  cargando = signal(true);
  error = signal<string | null>(null);
  personal = signal<Personal[]>([]);
  roles = signal<Rol[]>([]);

  // Filtros
  filtroRol = signal<string>('');
  filtroEstado = signal<string>('');
  busqueda = signal<string>('');

  // Modal: Nuevo Personal
  modalNuevo = signal(false);
  guardandoNuevo = signal(false);
  errorNuevo = signal<string | null>(null);
  formNuevo: any = {
    dni: '',
    nombres: '',
    apellidos: '',
    correo_institucional: '',
    correo_personal: '',
    telefono: '',
    id_rol: 2,
    especialidad: '',
    cargo: '',
    password: 'UC2026*',
  };

  // Modal: Editar
  modalEditar = signal(false);
  personalEditando = signal<Personal | null>(null);
  guardandoEditar = signal(false);
  errorEditar = signal<string | null>(null);
  formEditar: any = {
    nombres: '',
    apellidos: '',
    correo_institucional: '',
    telefono: '',
    id_rol: 2,
    especialidad: '',
    cargo: '',
  };

  // Modal: Cese
  modalCese = signal(false);
  personalCese = signal<Personal | null>(null);
  procesandoCese = signal(false);
  motivoCese = signal('');
  fechaCese = signal('');

  // Modal: Reset Password
  modalPassword = signal(false);
  personalPassword = signal<Personal | null>(null);
  procesandoPassword = signal(false);
  passwordTemporal = signal('');

  // Modal: Carné QR
  modalCarne = signal(false);
  personalCarne = signal<Personal | null>(null);

  ngOnInit(): void {
    this.cargarPersonal();
    this.cargarRoles();
  }

  cargarPersonal(): void {
    this.cargando.set(true);
    this.error.set(null);

    const params: any = {};
    if (this.filtroRol()) params.id_rol = this.filtroRol();
    if (this.filtroEstado()) params.estado = this.filtroEstado();
    if (this.busqueda()) params.search = this.busqueda();

    this.http.get<any>(`${environment.apiUrl}/personal`, { params }).subscribe({
      next: (res) => {
        if (res.success) this.personal.set(res.data);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error.set('No se pudo cargar el personal');
        this.cargando.set(false);
      },
    });
  }

  cargarRoles(): void {
    this.http.get<any>(`${environment.apiUrl}/personal/roles`).subscribe({
      next: (res) => {
        if (res.success) this.roles.set(res.data);
      },
    });
  }

  aplicarFiltros(): void {
    this.cargarPersonal();
  }

  limpiarFiltros(): void {
    this.filtroRol.set('');
    this.filtroEstado.set('');
    this.busqueda.set('');
    this.cargarPersonal();
  }

  // ============================================================
  // MODAL NUEVO
  // ============================================================
  abrirModalNuevo(): void {
    this.formNuevo = {
      dni: '',
      nombres: '',
      apellidos: '',
      correo_institucional: '',
      correo_personal: '',
      telefono: '',
      id_rol: 2,
      especialidad: '',
      cargo: '',
      password: 'UC2026*',
    };
    this.errorNuevo.set(null);
    this.modalNuevo.set(true);
  }

  cerrarModalNuevo(): void {
    this.modalNuevo.set(false);
  }

  guardarNuevo(): void {
    if (!this.formNuevo.dni || this.formNuevo.dni.length !== 8) {
      this.errorNuevo.set('El DNI debe tener 8 dígitos');
      return;
    }
    if (!this.formNuevo.nombres || !this.formNuevo.apellidos) {
      this.errorNuevo.set('Nombres y apellidos son obligatorios');
      return;
    }

    if (!this.formNuevo.correo_personal || !this.formNuevo.correo_personal.includes('@')) {
      this.errorNuevo.set('El correo personal es obligatorio (para notificaciones y recuperación)');
      return;
    }

    this.guardandoNuevo.set(true);
    this.errorNuevo.set(null);

    const payload = {
      ...this.formNuevo,
      id_rol: parseInt(this.formNuevo.id_rol),
    };

    this.http.post<any>(`${environment.apiUrl}/personal`, payload).subscribe({
      next: (res) => {
        this.guardandoNuevo.set(false);
        if (res.success) {
          alert(
            `✅ Personal registrado exitosamente\n\n` +
              `Nombre: ${res.data.nombre_completo}\n` +
              `Correo: ${res.data.correo_institucional}\n` +
              `Password temporal: ${res.data.password_temporal}`,
          );
          this.cerrarModalNuevo();
          this.cargarPersonal();
        }
      },
      error: (err) => {
        this.guardandoNuevo.set(false);
        this.errorNuevo.set(err.error?.message || 'Error al registrar');
      },
    });
  }

  // ============================================================
  // MODAL EDITAR
  // ============================================================
  abrirModalEditar(p: Personal): void {
    this.personalEditando.set(p);
    this.formEditar = {
      nombres: p.nombres,
      apellidos: p.apellidos,
      correo_institucional: p.correo_institucional,
      telefono: p.telefono || '',
      id_rol: p.id_rol,
      especialidad: p.especialidad || '',
      cargo: p.cargo || '',
    };
    this.errorEditar.set(null);
    this.modalEditar.set(true);
  }

  cerrarModalEditar(): void {
    this.modalEditar.set(false);
  }

  guardarEditar(): void {
    const p = this.personalEditando();
    if (!p) return;

    this.guardandoEditar.set(true);
    this.errorEditar.set(null);

    const payload = {
      ...this.formEditar,
      id_rol: parseInt(this.formEditar.id_rol),
    };

    this.http.put<any>(`${environment.apiUrl}/personal/${p.id_personal}`, payload).subscribe({
      next: (res) => {
        this.guardandoEditar.set(false);
        if (res.success) {
          alert('✅ Ficha actualizada correctamente');
          this.cerrarModalEditar();
          this.cargarPersonal();
        }
      },
      error: (err) => {
        this.guardandoEditar.set(false);
        this.errorEditar.set(err.error?.message || 'Error al actualizar');
      },
    });
  }

  // ============================================================
  // MODAL CESE
  // ============================================================
  abrirModalCese(p: Personal): void {
    if (p.estado === 'CESADO') {
      alert('Este trabajador ya está cesado');
      return;
    }
    this.personalCese.set(p);
    this.motivoCese.set('');
    this.fechaCese.set(new Date().toISOString().split('T')[0]);
    this.modalCese.set(true);
  }

  cerrarModalCese(): void {
    this.modalCese.set(false);
  }

  confirmarCese(): void {
    if (!this.motivoCese()) {
      alert('Seleccione un motivo de cese');
      return;
    }

    const p = this.personalCese();
    if (!p) return;

    this.procesandoCese.set(true);

    this.http
      .put<any>(`${environment.apiUrl}/personal/${p.id_personal}/cesar`, {
        motivo_cese: this.motivoCese(),
        fecha_cese: this.fechaCese(),
      })
      .subscribe({
        next: (res) => {
          this.procesandoCese.set(false);
          if (res.success) {
            alert(`✅ Cese registrado para ${p.nombre_completo}`);
            this.cerrarModalCese();
            this.cargarPersonal();
          }
        },
        error: (err) => {
          this.procesandoCese.set(false);
          alert('Error: ' + (err.error?.message || 'Error al cesar'));
        },
      });
  }

  // ============================================================
  // MODAL REACTIVAR
  // ============================================================
  reactivar(p: Personal): void {
    if (!confirm(`¿Reactivar a ${p.nombre_completo}?`)) return;

    this.http.put<any>(`${environment.apiUrl}/personal/${p.id_personal}/reactivar`, {}).subscribe({
      next: (res) => {
        if (res.success) {
          alert('✅ Trabajador reactivado');
          this.cargarPersonal();
        }
      },
      error: (err) => alert('Error: ' + (err.error?.message || 'Error al reactivar')),
    });
  }

  // ============================================================
  // MODAL RESET PASSWORD
  // ============================================================
  abrirModalPassword(p: Personal): void {
    this.personalPassword.set(p);
    this.passwordTemporal.set('');
    this.modalPassword.set(true);
  }

  cerrarModalPassword(): void {
    this.modalPassword.set(false);
    this.personalPassword.set(null);
    this.passwordTemporal.set('');
  }

  confirmarResetPassword(): void {
    const p = this.personalPassword();
    if (!p) return;

    if (!confirm(`¿Restablecer contraseña de ${p.nombre_completo}?`)) return;

    this.procesandoPassword.set(true);

    this.http
      .put<any>(`${environment.apiUrl}/personal/${p.id_personal}/reset-password`, {})
      .subscribe({
        next: (res) => {
          this.procesandoPassword.set(false);
          if (res.success) {
            this.passwordTemporal.set(res.data.password_temporal);
          }
        },
        error: (err) => {
          this.procesandoPassword.set(false);
          alert('Error: ' + (err.error?.message || 'Error al restablecer'));
        },
      });
  }

  // ============================================================
  // MODAL CARNÉ QR
  // ============================================================
  abrirModalCarne(p: Personal): void {
    this.personalCarne.set(p);
    this.modalCarne.set(true);
  }

  cerrarModalCarne(): void {
    this.modalCarne.set(false);
    this.personalCarne.set(null);
  }

  // ============================================================
  // HELPERS
  // ============================================================
  getEstadoClass(estado: string): string {
    switch (estado) {
      case 'ACTIVO':
        return 'activo';
      case 'CESADO':
        return 'cesado';
      case 'INACTIVO':
        return 'inactivo';
      default:
        return '';
    }
  }

  getRolClass(rol: string): string {
    switch (rol) {
      case 'ADMIN':
        return 'admin';
      case 'DOCENTE':
        return 'docente';
      case 'SECRETARIA':
        return 'secretaria';
      default:
        return '';
    }
  }

  getIniciales(p: Personal): string {
    return `${p.nombres.charAt(0)}${p.apellidos.charAt(0)}`.toUpperCase();
  }
}
