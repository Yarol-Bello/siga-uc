import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfiguracionService } from '../../../core/services/configuracion.service';
import {
  AnioLectivo,
  AnioLectivoService,
  BloqueoRollover,
  PreviewRollover,
  ResultadoRollover,
} from '../../../core/services/anio-lectivo.service';

type TipoMensaje = 'success' | 'warning' | 'danger';

/**
 * Pantalla ADMIN de años lectivos y rollover (H49 / Fase 6.2).
 * Previsualiza y clona la oferta; no promueve alumnos.
 */
@Component({
  selector: 'app-admin-anios-lectivos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-anios-lectivos.component.html',
  styleUrl: './admin-anios-lectivos.component.scss',
})
export class AdminAniosLectivosComponent implements OnInit {
  private anioLectivoService = inject(AnioLectivoService);
  private configuracion = inject(ConfiguracionService);

  anios = this.anioLectivoService.anios;
  cargandoCatalogo = this.anioLectivoService.cargando;
  errorCatalogo = this.anioLectivoService.error;

  origen = signal<number | null>(null);
  destino = signal<number | null>(null);
  incluirOtros = signal(false);

  preview = signal<PreviewRollover | null>(null);
  cargandoPreview = signal(false);
  errorPreview = signal<string | null>(null);
  responsabilidad = signal(false);
  confirmando = signal(false);
  resultadoConfirmacion = signal<ResultadoRollover | null>(null);

  modalActivar = signal(false);
  anioActivar = signal<AnioLectivo | null>(null);
  aceptaActivacion = signal(false);
  activando = signal(false);
  errorActivacion = signal<string | null>(null);

  modalRevertir = signal(false);
  anioRevertir = signal<AnioLectivo | null>(null);
  motivoRevertir = signal('');
  aceptaReversion = signal(false);
  revirtiendo = signal(false);
  errorReversion = signal<string | null>(null);

  mensaje = signal<{ tipo: TipoMensaje; texto: string } | null>(null);

  anioActivo = computed(
    () => this.anios().find((anio) => anio.estado === 'ACTIVO') || null,
  );

  aniosOrigen = computed(() =>
    [...this.anios()].sort((a, b) => a.anio - b.anio),
  );

  aniosDestino = computed(() => {
    const disponibles = new Set(this.anios().map((anio) => anio.anio));
    const desde = this.origen();
    if (desde && desde + 1 <= 2100) disponibles.add(desde + 1);
    return [...disponibles]
      .filter((anio) => !desde || anio > desde)
      .sort((a, b) => a - b);
  });

  puedeConfirmar = computed(() => {
    const vista = this.preview();
    return Boolean(
      vista &&
        vista.bloqueos.length === 0 &&
        this.responsabilidad() &&
        !this.confirmando(),
    );
  });

  async ngOnInit(): Promise<void> {
    await this.cargarCatalogo();
    const activo = this.anioActivo();
    if (activo) {
      this.origen.set(activo.anio);
      if (activo.anio + 1 <= 2100) {
        this.destino.set(activo.anio + 1);
      }
    }
  }

  async cargarCatalogo(): Promise<void> {
    try {
      await this.anioLectivoService.cargar();
    } catch {
      this.mensaje.set({
        tipo: 'danger',
        texto:
          this.errorCatalogo() ||
          'No se pudo cargar el catálogo de años lectivos.',
      });
    }
  }

  onOrigenChange(valor: string | number): void {
    const anio = Number(valor);
    this.origen.set(Number.isInteger(anio) ? anio : null);
    const destinoActual = this.destino();
    if (!destinoActual || destinoActual <= anio) {
      this.destino.set(anio + 1 <= 2100 ? anio + 1 : null);
    }
    this.invalidarPreview();
  }

  onDestinoChange(valor: string | number): void {
    const anio = Number(valor);
    this.destino.set(Number.isInteger(anio) ? anio : null);
    this.invalidarPreview();
  }

  onIncluirOtrosChange(valor: boolean): void {
    this.incluirOtros.set(Boolean(valor));
    this.invalidarPreview();
  }

  invalidarPreview(): void {
    this.preview.set(null);
    this.responsabilidad.set(false);
    this.resultadoConfirmacion.set(null);
    this.errorPreview.set(null);
  }

