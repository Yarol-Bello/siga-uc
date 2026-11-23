import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, forkJoin } from 'rxjs';
import {
  ConfiguracionAdminService,
  PreviewTarifa,
  Tarifa,
} from '../../../../core/services/configuracion-admin.service';
import { ConfiguracionService } from '../../../../core/services/configuracion.service';
import { AnioLectivoService } from '../../../../core/services/anio-lectivo.service';
import { SelectorAnioComponent } from '../../../../shared/components/selector-anio/selector-anio.component';

interface FormTarifa {
  nombre: string;
  monto_base: number | null;
  tipo: string;
  mes: number | null;
  nivel: string | null;
  id_grado: number | null;
  activo: boolean;
  descripcion: string;
  orden: number;
  vigente_desde: string;
  vigente_hasta: string | null;
  alcance: 'GLOBAL' | 'NIVEL' | 'GRADO';
}

/**
 * Tarifas y conceptos de pago (Fase 2 / H75).
 */
@Component({
  selector: 'app-admin-tarifas',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectorAnioComponent],
  templateUrl: './admin-tarifas.component.html',
  styleUrl: './admin-tarifas.component.scss',
})
export class AdminTarifasComponent implements OnInit {
  private adminService = inject(ConfiguracionAdminService);
  private configuracion = inject(ConfiguracionService);
  private anioLectivoService = inject(AnioLectivoService);

  anioActivo = this.configuracion.anioLectivo;
  anioSeleccionado = signal<number>(this.configuracion.anioLectivo());
  anios = computed(() =>
    this.anioLectivoService.anios().map((item) => Number(item.anio)),
  );
  esHistorico = computed(
    () => this.anioSeleccionado() !== this.anioActivo(),
  );

  cargando = signal(true);
  guardando = signal(false);
  error = signal<string | null>(null);
  exito = signal<string | null>(null);
  tarifas = signal<Tarifa[]>([]);
  grados = signal<any[]>([]);
  tipoFiltro = signal('');
  incluirInactivos = signal(true);
  niveles = computed(() => [
    ...new Set(
      this.grados()
        .map((g) => g.nivel)
        .filter((n): n is string => Boolean(n)),
    ),
  ]);

  tarifasFiltradas = computed(() => {
    const tipo = this.tipoFiltro();
    return this.tarifas().filter((t) => !tipo || t.tipo === tipo);
  });

  modalFormulario = signal(false);
  modo = signal<'crear' | 'editar' | 'version'>('crear');
  tarifaEditando = signal<Tarifa | null>(null);
  form: FormTarifa = this.formVacio();
  errorLocal = signal<string | null>(null);

  preview = signal<PreviewTarifa | null>(null);
  modalPreview = signal(false);
  motivo = signal('');
  errorModal = signal<string | null>(null);

  modalDesactivar = signal(false);
  motivoDesactivar = signal('');
  tarifaDesactivar = signal<Tarifa | null>(null);

  readonly meses = [
    { num: 1, nombre: 'Enero' },
    { num: 2, nombre: 'Febrero' },
    { num: 3, nombre: 'Marzo' },
    { num: 4, nombre: 'Abril' },
    { num: 5, nombre: 'Mayo' },
    { num: 6, nombre: 'Junio' },
    { num: 7, nombre: 'Julio' },
    { num: 8, nombre: 'Agosto' },
    { num: 9, nombre: 'Setiembre' },
    { num: 10, nombre: 'Octubre' },
    { num: 11, nombre: 'Noviembre' },
    { num: 12, nombre: 'Diciembre' },
  ];

  ngOnInit(): void {
    this.anioLectivoService.asegurarCargado().catch(() => {});
    this.cargar();
  }

  cambiarAnio(anio: number): void {
    this.anioSeleccionado.set(anio);
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.exito.set(null);
    const anio = this.anioSeleccionado();
    forkJoin({
      tarifas: this.adminService.listarTarifas(anio, {
        incluirInactivos: this.incluirInactivos(),
      }),
      grados: this.adminService.listarGrados(anio),
    }).subscribe({
      next: ({ tarifas, grados }) => {
        this.cargando.set(false);
        if (!tarifas.success) {
          this.error.set('No se pudieron cargar las tarifas.');
          return;
        }
        this.tarifas.set(tarifas.data || []);
        this.grados.set(grados.data || []);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(this.mensajeError(err));
      },
    });
  }

  abrirNueva(): void {
    if (this.esHistorico()) return;
    this.modo.set('crear');
    this.tarifaEditando.set(null);
    this.form = this.formVacio();
    this.form.vigente_desde = `${this.anioSeleccionado()}-01-01`;
    this.errorLocal.set(null);
    this.modalFormulario.set(true);
  }

