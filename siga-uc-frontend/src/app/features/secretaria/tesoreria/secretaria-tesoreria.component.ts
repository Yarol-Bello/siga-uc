import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ConfiguracionService } from '../../../core/services/configuracion.service';
import { AnioLectivoService } from '../../../core/services/anio-lectivo.service';
import { SelectorAnioComponent } from '../../../shared/components/selector-anio/selector-anio.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

interface Pension {
  id_pension: number;
  mes: number;
  monto_base: string;
  descuento: string;
  monto_final: string;
  estado: string;
  id_concepto?: number | null;
  concepto_nombre?: string | null;
}

interface ConceptoPago {
  id_concepto: number;
  nombre: string;
  monto_base: string | number;
  tipo: string;
  mes: number | null;
  anio_lectivo: number;
  nivel?: string | null;
  id_grado?: number | null;
  nombre_grado?: string | null;
  seccion?: string | null;
}

interface ConceptoDisponible {
  id_concepto: number;
  id_pension: number;
  nombre: string;
  monto: number;
  mes: number;
}

interface AlumnoConPensiones {
  id_alumno: number;
  dni: string;
  nombres: string;
  apellidos: string;
  nombre_completo: string;
  codigo_estudiante: string;
  id_grado: number;
  nombre_grado: string;
  nivel?: string | null;
  estado_matricula: string;
  pensiones: Pension[];
  estado_general: string;
}

interface PreTicket {
  id_preticket: number;
  id_alumno: number;
  monto: string;
  estado: string;
  fecha_emision: string;
  alumno_nombre: string;
  nombre_grado: string;
  concepto_nombre: string;
  id_concepto?: number;
  concepto_tipo?: string;
}