  async previsualizar(): Promise<void> {
    const anioOrigen = this.origen();
    const anioDestino = this.destino();

    this.errorPreview.set(null);
    this.responsabilidad.set(false);
    this.resultadoConfirmacion.set(null);

    if (!anioOrigen || !anioDestino) {
      this.errorPreview.set('Seleccione el año origen y el año destino.');
      return;
    }
    if (anioDestino <= anioOrigen) {
      this.errorPreview.set(
        'El año destino debe ser posterior al año origen.',
      );
      return;
    }

    this.cargandoPreview.set(true);
    try {
      const vista = await this.anioLectivoService.previsualizar({
        anio_origen: anioOrigen,
        anio_destino: anioDestino,
        incluir_otros: this.incluirOtros(),
      });
      this.preview.set(vista);
    } catch (error: any) {
      this.cargandoPreview.set(false);
      this.preview.set(null);
      this.errorPreview.set(this.anioLectivoService.mensajeError(error));
      return;
    }
    this.cargandoPreview.set(false);
  }

  async confirmar(): Promise<void> {
    const vista = this.preview();
    if (!vista || !this.puedeConfirmar()) return;

    this.confirmando.set(true);
    this.errorPreview.set(null);

    try {
      const resultado = await this.anioLectivoService.confirmar({
        anio_origen: vista.anio_origen,
        anio_destino: vista.anio_destino,
        preview_hash: vista.preview_hash,
        confirmar: true,
        incluir_otros: vista.incluir_otros,
      });

      this.resultadoConfirmacion.set(resultado);
      this.responsabilidad.set(false);
      this.mensaje.set({
        tipo: 'success',
        texto: `Oferta ${vista.anio_origen} → ${vista.anio_destino} preparada: ${resultado.creados} fila(s) creada(s) y ${resultado.existentes} existente(s). No se crearon alumnos, pagos, notas ni horarios.`,
      });

      await this.cargarCatalogo();

      try {
        const refrescada = await this.anioLectivoService.previsualizar({
          anio_origen: vista.anio_origen,
          anio_destino: vista.anio_destino,
          incluir_otros: vista.incluir_otros,
        });
        this.preview.set(refrescada);
      } catch {
        // La oferta ya quedó clonada; si el preview falla, se conserva el
        // resultado del confirm y el usuario puede volver a previsualizar.
      }
    } catch (error: any) {
      this.confirmando.set(false);
      this.errorPreview.set(this.anioLectivoService.mensajeError(error));
      if (error?.error?.errors?.codigo === 'PREVIEW_DESACTUALIZADA') {
        this.preview.set(null);
      }
      return;
    }

    this.confirmando.set(false);
  }

  puedeActivar(anio: AnioLectivo): boolean {
    return (
      anio.estado === 'PLANIFICADO' &&
      Number(anio.grados) > 0 &&
      Number(anio.conceptos_matricula) > 0
    );
  }

  abrirModalActivar(anio: AnioLectivo): void {
    if (anio.estado !== 'PLANIFICADO') return;
    this.anioActivar.set(anio);
    this.aceptaActivacion.set(false);
    this.errorActivacion.set(null);
    this.modalActivar.set(true);
  }

  cerrarModalActivar(): void {
    if (this.activando()) return;
    this.modalActivar.set(false);
    this.anioActivar.set(null);
    this.aceptaActivacion.set(false);
    this.errorActivacion.set(null);
  }

  async activar(): Promise<void> {
    const anio = this.anioActivar();
    if (!anio || !this.aceptaActivacion() || this.activando()) return;

    this.activando.set(true);
    this.errorActivacion.set(null);

    try {
      const resultado = await this.anioLectivoService.activar(anio.anio);
      this.modalActivar.set(false);
      this.anioActivar.set(null);
      this.aceptaActivacion.set(false);

      this.mensaje.set({
        tipo: 'warning',
        texto: `Año ${resultado.anio} activado.${
          resultado.anterior
            ? ` El año ${resultado.anterior} pasó a CERRADO.`
            : ''
        } Los demás usuarios deben recargar la página para ver el nuevo año.`,
      });

      // El backend ya actualizó su caché; el frontend la recarga.
      await this.configuracion.cargar();
      await this.cargarCatalogo();

      this.origen.set(resultado.anio);
      this.destino.set(
        resultado.anio + 1 <= 2100 ? resultado.anio + 1 : null,
      );
      this.preview.set(null);
      this.responsabilidad.set(false);
    } catch (error: any) {
      this.activando.set(false);
      this.errorActivacion.set(
        this.anioLectivoService.mensajeError(error),
      );
      return;
    }

    this.activando.set(false);
  }

