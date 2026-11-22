import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ConfiguracionService } from '../../../core/services/configuracion.service';

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
  nombre_grado: string;
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
  imports: [CommonModule, FormsModule],
  templateUrl: './secretaria-tesoreria.component.html',
  styleUrl: './secretaria-tesoreria.component.scss',
})
export class SecretariaTesoreriaComponent implements OnInit {
  private http = inject(HttpClient);
  private configuracion = inject(ConfiguracionService);
  private route = inject(ActivatedRoute);

  anioLectivo = this.configuracion.anioLectivo;

  // Preselección desde el dashboard de Secretaría (H54)
  private preticketQueryProcesado = false;
  private preticketsListos = false;
  private alumnosListos = false;

  // Estado principal
  cargando = signal(true);
  error = signal<string | null>(null);
  alumnos = signal<AlumnoConPensiones[]>([]);
  preTickets = signal<PreTicket[]>([]);
  conceptosPago = signal<ConceptoPago[]>([]);
  conceptoMatricula = computed(
    () => this.conceptosPago().find((c) => c.tipo === 'MATRICULA') || null,
  );

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
    this.cargarDatos();
  }

  /**
   * Cargar alumnos y pre-tickets
   */
  cargarDatos(): void {
    this.cargando.set(true);
    this.error.set(null);

    const anio = this.anioLectivo();

    // Cargar alumnos
    this.http.get<any>(`${environment.apiUrl}/alumnos?anio=${anio}`).subscribe({
      next: (res) => {
        if (res.success) {
          const alumnosData = res.data;
          // Cargar pensiones de cada alumno
          this.cargarPensiones(alumnosData, anio);
        } else {
          this.error.set('No se pudieron cargar los alumnos');
          this.cargando.set(false);
        }
      },
      error: (err) => {
        console.error('Error alumnos:', err);
        this.error.set('No se pudieron cargar los alumnos');
        this.cargando.set(false);
      },
    });

    // Cargar pre-tickets
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

    // Cargar conceptos del año lectivo activo
    this.http
      .get<any>(`${environment.apiUrl}/tesoreria/conceptos?anio=${anio}`)
      .subscribe({
        next: (res) => {
          if (res.success) this.conceptosPago.set(res.data);
        },
        error: (err) => console.error('Error conceptos:', err),
      });
  }

  /**
   * Cargar pensiones de cada alumno
   */
  cargarPensiones(alumnosData: any[], anio: number): void {
    const promesas = alumnosData.map((alumno) =>
      this.http
        .get<any>(
          `${environment.apiUrl}/tesoreria/pensiones/alumno/${alumno.id_alumno}?anio=${anio}`,
        )
        .toPromise()
        .then((res) => ({
          ...alumno,
          pensiones: res?.data || [],
          estado_general: this.calcularEstadoGeneral(
            res?.data || [],
            alumno.estado_matricula,
          ),
        })),
    );

    Promise.all(promesas)
      .then((alumnosConPensiones) => {
        this.alumnos.set(alumnosConPensiones);
        this.alumnosListos = true;
        this.cargando.set(false);
        this.abrirPreticketDesdeQuery();
      })
      .catch((err) => {
        console.error('Error al cargar pensiones:', err);
        this.alumnosListos = true;
        this.error.set('No se pudieron cargar las pensiones');
        this.cargando.set(false);
        this.abrirPreticketDesdeQuery();
      });
  }

  /**
   * Abre el cobro del pre-ticket indicado por el dashboard (H54).
   * Espera a que alumnos y pre-tickets estén cargados y reutiliza cobrarPreticket.
   */
  private abrirPreticketDesdeQuery(): void {
    if (this.preticketQueryProcesado) return;
    if (!this.preticketsListos || !this.alumnosListos) return;

    this.preticketQueryProcesado = true;

    const idPreticket = Number(
      this.route.snapshot.queryParamMap.get('id_preticket'),
    );
    if (!idPreticket) return;

    const idAlumnoQuery = Number(
      this.route.snapshot.queryParamMap.get('id_alumno'),
    );
    const preTicket = this.preTickets().find(
      (pt) => pt.id_preticket === idPreticket,
    );

    if (!preTicket) {
      this.error.set('El pre-ticket ya no está pendiente o no existe.');
      return;
    }

    const alumno = this.alumnos().find(
      (a) => a.id_alumno === (preTicket.id_alumno || idAlumnoQuery),
    );

    if (!alumno) {
      this.error.set('No se encontró el alumno del pre-ticket.');
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
    const matricula = this.conceptoMatricula();
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
      idConceptoFinal = idConcepto ?? matricula?.id_concepto ?? null;
      conceptoFinal = concepto || matricula?.nombre || '';
      montoFinal = monto ?? Number(matricula?.monto_base || 0);

      if (!idConceptoFinal || !conceptoFinal || montoFinal <= 0) {
        alert(
          `No hay un concepto de matrícula configurado para el año lectivo ${this.anioLectivo()}.`,
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
          `Pensión ${p.mes}/${this.anioLectivo()}`,
        monto: Number(p.monto_final) || Number(p.monto_base) || 0,
        mes: p.mes,
      }))
      .sort((a, b) => a.mes - b.mes);
  }

  cambiarConcepto(nombre: string): void {
    this.conceptoCobro.set(nombre);

    if (this.esCobroMatricula()) {
      const matricula = this.conceptoMatricula();
      this.montoCobro.set(Number(matricula?.monto_base || 0));
      this.idConceptoSeleccionado.set(matricula?.id_concepto ?? null);
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
            this.cargarDatos();
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
            this.cargarDatos();
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
    let resultado = this.alumnos();
    const busq = this.busqueda().toLowerCase().trim();

    if (busq) {
      resultado = resultado.filter(
        (a) =>
          a.nombre_completo.toLowerCase().includes(busq) ||
          a.dni.includes(busq) ||
          a.codigo_estudiante?.toLowerCase().includes(busq),
      );
    }

    const estado = this.filtroEstado();
    if (estado) {
      resultado = resultado.filter((a) => a.estado_general === estado);
    }

    return resultado;
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
    } else {
      alert('No se encontró el alumno en el padrón');
    }
  }
}