  abrirEditar(tarifa: Tarifa): void {
    if (!this.puedeEditar(tarifa)) return;
    this.modo.set('editar');
    this.tarifaEditando.set(tarifa);
    this.form = this.formDesdeTarifa(tarifa);
    this.errorLocal.set(null);
    this.modalFormulario.set(true);
  }

  abrirVersion(tarifa: Tarifa): void {
    if (this.esHistorico()) return;
    this.modo.set('version');
    this.tarifaEditando.set(tarifa);
    this.form = this.formDesdeTarifa(tarifa);
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    this.form.vigente_desde = manana.toISOString().slice(0, 10);
    this.form.vigente_hasta = null;
    this.errorLocal.set(null);
    this.modalFormulario.set(true);
  }

  cerrarFormulario(): void {
    if (this.guardando()) return;
    this.modalFormulario.set(false);
    this.errorLocal.set(null);
  }

  cambiarAlcance(): void {
    if (this.form.alcance === 'GLOBAL') {
      this.form.nivel = null;
      this.form.id_grado = null;
    } else if (this.form.alcance === 'NIVEL') {
      this.form.id_grado = null;
    } else {
      this.form.nivel = null;
    }
  }

  cambiarTipo(): void {
    if (this.form.tipo !== 'PENSION') {
      this.form.mes = null;
    }
  }

  solicitarPreview(): void {
    if (!this.validarLocal()) return;
    this.guardando.set(true);
    this.errorLocal.set(null);
    this.adminService
      .previewTarifa({ ...this.payload(), modo: this.modo() })
      .subscribe({
      next: (res) => {
        this.guardando.set(false);
        if (!res.success) {
          this.errorLocal.set('No se pudo generar la vista previa.');
          return;
        }
        this.preview.set(res.data);
        this.motivo.set('');
        this.errorModal.set(null);
        this.modalFormulario.set(false);
        this.modalPreview.set(true);
      },
      error: (err) => {
        this.guardando.set(false);
        this.errorLocal.set(this.mensajeError(err));
      },
    });
  }

  cerrarPreview(): void {
    if (this.guardando()) return;
    this.modalPreview.set(false);
    this.preview.set(null);
    this.errorModal.set(null);
  }

  confirmarPreview(): void {
    const vista = this.preview();
    if (!vista) return;
    const motivo = this.motivo().trim();
    if (motivo.length < 10) {
      this.errorModal.set('El motivo debe tener al menos 10 caracteres.');
      return;
    }

    this.guardando.set(true);
    this.errorModal.set(null);
    const payload = {
      ...this.payload(),
      preview_hash: vista.preview_hash,
      motivo,
    };

    const solicitud: Observable<any> =
      this.modo() === 'version' && this.tarifaEditando()
        ? this.adminService.programarVersionTarifa(
            this.tarifaEditando()!.id_concepto,
            payload,
          )
        : this.modo() === 'editar' && this.tarifaEditando()
          ? this.adminService.actualizarTarifa(
              this.tarifaEditando()!.id_concepto,
              payload,
            )
          : this.adminService.crearTarifa(payload);

    solicitud.subscribe({
      next: (res: any) => {
        this.guardando.set(false);
        this.modalPreview.set(false);
        this.preview.set(null);
        this.exito.set(
          this.modo() === 'version'
            ? 'Nueva versión programada correctamente.'
            : this.modo() === 'editar'
              ? 'Tarifa actualizada correctamente.'
              : 'Tarifa creada correctamente.',
        );
        this.cargar();
      },
      error: (err: any) => {
        this.guardando.set(false);
        this.errorModal.set(this.mensajeError(err));
      },
    });
  }

  abrirDesactivar(tarifa: Tarifa): void {
    if (this.esHistorico() || !tarifa.activo) return;
    this.tarifaDesactivar.set(tarifa);
    this.motivoDesactivar.set('');
    this.errorModal.set(null);
    this.modalDesactivar.set(true);
  }

  cerrarDesactivar(): void {
    if (this.guardando()) return;
    this.modalDesactivar.set(false);
    this.tarifaDesactivar.set(null);
  }

