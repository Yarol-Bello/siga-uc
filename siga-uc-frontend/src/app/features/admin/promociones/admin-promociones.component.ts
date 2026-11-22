import { CommonModule } from '@angular/common';
import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AnioLectivoService } from '../../../core/services/anio-lectivo.service';
import {
  AlumnoPromocion,
  DecisionPromocion,
  PoliticaPromocion,
  PreviewPromocion,
  PromocionRegistro,
  PromocionService,
  ResultadoConfirmacionPromocion,
  ResultadoPromocion,
} from '../../../core/services/promocion.service';

type TipoMensaje = 'success' | 'warning' | 'danger';

interface GradoOpcion {
  id_grado: number;
  nombre_grado: string;
  seccion: string;
}

const CRITERIO_DEFECTO = {
  modo: 'manual',
  modo_repitencia: 'DESACTIVADA',
  notas_bimestre: 4,
  bimestres_requeridos: [1, 2, 3, 4],
  transiciones: [],
  observacion: 'La dirección revisa caso por caso.',
};

const RESULTADOS: ResultadoPromocion[] = [
  'PROMOVIDO',
  'REPITENTE',
  'EGRESADO',
  'RETIRADO',
  'PENDIENTE',
];

/**
 * Pantalla ADMIN de promociones anuales (H73 / Fase 6.3).
 * Recomienda, permite override auditado y confirma sin activar el año.
 */
@Component({
  selector: 'app-admin-promociones',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-promociones.component.html',
  styleUrl: './admin-promociones.component.scss',
})
export class AdminPromocionesComponent implements OnInit {
  private promocionService = inject(PromocionService);
  private anioLectivoService = inject(AnioLectivoService);

  anios = this.anioLectivoService.anios;
  cargandoCatalogo = this.anioLectivoService.cargando;
  errorCatalogo = this.anioLectivoService.error;

  politicas = this.promocionService.politicas;
  promociones = this.promocionService.promociones;

  origen = signal<number | null>(null);
  destino = signal<number | null>(null);
  idPolitica = signal<number | null>(null);
  idGrado = signal<number | null>(null);
  incluirRetirados = signal(false);

  gradosOrigen = signal<GradoOpcion[]>([]);

  preview = signal<PreviewPromocion | null>(null);
  decisiones = signal<DecisionPromocion[]>([]);
  previewDesactualizada = signal(false);
  cargandoPreview = signal(false);
  errorPreview = signal<string | null>(null);
  responsabilidad = signal(false);
  copiarBecas = signal(false);
  confirmando = signal(false);
  resultadoConfirmacion = signal<ResultadoConfirmacionPromocion | null>(null);

  filtroEstadoPromocion = signal('CONFIRMADA');

  modalAnular = signal(false);
  promocionAnular = signal<PromocionRegistro | null>(null);
  motivoAnular = signal('');
  aceptaAnular = signal(false);
  anulando = signal(false);
  errorAnular = signal<string | null>(null);

  modalPolitica = signal(false);
  politicaEditando = signal<PoliticaPromocion | null>(null);
  guardandoPolitica = signal(false);
  errorPolitica = signal<string | null>(null);
  criterioTexto = signal(JSON.stringify(CRITERIO_DEFECTO, null, 2));
  formPolitica: any = this.formPoliticaVacio();

  mensaje = signal<{ tipo: TipoMensaje; texto: string } | null>(null);

  resultados = RESULTADOS;

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

  politicasDisponibles = computed(() =>
    this.politicas()
      .filter(
        (politica) =>
          politica.activo &&
          Number(politica.anio_origen) === Number(this.origen()) &&
          (politica.anio_destino === null ||
            Number(politica.anio_destino) === Number(this.destino())),
      )
      .sort((a, b) => a.nombre.localeCompare(b.nombre)),
  );

  politicaSeleccionada = computed(() => {
    const id = this.idPolitica();
    return (
      this.politicas().find((politica) => politica.id_politica === id) ||
      null
    );
  });

