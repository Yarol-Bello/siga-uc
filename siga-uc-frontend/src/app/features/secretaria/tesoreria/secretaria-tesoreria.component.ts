import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface Pension {
  id_pension: number;
  mes: number;
  monto_base: string;
  descuento: string;
  monto_final: string;
  estado: string;
}

interface AlumnoConPensiones {
  id_alumno: number;
  dni: string;
  nombres: string;
  apellidos: string;
  nombre_completo: string;
  codigo_estudiante: string;
  nombre_grado: string;
  pensiones: Pension[];
  estado_general: string;
}

interface PreTicket {
  id_preticket: number;
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
  montoCobro = signal<number>(250);
  formaPago = signal('Efectivo');
  nroOperacion = signal('');
  procesando = signal(false);

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
          estado_general: this.calcularEstadoGeneral(res?.data || []),
        })),
    );

    Promise.all(promesas).then((alumnosConPensiones) => {
      this.alumnos.set(alumnosConPensiones);
      this.cargando.set(false);
    });
  }

  /**
   * Calcular estado general de un alumno
   */
  calcularEstadoGeneral(pensiones: Pension[]): string {
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
    concepto: string = 'Pensión Octubre 2026',
    monto: number = 250,
  ): void {
    this.alumnoSeleccionado.set(alumno);
    this.conceptoCobro.set(concepto);
    this.montoCobro.set(monto);
    this.formaPago.set('Efectivo');
    this.nroOperacion.set('');
    this.modalCobro.set(true);
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

    if (!this.nroOperacion()) {
      alert('Ingrese el número de operación / voucher');
      return;
    }

    this.procesando.set(true);

    // Obtener el concepto correspondiente (buscar por mes)
    const conceptoMes = 10; // Octubre por defecto
    const idConcepto = 9; // ID del concepto de pensión Octubre

    const payload = {
      id_alumno: alumno.id_alumno,
      id_concepto: idConcepto,
      monto: this.montoCobro(),
      forma_pago: this.formaPago(),
      nro_operacion: this.nroOperacion(),
    };

    this.http.post<any>(`${environment.apiUrl}/tesoreria/pagos`, payload).subscribe({
      next: (res) => {
        this.procesando.set(false);
        if (res.success) {
          alert(
            `✅ Cobro registrado exitosamente\n\n` +
              `Estudiante: ${alumno.nombre_completo}\n` +
              `Monto: S/ ${this.montoCobro()}\n` +
              `Forma de pago: ${this.formaPago()}\n` +
              `Boleta: ${res.data.boleta.numero_boleta}`,
          );
          this.cerrarModalCobro();
          this.cargarDatos();
        }
      },
      error: (err) => {
        this.procesando.set(false);
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
      default:
        return 'sin-datos';
    }
  }

  /**
   * Cobrar un pre-ticket desde el dashboard
   */
  cobrarPreticket(preTicket: PreTicket): void {
    // Buscar el alumno por nombre en el padrón
    const alumno = this.alumnos().find((a) => a.nombre_completo === preTicket.alumno_nombre);
    if (alumno) {
      this.abrirCobro(alumno, preTicket.concepto_nombre, parseFloat(preTicket.monto));
    } else {
      alert('No se encontró el alumno en el padrón');
    }
  }
}
