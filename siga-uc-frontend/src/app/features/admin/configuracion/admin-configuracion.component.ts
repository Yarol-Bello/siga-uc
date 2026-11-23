import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ConfiguracionAdmin,
  ConfiguracionAdminService,
  InstitucionConfig,
} from '../../../core/services/configuracion-admin.service';
import { ConfiguracionService } from '../../../core/services/configuracion.service';

/**
 * Configuración general del sistema (Fase 1 / H74).
 * Solo edita la configuración institucional global. Las tarifas, cursos,
 * horarios y becas se incorporan en las fases siguientes.
 */
@Component({
  selector: 'app-admin-configuracion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-configuracion.component.html',
  styleUrl: './admin-configuracion.component.scss',
})
export class AdminConfiguracionComponent implements OnInit {
  private adminService = inject(ConfiguracionAdminService);
  private configuracionPublica = inject(ConfiguracionService);

  cargando = signal(true);
  guardando = signal(false);
  error = signal<string | null>(null);
  exito = signal<string | null>(null);
  errorLocal = signal<string | null>(null);
  errorModal = signal<string | null>(null);
  datos = signal<ConfiguracionAdmin | null>(null);

  modalGuardar = signal(false);
  motivo = signal('');

  form: Partial<InstitucionConfig> = {};

  anioActivo = computed(() => this.datos()?.anio_lectivo ?? null);
  anios = computed(() => this.datos()?.anios ?? []);