  destinoSinOferta = computed(() => {
    const anio = this.destino();
    if (!anio) return false;
    const fila = this.anios().find((item) => Number(item.anio) === Number(anio));
    return !fila || Number(fila.grados) === 0;
  });

  totalBecas = computed(() =>
    (this.preview()?.alumnos || []).reduce(
      (total, alumno) => total + (alumno.becas?.length || 0),
      0,
    ),
  );

  puedeConfirmar = computed(() => {
    const vista = this.preview();
    return Boolean(
      vista &&
        !this.previewDesactualizada() &&
        vista.resumen.bloqueados === 0 &&
        this.responsabilidad() &&
        !this.confirmando(),
    );
  });

  async ngOnInit(): Promise<void> {
    await this.cargarCatalogo();
    const activo = this.anioActivo();
    if (activo) {
      this.origen.set(activo.anio);
      this.destino.set(activo.anio + 1 <= 2100 ? activo.anio + 1 : null);
    }
    await this.cargarPoliticas();
    await this.cargarGrados();
    this.seleccionarPoliticaPorDefecto();
    await this.cargarPromociones();
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

  async cargarPoliticas(): Promise<void> {
    try {
      await this.promocionService.cargarPoliticas();
    } catch (error: any) {
      this.mensaje.set({
        tipo: 'danger',
        texto: this.promocionService.mensajeError(error),
      });
    }
  }

  async cargarGrados(): Promise<void> {
    const anio = this.origen();
    if (!anio) {
      this.gradosOrigen.set([]);
      return;
    }
    try {
      const grados = await this.promocionService.listarGrados(anio);
      this.gradosOrigen.set(grados as GradoOpcion[]);
      if (
        this.idGrado() !== null &&
        !grados.some(
          (grado) => Number(grado.id_grado) === Number(this.idGrado()),
        )
      ) {
        this.idGrado.set(null);
      }
    } catch {
      this.gradosOrigen.set([]);
    }
  }

  seleccionarPoliticaPorDefecto(): void {
    const disponibles = this.politicasDisponibles();
    const actual = this.idPolitica();
    if (
      actual &&
      disponibles.some((politica) => politica.id_politica === actual)
    ) {
      return;
    }
    this.idPolitica.set(
      disponibles.length > 0 ? disponibles[0].id_politica : null,
    );
  }

  async onOrigenChange(valor: string | number): Promise<void> {
    const anio = Number(valor);
    this.origen.set(Number.isInteger(anio) ? anio : null);
    const destinoActual = this.destino();
    if (!destinoActual || destinoActual <= anio) {
      this.destino.set(anio + 1 <= 2100 ? anio + 1 : null);
    }
    this.idGrado.set(null);
    this.invalidarPreview();
    await this.cargarGrados();
    this.seleccionarPoliticaPorDefecto();
  }

  onDestinoChange(valor: string | number): void {
    const anio = Number(valor);
    this.destino.set(Number.isInteger(anio) ? anio : null);
    this.invalidarPreview();
    this.seleccionarPoliticaPorDefecto();
  }

  onPoliticaChange(valor: string | number): void {
    const id = Number(valor);
    this.idPolitica.set(Number.isInteger(id) ? id : null);
    this.invalidarPreview();
  }

  onGradoChange(valor: string | number): void {
    if (valor === '' || valor === null || valor === undefined) {
      this.idGrado.set(null);
    } else {
      const id = Number(valor);
      this.idGrado.set(Number.isInteger(id) ? id : null);
    }
    this.invalidarPreview();
  }

  onIncluirRetiradosChange(valor: boolean): void {
    this.incluirRetirados.set(Boolean(valor));
    this.invalidarPreview();
  }

  onCopiarBecasChange(valor: boolean): void {
    this.copiarBecas.set(Boolean(valor));
  }

  invalidarPreview(): void {
    this.preview.set(null);
    this.previewDesactualizada.set(false);
    this.decisiones.set([]);
    this.responsabilidad.set(false);
    this.resultadoConfirmacion.set(null);
    this.errorPreview.set(null);
  }

  async previsualizar(): Promise<void> {
    const anioOrigen = this.origen();
    const anioDestino = this.destino();
    const idPolitica = this.idPolitica();

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
    if (!idPolitica) {
      this.errorPreview.set(
        'Seleccione o cree una política de promoción para continuar.',
      );
      return;
    }

    this.cargandoPreview.set(true);
    try {
      const vista = await this.promocionService.previsualizar({
        anio_origen: anioOrigen,
        anio_destino: anioDestino,
        id_politica: idPolitica,
        id_grado: this.idGrado(),
        incluir_retirados: this.incluirRetirados(),
        decisiones: this.decisiones(),
      });
      this.preview.set(vista);
      this.previewDesactualizada.set(false);
      this.idPolitica.set(vista.id_politica);
    } catch (error: any) {
      this.cargandoPreview.set(false);
      this.preview.set(null);
      this.errorPreview.set(this.promocionService.mensajeError(error));
      return;
    }
    this.cargandoPreview.set(false);
  }

  resultadoFila(alumno: AlumnoPromocion): ResultadoPromocion {
    const decision = this.decisionPara(alumno.id_alumno_origen);
    return decision?.resultado || alumno.resultado_final;
  }

  motivoFila(alumno: AlumnoPromocion): string {
    const decision = this.decisionPara(alumno.id_alumno_origen);
    return decision?.motivo || '';
  }

  decisionPara(idAlumno: number): DecisionPromocion | undefined {
    return this.decisiones().find(
      (decision) => decision.id_alumno_origen === idAlumno,
    );
  }

  onResultadoChange(
    alumno: AlumnoPromocion,
    resultado: ResultadoPromocion,
  ): void {
    const actuales = this.decisiones().filter(
      (decision) => decision.id_alumno_origen !== alumno.id_alumno_origen,
    );

    if (resultado === alumno.resultado_sugerido) {
      this.decisiones.set(actuales);
    } else {
      const anterior = this.decisionPara(alumno.id_alumno_origen);
      this.decisiones.set([
        ...actuales,
        {
          id_alumno_origen: alumno.id_alumno_origen,
          resultado,
          id_grado_destino: null,
          motivo: anterior?.motivo || '',
          es_override: true,
        },
      ]);
    }

    this.previewDesactualizada.set(true);
    this.responsabilidad.set(false);
    this.resultadoConfirmacion.set(null);
  }

  onMotivoChange(alumno: AlumnoPromocion, motivo: string): void {
    const decision = this.decisionPara(alumno.id_alumno_origen);
    if (!decision) return;
    this.decisiones.set(
      this.decisiones().map((item) =>
        item.id_alumno_origen === alumno.id_alumno_origen
          ? { ...item, motivo }
          : item,
      ),
    );
    this.previewDesactualizada.set(true);
    this.responsabilidad.set(false);
  }

  mostrarMotivo(alumno: AlumnoPromocion): boolean {
    return (
      Boolean(this.politicaSeleccionada()?.permite_override) &&
      this.resultadoFila(alumno) !== alumno.resultado_sugerido
    );
  }

  async confirmar(): Promise<void> {
    const vista = this.preview();
    if (!vista || !this.puedeConfirmar()) return;

    this.confirmando.set(true);
    this.errorPreview.set(null);

    try {
      const resultado = await this.promocionService.confirmar({
        anio_origen: vista.anio_origen,
        anio_destino: vista.anio_destino,
        id_politica: vista.id_politica,
        id_grado: vista.id_grado,
        incluir_retirados: vista.incluir_retirados,
        decisiones: this.decisiones(),
        copiar_becas: this.copiarBecas(),
        preview_hash: vista.preview_hash,
        confirmar: true,
      });

      this.resultadoConfirmacion.set(resultado);
      this.responsabilidad.set(false);
      this.mensaje.set({
        tipo: 'success',
        texto: resultado.ya_confirmada
          ? `La promoción ${resultado.anio_origen} → ${resultado.anio_destino} ya estaba confirmada. No se duplicaron matrículas.`
          : `Promoción confirmada: ${resultado.creados} matrícula(s) procesada(s). No se activó el año destino.`,
      });

      await this.cargarPromociones();
      await this.previsualizar();
    } catch (error: any) {
      this.confirmando.set(false);
      this.errorPreview.set(this.promocionService.mensajeError(error));
      if (error?.error?.errors?.codigo === 'PREVIEW_DESACTUALIZADA') {
        this.preview.set(null);
        this.previewDesactualizada.set(false);
      }
      return;
    }

    this.confirmando.set(false);
  }

  async cargarPromociones(): Promise<void> {
    try {
      await this.promocionService.cargarPromociones({
        anio_origen: this.origen(),
        anio_destino: this.destino(),
        estado: this.filtroEstadoPromocion() || undefined,
      });
    } catch (error: any) {
      this.mensaje.set({
        tipo: 'danger',
        texto: this.promocionService.mensajeError(error),
      });
    }
  }

  async onEstadoPromocionChange(valor: string): Promise<void> {
    this.filtroEstadoPromocion.set(valor);
    await this.cargarPromociones();
  }

  abrirModalAnular(promocion: PromocionRegistro): void {
    if (promocion.estado !== 'CONFIRMADA') return;
    this.promocionAnular.set(promocion);
    this.motivoAnular.set('');
    this.aceptaAnular.set(false);
    this.errorAnular.set(null);
    this.modalAnular.set(true);
  }

  cerrarModalAnular(): void {
    if (this.anulando()) return;
    this.modalAnular.set(false);
    this.promocionAnular.set(null);
    this.motivoAnular.set('');
    this.aceptaAnular.set(false);
    this.errorAnular.set(null);
  }

  motivoAnularValido(): boolean {
    const largo = this.motivoAnular().trim().length;
    return largo >= 10 && largo <= 250;
  }

  async anular(): Promise<void> {
    const promocion = this.promocionAnular();
    if (
      !promocion ||
      !this.aceptaAnular() ||
      !this.motivoAnularValido() ||
      this.anulando()
    ) {
      return;
    }

    this.anulando.set(true);
    this.errorAnular.set(null);

    try {
      const resultado: any = await this.promocionService.anular(
        promocion.id_promocion,
        this.motivoAnular().trim(),
      );

      this.modalAnular.set(false);
      this.promocionAnular.set(null);
      this.motivoAnular.set('');
      this.aceptaAnular.set(false);

      this.mensaje.set({
        tipo: 'success',
        texto: `Promoción ${resultado.id_promocion} anulada. ${
          resultado.eliminados?.alumnos
            ? 'Se eliminó la matrícula destino; puede reintentar la promoción.'
            : 'No había matrícula destino que eliminar.'
        }`,
      });

      await this.cargarPromociones();
      if (this.preview()) {
        await this.previsualizar();
      }
    } catch (error: any) {
      this.anulando.set(false);
      this.errorAnular.set(this.promocionService.mensajeError(error));
      return;
    }

    this.anulando.set(false);
  }

  // ============================================================
  // POLÍTICAS
  // ============================================================
  formPoliticaVacio(): Record<string, any> {
    return {
      nombre: '',
      anio_origen: this.origen() || new Date().getFullYear(),
      anio_destino: this.destino() || null,
      activo: true,
      requiere_actas_cerradas: true,
      requiere_notas_finales: true,
      umbral_asistencia: null,
      permite_override: false,
    };
  }

  abrirModalPolitica(politica: PoliticaPromocion | null = null): void {
    this.politicaEditando.set(politica);
    this.errorPolitica.set(null);
    this.formPolitica = politica
      ? {
          nombre: politica.nombre,
          anio_origen: Number(politica.anio_origen),
          anio_destino:
            politica.anio_destino === null
              ? null
              : Number(politica.anio_destino),
          activo: Boolean(politica.activo),
          requiere_actas_cerradas: Boolean(politica.requiere_actas_cerradas),
          requiere_notas_finales: Boolean(politica.requiere_notas_finales),
          umbral_asistencia:
            politica.umbral_asistencia === null
              ? null
              : Number(politica.umbral_asistencia),
          permite_override: Boolean(politica.permite_override),
        }
      : this.formPoliticaVacio();

    this.criterioTexto.set(
      JSON.stringify(
        politica?.criterio_academico || CRITERIO_DEFECTO,
        null,
        2,
      ),
    );
    this.modalPolitica.set(true);
  }

  cerrarModalPolitica(): void {
    if (this.guardandoPolitica()) return;
    this.modalPolitica.set(false);
    this.politicaEditando.set(null);
    this.errorPolitica.set(null);
  }

  async guardarPolitica(): Promise<void> {
    if (this.guardandoPolitica()) return;

    let criterio: Record<string, any>;
    try {
      criterio = JSON.parse(this.criterioTexto());
      if (!criterio || typeof criterio !== 'object' || Array.isArray(criterio)) {
        throw new Error('El criterio debe ser un objeto JSON.');
      }
    } catch {
      this.errorPolitica.set(
        'El criterio académico no es un JSON de objeto válido.',
      );
      return;
    }

    this.guardandoPolitica.set(true);
    this.errorPolitica.set(null);

    try {
      const payload = {
        ...this.formPolitica,
        anio_origen: Number(this.formPolitica.anio_origen),
        anio_destino:
          this.formPolitica.anio_destino === null ||
          this.formPolitica.anio_destino === ''
            ? null
            : Number(this.formPolitica.anio_destino),
        umbral_asistencia:
          this.formPolitica.umbral_asistencia === null ||
          this.formPolitica.umbral_asistencia === ''
            ? null
            : Number(this.formPolitica.umbral_asistencia),
        criterio_academico: criterio,
      };

      const editando = this.politicaEditando();
      const politica = editando
        ? await this.promocionService.actualizarPolitica(
            editando.id_politica,
            payload,
          )
        : await this.promocionService.crearPolitica(payload);

      this.modalPolitica.set(false);
      this.politicaEditando.set(null);
      await this.cargarPoliticas();
      this.idPolitica.set(politica.id_politica);
      this.invalidarPreview();
      this.mensaje.set({
        tipo: 'success',
        texto: `Política "${politica.nombre}" guardada.`,
      });
    } catch (error: any) {
      this.guardandoPolitica.set(false);
      this.errorPolitica.set(this.promocionService.mensajeError(error));
      return;
    }

    this.guardandoPolitica.set(false);
  }

  nombreResultado(resultado: ResultadoPromocion | string): string {
    const etiquetas: Record<string, string> = {
      PROMOVIDO: 'Promovido',
      REPITENTE: 'Repitente',
      EGRESADO: 'Egresado',
      RETIRADO: 'Retirado',
      PENDIENTE: 'Pendiente',
    };
    return etiquetas[resultado] || resultado;
  }

  claseResultado(resultado: ResultadoPromocion | string): string {
    return `resultado-${String(resultado).toLowerCase()}`;
  }

  detalleBloqueo(bloqueo: { detalle?: unknown }): string[] {
    const detalle = bloqueo?.detalle;
    if (!detalle) return [];
    const items = Array.isArray(detalle) ? detalle : [detalle];
    return items.map((item) => {
      if (item === null || item === undefined) return '';
      if (typeof item === 'string') return item;
      if (typeof item === 'number' || typeof item === 'boolean') {
        return String(item);
      }
      const valor = item as any;
      if (valor.nombre_curso) return valor.nombre_curso;
      if (valor.nombre_grado) {
        return `${valor.nombre_grado} ${valor.seccion || ''}`.trim();
      }
      return JSON.stringify(valor);
    });
  }
}