/**
 * Módulo de Tesorería y Pensiones (Secretaría)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-secretaria-tesoreria',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectorAnioComponent, PaginationComponent],
  templateUrl: './secretaria-tesoreria.component.html',
  styleUrl: './secretaria-tesoreria.component.scss',
})
export class SecretariaTesoreriaComponent implements OnInit {
  private http = inject(HttpClient);
  private configuracion = inject(ConfiguracionService);
  private anioLectivoService = inject(AnioLectivoService);
  private route = inject(ActivatedRoute);

  anioActivo = this.configuracion.anioLectivo;
  anioSeleccionado = signal<number>(this.configuracion.anioLectivo());
  aniosDisponibles = computed(() =>
    this.anioLectivoService.anios().map((item) => Number(item.anio)),
  );
  esHistorico = computed(
    () => this.anioSeleccionado() !== this.anioActivo(),
  );

  // Preselección desde el dashboard de Secretaría (H54)
  private preticketQueryProcesado = false;
  private preticketsListos = false;
  private temporizadorBusqueda?: ReturnType<typeof setTimeout>;

  // Estado principal
  cargando = signal(true);
  error = signal<string | null>(null);
  alumnos = signal<AlumnoConPensiones[]>([]);
  preTickets = signal<PreTicket[]>([]);
  conceptosPago = signal<ConceptoPago[]>([]);

  // Paginación server-side
  readonly pageSize = 25;
  pagina = signal(1);
  totalRegistros = signal(0);
  totalPaginas = signal(1);

  // Filtros
  busqueda = signal('');
  filtroEstado = signal('');

  // Modal de cobro
  modalCobro = signal(false);
  alumnoSeleccionado = signal<AlumnoConPensiones | null>(null);
  conceptoCobro = signal('');
  conceptosDisponibles = signal<ConceptoDisponible[]>([]);
  montoCobro = signal<number>(0);
  idConceptoSeleccionado = signal<number | null>(null);
  idPensionSeleccionada = signal<number | null>(null);
  formaPago = signal('Efectivo');
  nroOperacion = signal('');
  procesando = signal(false);
  esCobroMatricula = signal(false);
  generandoPensiones = signal(false);
  errorGeneracion = signal<string | null>(null);

  // Meses del año
  meses = [
    { num: 1, nombre: 'Ene' },
    { num: 2, nombre: 'Feb' },
    { num: 3, nombre: 'Mar' },
    { num: 4, nombre: 'Abr' },
    { num: 5, nombre: 'May' },
    { num: 6, nombre: 'Jun' },
    { num: 7, nombre: 'Jul' },
    { num: 8, nombre: 'Ago' },
    { num: 9, nombre: 'Set' },
    { num: 10, nombre: 'Oct' },
    { num: 11, nombre: 'Nov' },
    { num: 12, nombre: 'Dic' },
  ];

  ngOnInit(): void {
    const query = this.route.snapshot.queryParamMap;

    const anioQuery = Number(query.get('anio'));
    if (Number.isInteger(anioQuery) && anioQuery > 0) {
      this.anioSeleccionado.set(anioQuery);
    }

    const dniQuery = query.get('dni');
    if (dniQuery && /^\d{8}$/.test(dniQuery)) {
      this.busqueda.set(dniQuery);
    }

    this.anioLectivoService.asegurarCargado().catch(() => {
      // El selector conserva el año activo como respaldo.
    });

    this.cargarDatos(1, true);
  }

  /**
   * Cambiar de año: recarga padrón, pre-tickets y conceptos del año.
   */
  cambiarAnio(anio: number): void {
    if (anio === this.anioSeleccionado()) return;

    this.anioSeleccionado.set(anio);
    this.busqueda.set('');
    this.filtroEstado.set('');
    this.cerrarModalCobro();
    this.preticketQueryProcesado = true;
    this.cargarDatos(1, true);
  }

  /**
   * Cargar el padrón paginado (una sola petición) y los auxiliares del año.
   */
  cargarDatos(pagina = this.pagina(), incluirAuxiliares = false): void {
    this.cargando.set(true);
    this.error.set(null);

    const anio = this.anioSeleccionado();
    const params: Record<string, string | number> = {
      anio,
      page: pagina,
      pageSize: this.pageSize,
    };
    const busqueda = this.busqueda().trim();
    if (busqueda) params['search'] = busqueda;
    if (this.filtroEstado()) params['estado'] = this.filtroEstado();

    // Una sola consulta trae alumnos + pensiones + estado general.
    this.http
      .get<any>(`${environment.apiUrl}/tesoreria/pensiones/padron`, { params })
      .subscribe({
        next: (res) => {
          if (!res.success) {
            this.error.set('No se pudo cargar el padrón de pensiones');
            this.cargando.set(false);
            return;
          }

          const paginacion = res.data?.paginacion || {};
          this.alumnos.set(res.data?.alumnos || []);
          this.pagina.set(Number(paginacion.page) || pagina);
          this.totalRegistros.set(Number(paginacion.total) || 0);
          this.totalPaginas.set(Number(paginacion.totalPages) || 0);
          this.cargando.set(false);
          this.abrirPreticketDesdeQuery();
        },
        error: (err) => {
          console.error('Error padrón de pensiones:', err);
          this.error.set('No se pudo cargar el padrón de pensiones');
          this.cargando.set(false);
        },
      });

    // Auxiliares pequeños: solo al entrar, cambiar de año o cobrar.
    if (incluirAuxiliares) {
      this.http
        .get<any>(
          `${environment.apiUrl}/tesoreria/pre-tickets?estado=PENDIENTE&anio=${anio}`,
        )
        .subscribe({
          next: (res) => {
            if (res.success) this.preTickets.set(res.data);
            this.preticketsListos = true;
            this.abrirPreticketDesdeQuery();
          },
          error: (err) => {
            console.error('Error pre-tickets:', err);
            this.preticketsListos = true;
            this.abrirPreticketDesdeQuery();
          },
        });

      this.http
        .get<any>(`${environment.apiUrl}/tesoreria/conceptos?anio=${anio}`)
        .subscribe({
          next: (res) => {
            if (res.success) this.conceptosPago.set(res.data);
          },
          error: (err) => console.error('Error conceptos:', err),
        });
    }
  }

  /**
   * Búsqueda con debounce: vuelve a la página 1.
   */
  onBusqueda(valor: string): void {
    this.busqueda.set(valor);
    if (this.temporizadorBusqueda) {
      clearTimeout(this.temporizadorBusqueda);
    }
    this.temporizadorBusqueda = setTimeout(() => {
      this.cargarDatos(1);
    }, 350);
  }

  cambiarFiltroEstado(valor: string): void {
    this.filtroEstado.set(valor);
    this.cargarDatos(1);
  }

  irPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas()) return;
    this.cargarDatos(pagina);
  }

  /**
   * Abre el cobro del pre-ticket indicado por el dashboard (H54).
   * Espera a que alumnos y pre-tickets estén cargados y reutiliza cobrarPreticket.
   */
  private abrirPreticketDesdeQuery(): void {
    if (this.preticketQueryProcesado) return;
    if (!this.preticketsListos) return;

    this.preticketQueryProcesado = true;

    const idPreticket = Number(
      this.route.snapshot.queryParamMap.get('id_preticket'),
    );
    if (!idPreticket) return;

    const preTicket = this.preTickets().find(
      (pt) => pt.id_preticket === idPreticket,
    );

    if (!preTicket) {
      this.error.set('El pre-ticket ya no está pendiente o no existe.');
      return;
    }

    this.cobrarPreticket(preTicket);
  }

  /**
   * Calcular estado general de un alumno
   */
  calcularEstadoGeneral(pensiones: Pension[], estadoMatricula: string): string {
    if (estadoMatricula === 'Retirado') return 'Retirado';
    if (estadoMatricula === 'PendientePago') return 'Pendiente de Pago';
    if (pensiones.length === 0) return 'Sin datos';
    const pendientes = pensiones.filter((p) => p.estado === 'PENDIENTE').length;
    if (pendientes === 0) return 'Al Día';
    if (pendientes >= 3) return 'Moroso';
    return 'Con Deuda';
  }

  /**
   * Obtener estado de un mes específico
   */
  getEstadoMes(alumno: AlumnoConPensiones, mes: number): string {
    const pension = alumno.pensiones.find((p) => p.mes === mes);
    if (!pension) return 'no-aplica';
    if (pension.estado === 'PAGADO') return 'pagado';
    if (pension.estado === 'ANULADO') return 'anulado';
    return 'pendiente';
  }

  /**
   * Verificar si un mes está pagado
   */
  isMesPagado(alumno: AlumnoConPensiones, mes: number): boolean {
    return this.getEstadoMes(alumno, mes) === 'pagado';
  }

  /**
   * Un alumno está al día si tiene pensiones y todas están pagadas.
   */
  estaAlDia(alumno: AlumnoConPensiones): boolean {
    return (
      alumno.pensiones.length > 0 &&
      alumno.pensiones.every((pension) => pension.estado === 'PAGADO')
    );
  }

  /**
   * Abrir modal de cobro
   */
  abrirCobro(
    alumno: AlumnoConPensiones,
    concepto?: string,
    monto?: number,
    idConcepto?: number,
    tipoConcepto?: string,
  ): void {
    if (this.esHistorico()) {
      alert('El año seleccionado es histórico: solo lectura.');
      return;
    }

    const matricula = this.obtenerConceptoMatricula(alumno);
    const preticketMatricula = this.preTickets().find(
      (pt) =>
        pt.id_alumno === alumno.id_alumno &&
        pt.concepto_tipo === 'MATRICULA',
    );
    const esMatricula =
      tipoConcepto === 'MATRICULA' ||
      (tipoConcepto === undefined &&
        concepto !== undefined &&
        concepto.toLowerCase().includes('matrícula')) ||
      (tipoConcepto === undefined &&
        concepto === undefined &&
        alumno.estado_matricula === 'PendientePago');

    const disponibles = esMatricula
      ? []
      : this.obtenerConceptosDisponibles(alumno);

    let conceptoFinal = '';
    let montoFinal = 0;
    let idConceptoFinal: number | null = null;
    let idPensionFinal: number | null = null;

    if (esMatricula) {
      idConceptoFinal =
        idConcepto ??
        preticketMatricula?.id_concepto ??
        matricula?.id_concepto ??
        null;
      conceptoFinal =
        concepto ||
        preticketMatricula?.concepto_nombre ||
        matricula?.nombre ||
        '';
      montoFinal =
        monto ??
        Number(preticketMatricula?.monto ?? matricula?.monto_base ?? 0);

      if (!idConceptoFinal || !conceptoFinal || montoFinal <= 0) {
        alert(
          `No hay un concepto de matrícula configurado para el grado del alumno en el año lectivo ${this.anioSeleccionado()}.`,
        );
        return;
      }
    } else if (disponibles.length > 0) {
      const seleccionado =
        disponibles.find((c) => c.nombre === concepto) || disponibles[0];

      idConceptoFinal = idConcepto ?? seleccionado.id_concepto;
      idPensionFinal = seleccionado.id_pension;
      conceptoFinal = concepto || seleccionado.nombre;
      montoFinal = monto ?? seleccionado.monto;
    }

    this.conceptosDisponibles.set(disponibles);
    this.alumnoSeleccionado.set(alumno);
    this.conceptoCobro.set(conceptoFinal);
    this.montoCobro.set(montoFinal);
    this.idConceptoSeleccionado.set(idConceptoFinal);
    this.idPensionSeleccionada.set(idPensionFinal);
    this.formaPago.set('Efectivo');
    this.nroOperacion.set('');
    this.esCobroMatricula.set(esMatricula);
    this.errorGeneracion.set(null);

    this.modalCobro.set(true);
  }

  /**
   * Solo devuelve pensiones pendientes que tengan concepto asociado.
   */
  private obtenerConceptoMatricula(
    alumno: AlumnoConPensiones,
  ): ConceptoPago | null {
    const conceptos = this.conceptosPago().filter(
      (c) => c.tipo === 'MATRICULA',
    );
    return (
      conceptos.find(
        (c) => Number(c.id_grado) === Number(alumno.id_grado),
      ) ||
      conceptos.find(
        (c) =>
          !c.id_grado &&
          c.nivel &&
          alumno.nivel &&
          c.nivel === alumno.nivel,
      ) ||
      conceptos.find((c) => !c.id_grado && !c.nivel) ||
      conceptos[0] ||
      null
    );
  }

  private obtenerConceptosDisponibles(
    alumno: AlumnoConPensiones,
  ): ConceptoDisponible[] {
    return alumno.pensiones
      .filter((p) => p.estado === 'PENDIENTE' && p.id_concepto)
      .map((p) => ({
        id_concepto: Number(p.id_concepto),
        id_pension: p.id_pension,
        nombre:
          p.concepto_nombre ||
          `Pensión ${p.mes}/${this.anioSeleccionado()}`,
        monto: Number(p.monto_final) || Number(p.monto_base) || 0,
        mes: p.mes,
      }))
      .sort((a, b) => a.mes - b.mes);
  }

  cambiarConcepto(nombre: string): void {
    this.conceptoCobro.set(nombre);

    if (this.esCobroMatricula()) {
      const alumno = this.alumnoSeleccionado();
      const preticket = alumno
        ? this.preTickets().find(
            (pt) =>
              pt.id_alumno === alumno.id_alumno &&
              pt.concepto_tipo === 'MATRICULA',
          )
        : null;
      const matricula = alumno
        ? this.obtenerConceptoMatricula(alumno)
        : null;
      this.montoCobro.set(
        Number(preticket?.monto ?? matricula?.monto_base ?? 0),
      );
      this.idConceptoSeleccionado.set(
        preticket?.id_concepto ?? matricula?.id_concepto ?? null,
      );
      this.idPensionSeleccionada.set(null);
      return;
    }

    const concepto = this.conceptosDisponibles().find(
      (c) => c.nombre === nombre,
    );
    if (concepto) {
      this.montoCobro.set(concepto.monto);
      this.idConceptoSeleccionado.set(concepto.id_concepto);
      this.idPensionSeleccionada.set(concepto.id_pension);
    }
  }

  cerrarModalCobro(): void {
    if (this.generandoPensiones()) return;

    this.modalCobro.set(false);
    this.alumnoSeleccionado.set(null);
    this.errorGeneracion.set(null);
  }

  /**
   * Generar el cronograma de pensiones de un alumno ya matriculado.
   */
  generarPensionesAlumno(): void {
    if (this.esHistorico()) {
      alert('El año seleccionado es histórico: solo lectura.');
      return;
    }

    const alumno = this.alumnoSeleccionado();
    if (!alumno || this.generandoPensiones()) return;

    if (alumno.estado_matricula !== 'Matriculado') return;

    if (
      !confirm(
        'Se generarán las pensiones desde el mes de matrícula hasta diciembre.',
      )
    ) {
      return;
    }

    this.generandoPensiones.set(true);
    this.errorGeneracion.set(null);

    this.http
      .post<any>(
        `${environment.apiUrl}/tesoreria/pensiones/alumno/${alumno.id_alumno}/generar`,
        {},
      )
      .pipe(finalize(() => this.generandoPensiones.set(false)))
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.generandoPensiones.set(false);
            this.cerrarModalCobro();
            this.cargarDatos(this.pagina(), true);
          }
        },
        error: (err) => {
          this.errorGeneracion.set(
            err?.error?.message ||
              'No se pudieron generar las pensiones. Intente nuevamente.',
          );
        },
      });
  }

  /**
   * Procesar cobro
   */
  procesarCobro(): void {
    if (this.esHistorico()) {
      alert('El año seleccionado es histórico: solo lectura.');
      return;
    }

    const alumno = this.alumnoSeleccionado();
    if (!alumno) return;

    const esEfectivo = this.formaPago() === 'Efectivo';
    if (!esEfectivo && !this.nroOperacion().trim()) {
      alert('Ingrese el número de operación / voucher');
      return;
    }

    if (!this.conceptoCobro()) {
      alert('No hay pensiones pendientes para este alumno');
      return;
    }

    const idConcepto = this.idConceptoSeleccionado();
    const idPension = this.idPensionSeleccionada();

    if (!idConcepto) {
      alert('Seleccione un concepto válido');
      return;
    }

    if (this.montoCobro() <= 0) {
      alert('El monto del concepto no es válido');
      return;
    }

    this.procesando.set(true);

    const payload = {
      id_alumno: alumno.id_alumno,
      id_concepto: idConcepto,
      id_pension: idPension, // 👈 Enviar el id_pension al backend
      monto: this.montoCobro(),
      forma_pago: this.formaPago(),
      nro_operacion: esEfectivo ? null : this.nroOperacion().trim(),
    };

    this.http
      .post<any>(`${environment.apiUrl}/tesoreria/pagos`, payload)
      .pipe(finalize(() => this.procesando.set(false)))
      .subscribe({
        next: (res) => {
          if (res.success) {
            alert(
              `✅ Cobro registrado exitosamente\n\n` +
                `Estudiante: ${alumno.nombre_completo}\n` +
                `Concepto: ${this.conceptoCobro()}\n` +
                `Monto: S/ ${this.montoCobro()}\n` +
                `Forma de pago: ${this.formaPago()}\n` +
                `N° operación: ${res.data.pago?.nro_operacion || '-'}\n` +
                `Boleta: ${res.data.boleta.numero_boleta}`,
            );
            this.cerrarModalCobro();
            this.cargarDatos(this.pagina(), true);
          }
        },
        error: (err) => {
          console.error('❌ Error:', err);
          alert('Error al procesar el cobro: ' + (err.error?.message || 'Error desconocido'));
        },
      });
  }

  /**
   * Filtrar alumnos
   */
  get alumnosFiltrados(): AlumnoConPensiones[] {
    // El backend aplica búsqueda y estado antes de paginar.
    return this.alumnos();
  }

  /**
   * Obtener clase CSS del estado general
   */
  getEstadoGeneralClass(estado: string): string {
    switch (estado) {
      case 'Al Día':
        return 'al-dia';
      case 'Con Deuda':
        return 'con-deuda';
      case 'Moroso':
        return 'moroso';
      case 'Pendiente de Pago':
        return 'con-deuda';
      case 'Retirado':
        return 'retirado';
      default:
        return 'sin-datos';
    }
  }

  /**
   * Cobrar un pre-ticket desde el dashboard
   */
  cobrarPreticket(preTicket: PreTicket): void {
    const alumno = this.alumnos().find(
      (a) => a.id_alumno === preTicket.id_alumno,
    );
    if (alumno) {
      this.abrirCobro(
        alumno,
        preTicket.concepto_nombre,
        parseFloat(preTicket.monto),
        preTicket.id_concepto,
        preTicket.concepto_tipo,
      );
      return;
    }

    // El alumno puede no estar en la página visible: se consulta por ID.
    this.http
      .get<any>(`${environment.apiUrl}/alumnos/${preTicket.id_alumno}`, {
        params: { anio: this.anioSeleccionado() },
      })
      .subscribe({
        next: (res) => {
          if (!res.success || !res.data) {
            alert('No se encontró el alumno del pre-ticket');
            return;
          }
          const data = res.data;
          const alumnoFallback: AlumnoConPensiones = {
            ...data,
            nombre_completo:
              data.nombre_completo ||
              `${data.nombres || ''} ${data.apellidos || ''}`.trim(),
            pensiones: data.pensiones || [],
            estado_general:
              data.estado_general ||
              data.estado_matricula ||
              'Sin datos',
          };
          this.abrirCobro(
            alumnoFallback,
            preTicket.concepto_nombre,
            parseFloat(preTicket.monto),
            preTicket.id_concepto,
            preTicket.concepto_tipo,
          );
        },
        error: (err) => {
          console.error('Error al buscar alumno del pre-ticket:', err);
          alert('No se encontró el alumno del pre-ticket');
        },
      });
  }
}
