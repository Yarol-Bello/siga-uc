import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs';
import { environment } from '../../../../environments/environment';

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

  // Estado principal
  cargando = signal(true);
  error = signal<string | null>(null);
  alumnos = signal<AlumnoConPensiones[]>([]);
  preTickets = signal<PreTicket[]>([]);

  // Filtros
  busqueda = signal('');
  filtroEstado = signal('');

  // Modal de cobro
  modalCobro = signal(false);
  alumnoSeleccionado = signal<AlumnoConPensiones | null>(null);
  conceptoCobro = signal('');
  conceptosDisponibles = signal<ConceptoDisponible[]>([]);
  montoCobro = signal<number>(250);
  formaPago = signal('Efectivo');
  nroOperacion = signal('');
  procesando = signal(false);
  esCobroMatricula = signal(false);

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

    // Cargar alumnos
    this.http.get<any>(`${environment.apiUrl}/alumnos?anio=2026`).subscribe({
      next: (res) => {
        if (res.success) {
          const alumnosData = res.data;
          // Cargar pensiones de cada alumno
          this.cargarPensiones(alumnosData);
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
    this.http.get<any>(`${environment.apiUrl}/tesoreria/pre-tickets?estado=PENDIENTE`).subscribe({
      next: (res) => {
        if (res.success) this.preTickets.set(res.data);
      },
      error: (err) => console.error('Error pre-tickets:', err),
    });
  }

  /**
   * Cargar pensiones de cada alumno
   */
  cargarPensiones(alumnosData: any[]): void {
    const promesas = alumnosData.map((alumno) =>
      this.http
        .get<any>(`${environment.apiUrl}/tesoreria/pensiones/alumno/${alumno.id_alumno}`)
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
        this.cargando.set(false);
      })
      .catch((err) => {
        console.error('Error al cargar pensiones:', err);
        this.error.set('No se pudieron cargar las pensiones');
        this.cargando.set(false);
      });
  }

  /**
   * Calcular estado general de un alumno
   */
  calcularEstadoGeneral(pensiones: Pension[], estadoMatricula: string): string {
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
    return pension.estado === 'PAGADO' ? 'pagado' : 'pendiente';
  }

  /**
   * Verificar si un mes está pagado
   */
  isMesPagado(alumno: AlumnoConPensiones, mes: number): boolean {
    return this.getEstadoMes(alumno, mes) === 'pagado';
  }

  /**
   * Abrir modal de cobro
   */
  abrirCobro(
    alumno: AlumnoConPensiones,
    concepto?: string,
    monto?: number,
  ): void {
    const esMatricula =
      concepto !== undefined
        ? concepto.toLowerCase().includes('matrícula')
        : alumno.estado_matricula === 'PendientePago';
    const disponibles = esMatricula
      ? []
      : this.obtenerConceptosDisponibles(alumno);
    const conceptoFinal =
      concepto ||
      (esMatricula ? 'Matrícula Escolar 2026' : disponibles[0]?.nombre || '');
    const montoFinal =
      monto ?? (esMatricula ? 250 : disponibles[0]?.monto ?? 250);

    this.conceptosDisponibles.set(disponibles);
    this.alumnoSeleccionado.set(alumno);
    this.conceptoCobro.set(conceptoFinal);
    this.montoCobro.set(montoFinal);
    this.formaPago.set('Efectivo');
    this.nroOperacion.set('');
    this.esCobroMatricula.set(esMatricula);

    this.modalCobro.set(true);
  }

  /**
   * Solo devuelve pensiones pendientes que tengan concepto asociado.
   */
  private obtenerConceptosDisponibles(
    alumno: AlumnoConPensiones,
  ): ConceptoDisponible[] {
    return alumno.pensiones
      .filter((p) => p.estado !== 'PAGADO' && p.id_concepto)
      .map((p) => ({
        id_concepto: Number(p.id_concepto),
        id_pension: p.id_pension,
        nombre: p.concepto_nombre || `Pensión ${p.mes}/2026`,
        monto: Number(p.monto_final) || 250,
        mes: p.mes,
      }))
      .sort((a, b) => a.mes - b.mes);
  }

  cambiarConcepto(nombre: string): void {
    this.conceptoCobro.set(nombre);
    if (this.esCobroMatricula()) {
      this.montoCobro.set(250);
      return;
    }
    const concepto = this.conceptosDisponibles().find(
      (c) => c.nombre === nombre,
    );
    if (concepto) {
      this.montoCobro.set(concepto.monto);
    }
  }

  cerrarModalCobro(): void {
    this.modalCobro.set(false);
    this.alumnoSeleccionado.set(null);
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

    const conceptoSeleccionado = this.conceptosDisponibles().find(
      (c) => c.nombre === this.conceptoCobro(),
    );
    let idConcepto: number;
    let idPension: number | null;

    if (this.esCobroMatricula()) {
      idConcepto = 1;
      idPension = null;
    } else {
      if (!conceptoSeleccionado) {
        alert('Seleccione una pensión pendiente');
        return;
      }
      idConcepto = conceptoSeleccionado.id_concepto;
      idPension = conceptoSeleccionado.id_pension;
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
      this.abrirCobro(alumno, preTicket.concepto_nombre, parseFloat(preTicket.monto));
    } else {
      alert('No se encontró el alumno en el padrón');
    }
  }
}