  actividadAnio(anio: AnioLectivo): number {
    return (
      Number(anio.alumnos || 0) +
      Number(anio.pagos || 0) +
      Number(anio.notas || 0) +
      Number(anio.asistencia || 0) +
      Number(anio.pensiones || 0) +
      Number(anio.pretickets || 0) +
      Number(anio.actas || 0) +
      Number(anio.horarios || 0)
    );
  }

  ofertaAnio(anio: AnioLectivo): number {
    return (
      Number(anio.grados || 0) +
      Number(anio.conceptos || 0) +
      Number(anio.periodos || 0) +
      Number(anio.carga || 0) +
      Number(anio.tutores || 0)
    );
  }

  puedeRevertir(anio: AnioLectivo): boolean {
    return (
      anio.estado === 'PLANIFICADO' &&
      anio.anio !== this.anioActivo()?.anio &&
      this.actividadAnio(anio) === 0 &&
      this.ofertaAnio(anio) > 0
    );
  }

  abrirModalRevertir(anio: AnioLectivo): void {
    if (!this.puedeRevertir(anio)) return;
    this.anioRevertir.set(anio);
    this.motivoRevertir.set('');
    this.aceptaReversion.set(false);
    this.errorReversion.set(null);
    this.modalRevertir.set(true);
  }

  cerrarModalRevertir(): void {
    if (this.revirtiendo()) return;
    this.modalRevertir.set(false);
    this.anioRevertir.set(null);
    this.motivoRevertir.set('');
    this.aceptaReversion.set(false);
    this.errorReversion.set(null);
  }

  motivoValido(): boolean {
    const largo = this.motivoRevertir().trim().length;
    return largo >= 10 && largo <= 250;
  }

  async revertir(): Promise<void> {
    const anio = this.anioRevertir();
    if (
      !anio ||
      !this.aceptaReversion() ||
      !this.motivoValido() ||
      this.revirtiendo()
    ) {
      return;
    }

    this.revirtiendo.set(true);
    this.errorReversion.set(null);

    try {
      const resultado = await this.anioLectivoService.revertir(
        anio.anio,
        this.motivoRevertir().trim(),
      );

      this.modalRevertir.set(false);
      this.anioRevertir.set(null);
      this.motivoRevertir.set('');
      this.aceptaReversion.set(false);

      const borrados = Object.values(resultado.conteos || {}).reduce(
        (total, valor) => total + Number(valor || 0),
        0,
      );

      this.mensaje.set({
        tipo: 'success',
        texto: `Rollover de ${resultado.anio} revertido: ${borrados} fila(s) de oferta eliminada(s)${
          resultado.anio_eliminado ? ' y año retirado del catálogo' : ''
        }.`,
      });

      await this.cargarCatalogo();

      if (this.origen() === resultado.anio) {
        this.origen.set(null);
        this.destino.set(null);
      }
      this.preview.set(null);
      this.responsabilidad.set(false);
    } catch (error: any) {
      this.revirtiendo.set(false);
      this.errorReversion.set(
        this.anioLectivoService.mensajeError(error),
      );
      return;
    }

    this.revirtiendo.set(false);
  }

  etiquetaEstado(estado: AnioLectivo['estado']): string {
    if (estado === 'ACTIVO') return 'Activo';
    if (estado === 'CERRADO') return 'Cerrado';
    return 'Planificado';
  }

  detallesBloqueo(bloqueo: BloqueoRollover): string[] {
    const detalle = bloqueo.detalle;
    if (!detalle) return [];
    const items = Array.isArray(detalle) ? detalle : [detalle];
    return items.map((item) => this.describirItem(item));
  }

  private describirItem(item: unknown): string {
    if (item === null || item === undefined) return '';
    if (typeof item === 'string') return item;
    if (typeof item === 'number' || typeof item === 'boolean') {
      return String(item);
    }

    const valor = item as any;
    if (valor.docente_nombre) {
      const horas =
        valor.horas !== undefined ? `${valor.horas} h` : null;
      const capacidad =
        valor.capacidad !== undefined ? `capacidad ${valor.capacidad} h` : null;
      return [valor.docente_nombre, horas, capacidad]
        .filter(Boolean)
        .join(' · ');
    }
    if (valor.nombre_grado) {
      return `${valor.nombre_grado} ${valor.seccion || ''}`.trim();
    }
    if (valor.codigo) {
      return `${valor.codigo}: ${valor.mensaje || ''}`.trim();
    }
    return JSON.stringify(valor);
  }
}