  readonly zonasSugeridas = [
    'America/Lima',
    'America/Bogota',
    'America/Mexico_City',
    'America/Santiago',
    'America/Argentina/Buenos_Aires',
    'UTC',
  ];

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.errorLocal.set(null);
    this.adminService.obtener().subscribe({
      next: (res) => {
        this.cargando.set(false);
        if (!res.success || !res.data?.institucion) {
          this.error.set('No se pudo cargar la configuración.');
          return;
        }
        this.datos.set(res.data);
        this.form = { ...res.data.institucion };
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(this.mensajeError(err));
      },
    });
  }

  abrirModal(): void {
    this.exito.set(null);
    if (!this.validarLocal()) return;
    this.errorModal.set(null);
    this.motivo.set('');
    this.modalGuardar.set(true);
  }

  cerrarModal(): void {
    if (this.guardando()) return;
    this.modalGuardar.set(false);
    this.errorModal.set(null);
  }

  confirmarGuardado(): void {
    const motivo = this.motivo().trim();
    if (motivo.length < 10) {
      this.errorModal.set('El motivo debe tener al menos 10 caracteres.');
      return;
    }
    if (motivo.length > 500) {
      this.errorModal.set('El motivo no puede superar 500 caracteres.');
      return;
    }

    this.guardando.set(true);
    this.errorModal.set(null);

    this.adminService
      .actualizarInstitucion({ ...this.payload(), motivo })
      .subscribe({
        next: (res) => {
          this.guardando.set(false);
          this.modalGuardar.set(false);
          if (!res.success || !res.data?.institucion) {
            this.errorModal.set('No se pudo guardar la configuración.');
            return;
          }
          const institucion = res.data.institucion;
          this.form = { ...institucion };
          this.datos.update((actual) =>
            actual ? { ...actual, institucion } : actual
          );
          this.exito.set(
            res.data.sin_cambios
              ? 'No había cambios que guardar.'
              : 'Configuración guardada correctamente.'
          );
          this.configuracionPublica.recargar();
        },
        error: (err) => {
          this.guardando.set(false);
          this.errorModal.set(this.mensajeError(err));
        },
      });
  }

  private payload(): Partial<InstitucionConfig> {
    const f = this.form;
    return {
      nombre_institucion: f.nombre_institucion?.trim(),
      nombre_corto: f.nombre_corto?.trim() || null,
      ruc: f.ruc?.trim() || null,
      direccion: f.direccion?.trim() || null,
      distrito: f.distrito?.trim() || null,
      provincia: f.provincia?.trim() || null,
      departamento: f.departamento?.trim() || null,
      pais: f.pais?.trim() || null,
      telefono: f.telefono?.trim() || null,
      correo_contacto: f.correo_contacto?.trim() || null,
      sitio_web: f.sitio_web?.trim() || null,
      logo_url: f.logo_url?.trim() || null,
      moneda: f.moneda?.trim().toUpperCase() || 'PEN',
      simbolo_moneda: f.simbolo_moneda?.trim() || 'S/',
      zona_horaria: f.zona_horaria?.trim() || 'America/Lima',
      locale: f.locale?.trim() || 'es-PE',
      nombre_remitente: f.nombre_remitente?.trim() || null,
      texto_boleta: f.texto_boleta?.trim() || null,
      texto_libreta: f.texto_libreta?.trim() || null,
      texto_acta: f.texto_acta?.trim() || null,
      texto_pie: f.texto_pie?.trim() || null,
      serie_boleta: f.serie_boleta?.trim().toUpperCase() || null,
      numero_boleta_inicial:
        f.numero_boleta_inicial === null ||
        f.numero_boleta_inicial === undefined
          ? null
          : Number(f.numero_boleta_inicial),
    };
  }

  private validarLocal(): boolean {
    const f = this.form;
    if (!f.nombre_institucion?.trim()) {
      this.errorLocal.set('El nombre de la institución es obligatorio.');
      return false;
    }
    if (f.nombre_institucion.trim().length > 200) {
      this.errorLocal.set('El nombre no puede superar 200 caracteres.');
      return false;
    }
    if (f.ruc && !/^\d{11}$/.test(f.ruc.trim())) {
      this.errorLocal.set('El RUC debe tener 11 dígitos.');
      return false;
    }
    if (
      f.correo_contacto &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.correo_contacto.trim())
    ) {
      this.errorLocal.set('El correo de contacto no tiene un formato válido.');
      return false;
    }
    if (f.sitio_web && !/^https?:\/\//i.test(f.sitio_web.trim())) {
      this.errorLocal.set('El sitio web debe empezar con http:// o https://.');
      return false;
    }
    if (f.logo_url && !/^https?:\/\//i.test(f.logo_url.trim())) {
      this.errorLocal.set('El logo debe ser una URL http(s).');
      return false;
    }
    if (!f.moneda || !/^[A-Za-z]{3}$/.test(f.moneda.trim())) {
      this.errorLocal.set('La moneda debe tener 3 letras (por ejemplo PEN).');
      return false;
    }
    if (!f.simbolo_moneda?.trim()) {
      this.errorLocal.set('El símbolo de moneda es obligatorio.');
      return false;
    }
    if (!f.zona_horaria?.trim()) {
      this.errorLocal.set('La zona horaria es obligatoria.');
      return false;
    }
    if (!f.locale || !/^[a-z]{2}-[A-Z]{2}$/.test(f.locale.trim())) {
      this.errorLocal.set('El locale debe tener el formato es-PE.');
      return false;
    }
    if (f.serie_boleta && !/^[A-Za-z0-9]{1,10}$/.test(f.serie_boleta.trim())) {
      this.errorLocal.set('La serie de boleta solo admite letras y números.');
      return false;
    }
    if (
      f.numero_boleta_inicial !== null &&
      f.numero_boleta_inicial !== undefined &&
      (!Number.isInteger(Number(f.numero_boleta_inicial)) ||
        Number(f.numero_boleta_inicial) < 0 ||
        Number(f.numero_boleta_inicial) > 999999)
    ) {
      this.errorLocal.set('El número inicial de boleta debe estar entre 0 y 999999.');
      return false;
    }
    this.errorLocal.set(null);
    return true;
  }

  private mensajeError(err: any): string {
    return (
      err?.error?.message ||
      err?.message ||
      'No se pudo completar la operación. Intente nuevamente.'
    );
  }

  diasTexto(anio: { dias_clase: string[] | null }): string {
    return anio.dias_clase?.length ? anio.dias_clase.join(', ') : 'Sin configurar';
  }

  jornadaTexto(anio: {
    hora_inicio_jornada: string | null;
    hora_fin_jornada: string | null;
  }): string {
    if (!anio.hora_inicio_jornada || !anio.hora_fin_jornada) {
      return 'Sin configurar';
    }
    return `${anio.hora_inicio_jornada.substring(0, 5)}–${anio.hora_fin_jornada.substring(0, 5)}`;
  }
}
