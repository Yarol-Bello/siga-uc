import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  Beca,
  ConfiguracionAdminService,
  TipoBeca,
} from '../../../../core/services/configuracion-admin.service';
import { ConfiguracionService } from '../../../../core/services/configuracion.service';
import { AnioLectivoService } from '../../../../core/services/anio-lectivo.service';
import { SelectorAnioComponent } from '../../../../shared/components/selector-anio/selector-anio.component';

interface FormBeca {
  id_alumno: number | null;
  id_tipo_beca: number | null;
  alcance: 'MATRICULA' | 'PENSION' | 'AMBOS';
  modalidad: 'PORCENTAJE' | 'MONTO_FIJO';
  valor: number | null;
  monto_maximo: number | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  prioridad: number;
  motivo: string;
  evidencia_detalle: string;
  aprobar: boolean;
}

interface FormTipo {
  codigo: string;
  nombre: string;
  descripcion: string;
  alcance: 'MATRICULA' | 'PENSION' | 'AMBOS';
  modalidad: 'PORCENTAJE' | 'MONTO_FIJO';
  valor_default: number | null;
  tope_monto: number | null;
  permite_combinacion: boolean;
  grupo_exclusividad: string;
  prioridad: number;
  requiere_evidencia: boolean;
  requiere_aprobacion: boolean;
  activo: boolean;
  orden: number;
  motivo: string;
}

type AccionBeca = 'aprobar' | 'rechazar' | 'anular';

/**
 * Becas configurables y asignación por alumno (Fase 5 / H78).
 */
@Component({
  selector: 'app-admin-becas',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectorAnioComponent],
  templateUrl: './admin-becas.component.html',
  styleUrl: './admin-becas.component.scss',
})
export class AdminBecasComponent implements OnInit {
  private adminService = inject(ConfiguracionAdminService);
  private configuracion = inject(ConfiguracionService);
  private anioLectivoService = inject(AnioLectivoService);

  anioActivo = this.configuracion.anioLectivo;
  anioSeleccionado = signal(this.anioActivo());
  anios = computed(() =>
    this.anioLectivoService.anios().map((item) => Number(item.anio)),
  );
  esHistorico = computed(
    () => this.anioSeleccionado() !== this.anioActivo(),
  );

  vista = signal<'asignaciones' | 'tipos'>('asignaciones');
  cargando = signal(true);
  guardando = signal(false);
  error = signal<string | null>(null);
  exito = signal<string | null>(null);

  becas = signal<Beca[]>([]);
  tipos = signal<TipoBeca[]>([]);
  alumnos = signal<any[]>([]);

  busqueda = signal('');
  filtroEstado = signal('');
  filtroTipo = signal('');
  busquedaAlumno = signal('');

  tiposActivos = computed(() => this.tipos().filter((t) => t.activo));

