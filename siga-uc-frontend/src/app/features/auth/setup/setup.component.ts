import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  SetupEstado,
  SetupPayload,
  SetupService,
} from '../../../core/services/setup.service';
import { ConfiguracionService } from '../../../core/services/configuracion.service';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.scss',
})
export class SetupComponent implements OnInit {
  private setupService = inject(SetupService);
  private configuracion = inject(ConfiguracionService);
  private router = inject(Router);

  readonly anioActual = new Date().getFullYear();
  readonly nivelesDisponibles = [
    { valor: 'INICIAL', label: 'Inicial', detalle: '3, 4 y 5 años' },
    { valor: 'PRIMARIA', label: 'Primaria', detalle: '1ro a 6to' },
    { valor: 'SECUNDARIA', label: 'Secundaria', detalle: '1ro a 5to' },
  ];

  estado = signal<SetupEstado | null>(null);
  cargandoEstado = signal(true);
  errorEstado = signal<string | null>(null);
  paso = signal(1);
  guardando = signal(false);
  error = signal<string | null>(null);
  exito = signal<any | null>(null);
  mostrarPassword = signal(false);

  form = {
    token: '',
    institucion: {
      nombre_institucion: '',
      nombre_corto: '',
      ruc: '',
      direccion: '',
      distrito: '',
      provincia: '',
      departamento: '',
      telefono: '',
      correo_contacto: '',
      sitio_web: '',
      logo_url: '',
    },
    anio_lectivo: this.anioActual,
    fecha_inicio: `${this.anioActual}-03-01`,
    fecha_fin: `${this.anioActual}-12-31`,
    niveles: [] as string[],
    admin: {
      dni: '',
      nombres: '',
      apellidos: '',
      correo: '',
      telefono: '',
      password: '',
      confirmar_password: '',
    },
  };

  ngOnInit(): void {
    this.cargarEstado();
  }

  cargarEstado(): void {
    this.cargandoEstado.set(true);
    this.setupService.estado().subscribe({
      next: (respuesta) => {
        this.cargandoEstado.set(false);
        const data = respuesta?.data;
        this.estado.set(data || null);
        if (!data?.setup_disponible) {
          this.errorEstado.set(
            data?.mensaje ||
              'La configuración inicial no está disponible. Verifique la migración H79.',
          );
          return;
        }
        if (!data.requiere_setup) {
          this.router.navigate(['/login']);
          return;
        }
        if (!data.token_configurado) {
          this.errorEstado.set(
            'Falta SETUP_TOKEN en el servidor. Defina un token de al menos 16 caracteres y reinicie el backend.',
          );
          return;
        }
        const sugerido = Number(data.anio_lectivo_sugerido);
        if (Number.isInteger(sugerido) && sugerido >= 2000) {
          this.form.anio_lectivo = sugerido;
          this.form.fecha_inicio = `${sugerido}-03-01`;
          this.form.fecha_fin = `${sugerido}-12-31`;
        }
      },
      error: () => {
        this.cargandoEstado.set(false);
        this.errorEstado.set(
          'No se pudo consultar el estado de configuración. Verifique que el backend esté disponible.',
        );
      },
    });
  }

  nivelMarcado(nivel: string): boolean {
    return this.form.niveles.includes(nivel);
  }

  toggleNivel(nivel: string, marcado: boolean): void {
    const actuales = new Set(this.form.niveles);
    if (marcado) actuales.add(nivel);
    else actuales.delete(nivel);
    this.form.niveles = this.nivelesDisponibles
      .map((n) => n.valor)
      .filter((n) => actuales.has(n));
  }

  siguiente(): void {
    this.error.set(null);
    if (this.paso() === 1 && !this.validarPaso1()) return;
    if (this.paso() === 2 && !this.validarPaso2()) return;
    if (this.paso() < 3) this.paso.update((p) => p + 1);
  }

  atras(): void {
    this.error.set(null);
    if (this.paso() > 1) this.paso.update((p) => p - 1);
  }