  confirmarDesactivar(): void {
    const tarifa = this.tarifaDesactivar();
    if (!tarifa) return;
    const motivo = this.motivoDesactivar().trim();
    if (motivo.length < 10) {
      this.errorModal.set('El motivo debe tener al menos 10 caracteres.');
      return;
    }
    this.guardando.set(true);
    this.errorModal.set(null);
    this.adminService
      .desactivarTarifa(tarifa.id_concepto, motivo)
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.modalDesactivar.set(false);
          this.tarifaDesactivar.set(null);
          this.exito.set('Tarifa desactivada correctamente.');
          this.cargar();
        },
        error: (err) => {
          this.guardando.set(false);
          this.errorModal.set(this.mensajeError(err));
        },
      });
  }

  puedeEditar(tarifa: Tarifa): boolean {
    return (
      !this.esHistorico() &&
      tarifa.activo &&
      this.totalDependencias(tarifa) === 0
    );
  }

  totalDependencias(tarifa: Tarifa): number {
    return (
      Number(tarifa.pagos || 0) +
      Number(tarifa.pretickets || 0) +
      Number(tarifa.pensiones || 0)
    );
  }

  alcanceTexto(tarifa: Tarifa): string {
    if (tarifa.id_grado) {
      return `${tarifa.nombre_grado || 'Grado'} ${tarifa.seccion || ''}`.trim();
    }
    if (tarifa.nivel) return `Nivel ${tarifa.nivel}`;
    return 'Todos';
  }

  mesTexto(tarifa: Tarifa): string {
    if (!tarifa.mes) return '—';
    return this.meses.find((m) => m.num === tarifa.mes)?.nombre || String(tarifa.mes);
  }

  tipoTexto(tipo: string): string {
    return tipo === 'MATRICULA'
      ? 'Matrícula'
      : tipo === 'PENSION'
        ? 'Pensión'
        : 'Otros';
  }

  montoTexto(tarifa: Tarifa): string {
    return Number(tarifa.monto_base || 0).toFixed(2);
  }

  private formVacio(): FormTarifa {
    return {
      nombre: '',
      monto_base: null,
      tipo: 'MATRICULA',
      mes: null,
      nivel: null,
      id_grado: null,
      activo: true,
      descripcion: '',
      orden: 0,
      vigente_desde: `${this.anioSeleccionado()}-01-01`,
      vigente_hasta: null,
      alcance: 'GLOBAL',
    };
  }

  private formDesdeTarifa(tarifa: Tarifa): FormTarifa {
    return {
      nombre: tarifa.nombre,
      monto_base: Number(tarifa.monto_base),
      tipo: tarifa.tipo,
      mes: tarifa.mes,
      nivel: tarifa.nivel,
      id_grado: tarifa.id_grado,
      activo: tarifa.activo,
      descripcion: tarifa.descripcion || '',
      orden: tarifa.orden,
      vigente_desde: tarifa.vigente_desde,
      vigente_hasta: tarifa.vigente_hasta,
      alcance: tarifa.id_grado ? 'GRADO' : tarifa.nivel ? 'NIVEL' : 'GLOBAL',
    };
  }

  private payload(): any {
    return {
      id_concepto: this.tarifaEditando()?.id_concepto || null,
      nombre: this.form.nombre.trim(),
      monto_base: Number(this.form.monto_base),
      tipo: this.form.tipo,
      mes: this.form.tipo === 'PENSION' ? Number(this.form.mes) : null,
      anio_lectivo: this.anioSeleccionado(),
      nivel: this.form.alcance === 'NIVEL' ? this.form.nivel : null,
      id_grado: this.form.alcance === 'GRADO' ? this.form.id_grado : null,
      activo: this.form.activo,
      descripcion: this.form.descripcion?.trim() || null,
      orden: Number(this.form.orden || 0),
      vigente_desde: this.form.vigente_desde,
      vigente_hasta: this.form.vigente_hasta || null,
    };
  }

  private validarLocal(): boolean {
    this.errorLocal.set(null);
    if (!this.form.nombre?.trim()) {
      this.errorLocal.set('El nombre del concepto es obligatorio.');
      return false;
    }
    if (!this.form.monto_base || Number(this.form.monto_base) <= 0) {
      this.errorLocal.set('El monto debe ser mayor que cero.');
      return false;
    }
    if (this.form.tipo === 'PENSION' && !this.form.mes) {
      this.errorLocal.set('Seleccione el mes de la pensión.');
      return false;
    }
    if (this.form.alcance === 'NIVEL' && !this.form.nivel) {
      this.errorLocal.set('Seleccione el nivel.');
      return false;
    }
    if (this.form.alcance === 'GRADO' && !this.form.id_grado) {
      this.errorLocal.set('Seleccione el grado.');
      return false;
    }
    if (!this.form.vigente_desde) {
      this.errorLocal.set('Indique la fecha de vigencia inicial.');
      return false;
    }
    if (
      this.form.vigente_hasta &&
      this.form.vigente_hasta < this.form.vigente_desde
    ) {
      this.errorLocal.set(
        'La vigencia final no puede ser anterior a la inicial.',
      );
      return false;
    }
    return true;
  }

  private mensajeError(err: any): string {
    return (
      err?.error?.message ||
      err?.message ||
      'No se pudo completar la operación. Intente nuevamente.'
    );
  }
}