  becasFiltradas = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const estado = this.filtroEstado();
    const idTipo = this.filtroTipo();
    return this.becas().filter((beca) => {
      if (estado && beca.estado !== estado) return false;
      if (idTipo && String(beca.id_tipo_beca) !== idTipo) return false;
      if (!texto) return true;
      const heno = `${beca.dni} ${beca.nombres} ${beca.apellidos} ${beca.alumno_nombre}`;
      return heno.toLowerCase().includes(texto);
    });
  });

  alumnosFiltrados = computed(() => {
    const texto = this.busquedaAlumno().trim().toLowerCase();
    if (!texto) return this.alumnos();
    return this.alumnos().filter((alumno) => {
      const heno = `${alumno.dni} ${alumno.nombres} ${alumno.apellidos}`;
      return heno.toLowerCase().includes(texto);
    });
  });

  modalBeca = signal(false);
  becaEditando = signal<Beca | null>(null);
  formBeca: FormBeca = this.formBecaVacio();
  errorBeca = signal<string | null>(null);

  modalTipo = signal(false);
  tipoEditando = signal<TipoBeca | null>(null);
  formTipo: FormTipo = this.formTipoVacio();
  errorTipo = signal<string | null>(null);

  modalAccion = signal(false);
  accion = signal<AccionBeca>('aprobar');
  becaAccion = signal<Beca | null>(null);
  motivoAccion = signal('');
  errorAccion = signal<string | null>(null);

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
      becas: this.adminService.listarBecas(anio),
      tipos: this.adminService.listarTiposBeca(true),
      alumnos: this.adminService.listarAlumnos(anio),
    }).subscribe({
      next: ({ becas, tipos, alumnos }) => {
        this.cargando.set(false);
        if (!becas.success || !tipos.success) {
          this.error.set('No se pudieron cargar las becas.');
          return;
        }
        this.becas.set(becas.data || []);
        this.tipos.set(tipos.data || []);
        this.alumnos.set(alumnos.success ? alumnos.data || [] : []);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(this.mensajeError(err));
      },
    });
  }

  private formBecaVacio(): FormBeca {
    return {
      id_alumno: null,
      id_tipo_beca: null,
      alcance: 'PENSION',
      modalidad: 'PORCENTAJE',
      valor: null,
      monto_maximo: null,
      fecha_inicio: new Date().toISOString().slice(0, 10),
      fecha_fin: null,
      prioridad: 0,
      motivo: '',
      evidencia_detalle: '',
      aprobar: true,
    };
  }

  private formTipoVacio(): FormTipo {
    return {
      codigo: '',
      nombre: '',
      descripcion: '',
      alcance: 'PENSION',
      modalidad: 'PORCENTAJE',
      valor_default: null,
      tope_monto: null,
      permite_combinacion: false,
      grupo_exclusividad: '',
      prioridad: 0,
      requiere_evidencia: false,
      requiere_aprobacion: true,
      activo: true,
      orden: 0,
      motivo: '',
    };
  }

  abrirNuevaBeca(): void {
    if (this.esHistorico()) return;
    this.becaEditando.set(null);
    this.formBeca = this.formBecaVacio();
    this.busquedaAlumno.set('');
    this.errorBeca.set(null);
    this.modalBeca.set(true);
  }

  abrirEditarBeca(beca: Beca): void {
    if (this.esHistorico() || beca.estado !== 'SOLICITADA') return;
    this.becaEditando.set(beca);
    this.formBeca = {
      id_alumno: beca.id_alumno,
      id_tipo_beca: beca.id_tipo_beca,
      alcance: beca.alcance,
      modalidad: beca.modalidad,
      valor: Number(beca.valor),
      monto_maximo:
        beca.monto_maximo === null ? null : Number(beca.monto_maximo),
      fecha_inicio: String(beca.fecha_inicio).slice(0, 10),
      fecha_fin: beca.fecha_fin
        ? String(beca.fecha_fin).slice(0, 10)
        : null,
      prioridad: Number(beca.prioridad || 0),
      motivo: beca.motivo || '',
      evidencia_detalle:
        beca.evidencia && typeof beca.evidencia === 'object'
          ? String(beca.evidencia.detalle || '')
          : '',
      aprobar: false,
    };
    this.busquedaAlumno.set('');
    this.errorBeca.set(null);
    this.modalBeca.set(true);
  }

  cerrarModalBeca(): void {
    if (this.guardando()) return;
    this.modalBeca.set(false);
    this.errorBeca.set(null);
  }

  alCambiarTipoBeca(): void {
    const tipo = this.tipos().find(
      (item) => item.id_tipo_beca === Number(this.formBeca.id_tipo_beca),
    );
    if (!tipo) return;
    this.formBeca.alcance =
      tipo.alcance === 'AMBOS' ? 'PENSION' : tipo.alcance;
    this.formBeca.modalidad = tipo.modalidad;
    this.formBeca.valor = Number(tipo.valor_default || 0);
    this.formBeca.monto_maximo =
      tipo.tope_monto === null ? null : Number(tipo.tope_monto);
    this.formBeca.prioridad = Number(tipo.prioridad || 0);
  }

  guardarBeca(): void {
    if (this.formBeca.id_alumno === null) {
      this.errorBeca.set('Seleccione un alumno.');
      return;
    }
    if (!this.formBeca.id_tipo_beca) {
      this.errorBeca.set('Seleccione un tipo de beca.');
      return;
    }
    const valor = Number(this.formBeca.valor || 0);
    if (valor <= 0) {
      this.errorBeca.set('El valor de la beca debe ser mayor que cero.');
      return;
    }
    if (this.formBeca.modalidad === 'PORCENTAJE' && valor > 100) {
      this.errorBeca.set('El porcentaje no puede superar 100.');
      return;
    }
    if (!this.formBeca.fecha_inicio) {
      this.errorBeca.set('Indique la fecha de inicio.');
      return;
    }
    if (
      this.formBeca.fecha_fin &&
      this.formBeca.fecha_fin < this.formBeca.fecha_inicio
    ) {
      this.errorBeca.set('La fecha de fin no puede ser anterior al inicio.');
      return;
    }
    if (this.formBeca.motivo.trim().length < 10) {
      this.errorBeca.set('El motivo debe tener al menos 10 caracteres.');
      return;
    }
    const tipo = this.tipos().find(
      (item) => item.id_tipo_beca === Number(this.formBeca.id_tipo_beca),
    );
    if (
      this.formBeca.aprobar &&
      tipo?.requiere_evidencia &&
      !this.formBeca.evidencia_detalle.trim()
    ) {
      this.errorBeca.set(
        'Este tipo de beca exige evidencia para aprobarse. Adjunte un detalle o registre la solicitud.',
      );
      return;
    }

    const payload = {
      id_alumno: this.formBeca.id_alumno,
      id_tipo_beca: this.formBeca.id_tipo_beca,
      alcance: this.formBeca.alcance,
      modalidad: this.formBeca.modalidad,
      valor,
      monto_maximo: this.formBeca.monto_maximo,
      fecha_inicio: this.formBeca.fecha_inicio,
      fecha_fin: this.formBeca.fecha_fin || null,
      prioridad: this.formBeca.prioridad,
      motivo: this.formBeca.motivo.trim(),
      evidencia: this.formBeca.evidencia_detalle.trim()
        ? { detalle: this.formBeca.evidencia_detalle.trim() }
        : null,
      aprobar: this.formBeca.aprobar,
    };

    this.guardando.set(true);
    this.errorBeca.set(null);
    const peticion = this.becaEditando()
      ? this.adminService.actualizarBeca(
          this.becaEditando()!.id_beca,
          payload,
        )
      : this.adminService.crearBeca(payload);

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.modalBeca.set(false);
        this.exito.set(
          this.becaEditando()
            ? 'Beca actualizada correctamente.'
            : payload.aprobar
              ? 'Beca registrada y aprobada. Se aplicó a los cargos pendientes.'
              : 'Solicitud de beca registrada. Queda pendiente de aprobación.',
        );
        this.cargar();
      },
      error: (err) => {
        this.guardando.set(false);
        this.errorBeca.set(this.mensajeError(err));
      },
    });
  }

  abrirNuevoTipo(): void {
    this.tipoEditando.set(null);
    this.formTipo = this.formTipoVacio();
    this.errorTipo.set(null);
    this.modalTipo.set(true);
  }

  abrirEditarTipo(tipo: TipoBeca): void {
    this.tipoEditando.set(tipo);
    this.formTipo = {
      codigo: tipo.codigo,
      nombre: tipo.nombre,
      descripcion: tipo.descripcion || '',
      alcance: tipo.alcance,
      modalidad: tipo.modalidad,
      valor_default: Number(tipo.valor_default || 0),
      tope_monto: tipo.tope_monto === null ? null : Number(tipo.tope_monto),
      permite_combinacion: tipo.permite_combinacion,
      grupo_exclusividad: tipo.grupo_exclusividad || '',
      prioridad: Number(tipo.prioridad || 0),
      requiere_evidencia: tipo.requiere_evidencia,
      requiere_aprobacion: tipo.requiere_aprobacion,
      activo: tipo.activo,
      orden: Number(tipo.orden || 0),
      motivo: '',
    };
    this.errorTipo.set(null);
    this.modalTipo.set(true);
  }

  cerrarModalTipo(): void {
    if (this.guardando()) return;
    this.modalTipo.set(false);
    this.errorTipo.set(null);
  }

  guardarTipo(): void {
    if (!/^[A-Za-z0-9_]{2,50}$/.test(this.formTipo.codigo.trim())) {
      this.errorTipo.set(
        'El código debe tener entre 2 y 50 letras, números o guiones bajos.',
      );
      return;
    }
    if (!this.formTipo.nombre.trim()) {
      this.errorTipo.set('El nombre es obligatorio.');
      return;
    }
    const valor = Number(this.formTipo.valor_default || 0);
    if (valor < 0) {
      this.errorTipo.set('El valor por defecto no puede ser negativo.');
      return;
    }
    if (this.formTipo.modalidad === 'PORCENTAJE' && valor > 100) {
      this.errorTipo.set('El porcentaje no puede superar 100.');
      return;
    }
    if (this.formTipo.motivo.trim().length < 10) {
      this.errorTipo.set('El motivo debe tener al menos 10 caracteres.');
      return;
    }

    const payload = {
      codigo: this.formTipo.codigo.trim().toUpperCase(),
      nombre: this.formTipo.nombre.trim(),
      descripcion: this.formTipo.descripcion.trim() || null,
      alcance: this.formTipo.alcance,
      modalidad: this.formTipo.modalidad,
      valor_default: valor,
      tope_monto: this.formTipo.tope_monto,
      permite_combinacion: this.formTipo.permite_combinacion,
      grupo_exclusividad:
        this.formTipo.grupo_exclusividad.trim() || null,
      prioridad: Number(this.formTipo.prioridad || 0),
      requiere_evidencia: this.formTipo.requiere_evidencia,
      requiere_aprobacion: this.formTipo.requiere_aprobacion,
      activo: this.formTipo.activo,
      orden: Number(this.formTipo.orden || 0),
      motivo: this.formTipo.motivo.trim(),
    };

    this.guardando.set(true);
    this.errorTipo.set(null);
    const peticion = this.tipoEditando()
      ? this.adminService.actualizarTipoBeca(
          this.tipoEditando()!.id_tipo_beca,
          payload,
        )
      : this.adminService.crearTipoBeca(payload);

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.modalTipo.set(false);
        this.exito.set(
          this.tipoEditando()
            ? 'Tipo de beca actualizado.'
            : 'Tipo de beca creado.',
        );
        this.cargar();
      },
      error: (err) => {
        this.guardando.set(false);
        this.errorTipo.set(this.mensajeError(err));
      },
    });
  }

  abrirAccion(beca: Beca, accion: AccionBeca): void {
    this.becaAccion.set(beca);
    this.accion.set(accion);
    this.motivoAccion.set('');
    this.errorAccion.set(null);
    this.modalAccion.set(true);
  }

  cerrarModalAccion(): void {
    if (this.guardando()) return;
    this.modalAccion.set(false);
    this.errorAccion.set(null);
  }

  confirmarAccion(): void {
    const beca = this.becaAccion();
    if (!beca) return;
    const motivo = this.motivoAccion().trim();
    if (motivo.length < 10) {
      this.errorAccion.set('El motivo debe tener al menos 10 caracteres.');
      return;
    }
    this.guardando.set(true);
    this.errorAccion.set(null);
    const accion = this.accion();
    const peticion =
      accion === 'aprobar'
        ? this.adminService.aprobarBeca(beca.id_beca, motivo)
        : accion === 'rechazar'
          ? this.adminService.rechazarBeca(beca.id_beca, motivo)
          : this.adminService.anularBeca(beca.id_beca, motivo);

    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.modalAccion.set(false);
        this.exito.set(
          accion === 'aprobar'
            ? 'Beca aprobada y aplicada a cargos pendientes.'
            : accion === 'rechazar'
              ? 'Beca rechazada.'
              : 'Beca anulada. Los cargos pendientes fueron recalculados.',
        );
        this.cargar();
      },
      error: (err) => {
        this.guardando.set(false);
        this.errorAccion.set(this.mensajeError(err));
      },
    });
  }

  nombreTipo(idTipo: number): string {
    return (
      this.tipos().find((tipo) => tipo.id_tipo_beca === idTipo)?.nombre ||
      'Tipo de beca'
    );
  }

  etiquetaValor(tipo: TipoBeca | Beca): string {
    const modalidad = 'modalidad' in tipo ? tipo.modalidad : 'PORCENTAJE';
    const valor =
      'valor' in tipo
        ? Number(tipo.valor)
        : Number(tipo.valor_default || 0);
    return modalidad === 'PORCENTAJE'
      ? `${valor}%`
      : `S/ ${valor.toFixed(2)}`;
  }

  etiquetaBeca(beca: Beca): string {
    return beca.modalidad === 'PORCENTAJE'
      ? `${Number(beca.valor)}%`
      : `S/ ${Number(beca.valor).toFixed(2)}`;
  }

  estadoClase(estado: string): string {
    return `estado-${String(estado || '').toLowerCase()}`;
  }

  private mensajeError(err: any): string {
    return (
      err?.error?.message ||
      err?.message ||
      'No se pudo completar la operación. Intente nuevamente.'
    );
  }
}