  private validarPaso1(): boolean {
    if (String(this.form.token || '').trim().length < 8) {
      this.error.set('Ingrese el token de configuración entregado por el sistema.');
      return false;
    }
    if (!this.form.institucion.nombre_institucion.trim()) {
      this.error.set('El nombre de la institución es obligatorio.');
      return false;
    }
    const ruc = this.form.institucion.ruc.trim();
    if (ruc && !/^\d{11}$/.test(ruc)) {
      this.error.set('El RUC debe tener 11 dígitos.');
      return false;
    }
    const correo = this.form.institucion.correo_contacto.trim();
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      this.error.set('El correo de contacto no es válido.');
      return false;
    }
    return true;
  }

  private validarPaso2(): boolean {
    const anio = Number(this.form.anio_lectivo);
    if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
      this.error.set('El año lectivo debe estar entre 2000 y 2100.');
      return false;
    }
    if (!this.form.fecha_inicio || !this.form.fecha_fin) {
      this.error.set('Indique el inicio y fin del año lectivo.');
      return false;
    }
    if (this.form.fecha_fin < this.form.fecha_inicio) {
      this.error.set('La fecha de fin no puede ser anterior al inicio.');
      return false;
    }
    if (this.form.niveles.length === 0) {
      this.error.set('Seleccione al menos un nivel para crear los grados.');
      return false;
    }
    return true;
  }

  private validarPaso3(): boolean {
    const admin = this.form.admin;
    if (!/^\d{8}$/.test(admin.dni.trim())) {
      this.error.set('El DNI del administrador debe tener 8 dígitos.');
      return false;
    }
    if (!admin.nombres.trim() || !admin.apellidos.trim()) {
      this.error.set('Nombres y apellidos del administrador son obligatorios.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin.correo.trim())) {
      this.error.set('El correo del administrador no es válido.');
      return false;
    }
    if (admin.password.length < 8) {
      this.error.set('La contraseña debe tener al menos 8 caracteres.');
      return false;
    }
    if (admin.password !== admin.confirmar_password) {
      this.error.set('La confirmación de contraseña no coincide.');
      return false;
    }
    return true;
  }

  finalizar(): void {
    this.error.set(null);
    if (!this.validarPaso1() || !this.validarPaso2() || !this.validarPaso3()) {
      return;
    }

    const payload: SetupPayload = {
      token: this.form.token.trim(),
      institucion: {
        nombre_institucion: this.form.institucion.nombre_institucion.trim(),
        nombre_corto:
          this.form.institucion.nombre_corto.trim() ||
          this.form.institucion.nombre_institucion.trim(),
        ruc: this.form.institucion.ruc.trim() || undefined,
        direccion: this.form.institucion.direccion.trim() || undefined,
        distrito: this.form.institucion.distrito.trim() || undefined,
        provincia: this.form.institucion.provincia.trim() || undefined,
        departamento: this.form.institucion.departamento.trim() || undefined,
        telefono: this.form.institucion.telefono.trim() || undefined,
        correo_contacto:
          this.form.institucion.correo_contacto.trim() || undefined,
        sitio_web: this.form.institucion.sitio_web.trim() || undefined,
        logo_url: this.form.institucion.logo_url.trim() || undefined,
      },
      anio_lectivo: Number(this.form.anio_lectivo),
      fecha_inicio: this.form.fecha_inicio,
      fecha_fin: this.form.fecha_fin,
      niveles: [...this.form.niveles],
      admin: {
        dni: this.form.admin.dni.trim(),
        nombres: this.form.admin.nombres.trim(),
        apellidos: this.form.admin.apellidos.trim(),
        correo: this.form.admin.correo.trim(),
        telefono: this.form.admin.telefono.trim() || undefined,
        password: this.form.admin.password,
        confirmar_password: this.form.admin.confirmar_password,
      },
    };

    this.guardando.set(true);
    this.setupService.inicializar(payload).subscribe({
      next: async (respuesta) => {
        this.guardando.set(false);
        this.exito.set(respuesta.data);
        await this.configuracion.recargar().catch(() => {});
      },
      error: (err) => {
        this.guardando.set(false);
        this.error.set(
          err?.error?.message ||
            'No se pudo completar la configuración inicial. Intente nuevamente.',
        );
      },
    });
  }

  irLogin(): void {
    this.router.navigate(['/login']);
  }

  togglePassword(): void {
    this.mostrarPassword.update((v) => !v);
  }
}
