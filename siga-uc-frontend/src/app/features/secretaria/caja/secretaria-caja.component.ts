import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs';
import { environment } from '../../../../environments/environment';

interface Movimiento {
  id_movimiento: number;
  id_pago?: number | null;
  tipo: string;
  concepto: string;
  monto: string;
  medio_pago: string;
  nro_comprobante: string;
  nro_operacion?: string | null;
  numero_boleta?: string | null;
  estado_pago?: string | null;
  fecha_hora: string;
  usuario: string;
}

interface Pago {
  id_pago: number;
  monto: string | number;
  forma_pago: string;
  nro_operacion?: string | null;
  fecha_pago: string;
  estado: string;
  alumno_nombre: string;
  nombre_grado?: string | null;
  concepto_nombre: string;
  numero_boleta?: string | null;
  estado_sunat?: string | null;
  motivo_anulacion?: string | null;
  fecha_anulacion?: string | null;
}

interface CajaAbierta {
  id_apertura: number;
  monto_inicial: string;
  fecha_apertura: string;
  observaciones: string;
  id_caja: number;
  nombre_caja: string;
  responsable: string;
  total_ingresos_efectivo: string;
  total_ingresos_digital: string;
  total_egresos_efectivo: string;
  total_egresos_digital: string;
  total_ingresos: string;
  total_egresos: string;
}

/**
 * Módulo de Cuadre de Caja (Secretaría)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-secretaria-caja',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './secretaria-caja.component.html',
  styleUrl: './secretaria-caja.component.scss',
})
export class SecretariaCajaComponent implements OnInit {
  private http = inject(HttpClient);

  // Estado
  cargando = signal(true);
  error = signal<string | null>(null);
  cajaAbierta = signal<CajaAbierta | null>(null);
  movimientos = signal<Movimiento[]>([]);
  boletaPdfId = signal<number | null>(null);
  errorBoletaPdf = signal<string | null>(null);

  // Historial de pagos y anulación
  pagos = signal<Pago[]>([]);
  cargandoPagos = signal(false);
  modalAnulacion = signal(false);
  pagoAnular = signal<Pago | Movimiento | null>(null);
  motivoAnulacion = signal('');
  procesandoAnulacion = signal(false);
  errorAnulacion = signal<string | null>(null);
  exitoAnulacion = signal<string | null>(null);

  // Modal Apertura
  modalApertura = signal(false);
  montoInicial = signal<number>(100);
  observacionesApertura = signal('');
  procesandoApertura = signal(false);

  // Modal Egreso
  modalEgreso = signal(false);
  egresoMonto = signal<number>(0);
  egresoConcepto = signal('');
  egresoComprobante = signal('');
  procesandoEgreso = signal(false);

  // Modal Cierre
  modalCierre = signal(false);
  efectivoFisico = signal<number>(0);
  procesandoCierre = signal(false);
  reporteCierre = signal<any>(null);

  ngOnInit(): void {
    this.cargarCajaAbierta();
    this.cargarPagos();
  }

  /**
   * Cargar el estado actual de la caja
   */
  cargarCajaAbierta(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.http.get<any>(`${environment.apiUrl}/caja/actual`).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.cajaAbierta.set(res.data);
          this.cargarMovimientos(res.data.id_apertura);
        } else {
          this.cajaAbierta.set(null);
          this.movimientos.set([]);
        }
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error.set('No se pudo cargar el estado de la caja');
        this.cargando.set(false);
      },
    });
  }

  /**
   * Cargar los movimientos de la caja abierta
   */
  cargarMovimientos(idApertura: number): void {
    this.http.get<any>(`${environment.apiUrl}/caja/movimientos/${idApertura}`).subscribe({
      next: (res) => {
        if (res.success) this.movimientos.set(res.data);
      },
      error: (err) => console.error('Error movimientos:', err),
    });
  }

  /**
   * Cargar los últimos pagos para el historial y la anulación.
   */
  cargarPagos(): void {
    this.cargandoPagos.set(true);

    this.http.get<any>(`${environment.apiUrl}/tesoreria/pagos`).subscribe({
      next: (res) => {
        if (res.success) {
          this.pagos.set((res.data || []).slice(0, 50));
        }
        this.cargandoPagos.set(false);
      },
      error: (err) => {
        console.error('Error pagos:', err);
        this.cargandoPagos.set(false);
      },
    });
  }

  abrirModalAnulacion(pago: Pago | Movimiento): void {
    if (!pago.id_pago) return;

    this.pagoAnular.set(pago);
    this.motivoAnulacion.set('');
    this.errorAnulacion.set(null);
    this.exitoAnulacion.set(null);
    this.modalAnulacion.set(true);
  }

  cerrarModalAnulacion(): void {
    if (this.procesandoAnulacion()) return;

    this.modalAnulacion.set(false);
    this.pagoAnular.set(null);
    this.errorAnulacion.set(null);
  }

  confirmarAnulacion(): void {
    if (this.procesandoAnulacion()) return;

    const pago = this.pagoAnular();
    const motivo = this.motivoAnulacion().trim();

    if (!pago?.id_pago) return;

    if (motivo.length < 10) {
      this.errorAnulacion.set(
        'El motivo de anulación debe tener al menos 10 caracteres.',
      );
      return;
    }

    this.procesandoAnulacion.set(true);
    this.errorAnulacion.set(null);

    this.http
      .put<any>(`${environment.apiUrl}/tesoreria/pagos/${pago.id_pago}/anular`, {
        motivo,
      })
      .pipe(finalize(() => this.procesandoAnulacion.set(false)))
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.exitoAnulacion.set(
              `Pago${pago.numero_boleta ? ` ${pago.numero_boleta}` : ''} anulado correctamente.`,
            );
            this.modalAnulacion.set(false);
            this.pagoAnular.set(null);
            this.cargarCajaAbierta();
            this.cargarPagos();
          }
        },
        error: (err) => {
          this.errorAnulacion.set(
            err.error?.message || 'No se pudo anular el pago.',
          );
        },
      });
  }

  /**
   * Descargar la boleta de pago asociada a un movimiento de caja.
   */
  descargarBoletaPdf(mov: {
    id_pago?: number | null;
    numero_boleta?: string | null;
  }): void {
    const idPago = mov.id_pago;

    if (!idPago || !mov.numero_boleta || this.boletaPdfId() !== null) return;

    this.boletaPdfId.set(idPago);
    this.errorBoletaPdf.set(null);

    this.http
      .get(`${environment.apiUrl}/tesoreria/boletas/${idPago}/pdf`, {
        observe: 'response',
        responseType: 'blob',
      })
      .pipe(finalize(() => this.boletaPdfId.set(null)))
      .subscribe({
        next: (response) => {
          const blob = response.body;
          if (!blob) {
            this.errorBoletaPdf.set(
              'No se pudo generar la boleta en PDF. Intente nuevamente.',
            );
            return;
          }

          const fileName =
            this.extraerNombreArchivo(
              response.headers.get('content-disposition'),
            ) || `boleta_${mov.numero_boleta || idPago}.pdf`;

          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        },
        error: async (error) => {
          const mensaje = await this.obtenerMensajeErrorPdf(error);
          this.errorBoletaPdf.set(mensaje);
        },
      });
  }

  private extraerNombreArchivo(
    contentDisposition: string | null,
  ): string | null {
    if (!contentDisposition) return null;

    const match = /filename\*?=(?:UTF-8'')?["']?([^;"']+)/i.exec(
      contentDisposition,
    );

    if (!match?.[1]) return null;

    try {
      return decodeURIComponent(match[1].trim());
    } catch {
      return match[1].trim();
    }
  }

  private async obtenerMensajeErrorPdf(error: any): Promise<string> {
    const body = error?.error;

    if (body instanceof Blob) {
      try {
        const texto = await body.text();
        const json = JSON.parse(texto);
        if (json?.message) return json.message;
      } catch {
        // El cuerpo no era JSON; se usa el mensaje por estado.
      }
    } else if (body?.message) {
      return body.message;
    }

    if (error?.status === 401) {
      return 'Tu sesión expiró. Vuelve a iniciar sesión.';
    }
    if (error?.status === 403) {
      return 'No tienes permisos para descargar esta boleta.';
    }
    if (error?.status === 404) {
      return 'No se encontró la boleta solicitada.';
    }

    return 'No se pudo generar la boleta en PDF. Intente nuevamente.';
  }

  /**
   * Cálculos derivados del estado de la caja
   */
  get totalIngresosEfectivo(): number {
    return parseFloat(this.cajaAbierta()?.total_ingresos_efectivo || '0') || 0;
  }

  get totalIngresosDigital(): number {
    return parseFloat(this.cajaAbierta()?.total_ingresos_digital || '0') || 0;
  }

  get totalEgresosEfectivo(): number {
    return parseFloat(this.cajaAbierta()?.total_egresos_efectivo || '0') || 0;
  }

  get totalEgresosDigital(): number {
    return parseFloat(this.cajaAbierta()?.total_egresos_digital || '0') || 0;
  }

  get totalDigital(): number {
    return this.totalIngresosDigital - this.totalEgresosDigital;
  }

  get efectivoEsperado(): number {
    const caja = this.cajaAbierta();
    if (!caja) return 0;
    const montoInicial = parseFloat(caja.monto_inicial) || 0;
    return (
      montoInicial + this.totalIngresosEfectivo - this.totalEgresosEfectivo
    );
  }

  get totalGeneral(): number {
    return this.efectivoEsperado + this.totalDigital;
  }

  get diferenciaCierre(): number {
    return this.efectivoFisico() - this.efectivoEsperado;
  }

  /**
   * Abrir modal de apertura
   */
  abrirModalApertura(): void {
    this.montoInicial.set(100);
    this.observacionesApertura.set('Apertura de caja con fondo fijo de S/ 100.00');
    this.modalApertura.set(true);
  }

  cerrarModalApertura(): void {
    this.modalApertura.set(false);
  }

  /**
   * Procesar apertura de caja
   */
  procesarApertura(): void {
    this.procesandoApertura.set(true);

    const payload = {
      monto_inicial: this.montoInicial(),
      observaciones: this.observacionesApertura(),
    };

    this.http.post<any>(`${environment.apiUrl}/caja/aperturar`, payload).subscribe({
      next: (res) => {
        this.procesandoApertura.set(false);
        if (res.success) {
          alert(
            '✅ Caja aperturada exitosamente con fondo de S/ ' + this.montoInicial().toFixed(2),
          );
          this.cerrarModalApertura();
          this.cargarCajaAbierta();
        }
      },
      error: (err) => {
        this.procesandoApertura.set(false);
        alert('Error: ' + (err.error?.message || 'Error al aperturar caja'));
      },
    });
  }

  /**
   * Abrir modal de egreso
   */
  abrirModalEgreso(): void {
    this.egresoMonto.set(0);
    this.egresoConcepto.set('');
    this.egresoComprobante.set('');
    this.modalEgreso.set(true);
  }

  cerrarModalEgreso(): void {
    this.modalEgreso.set(false);
  }

  /**
   * Procesar egreso
   */
  procesarEgreso(): void {
    if (!this.egresoConcepto() || this.egresoMonto() <= 0) {
      alert('Ingrese el concepto y un monto válido');
      return;
    }

    this.procesandoEgreso.set(true);

    const payload = {
      concepto: this.egresoConcepto(),
      monto: this.egresoMonto(),
      nro_comprobante: this.egresoComprobante() || null,
    };

    this.http.post<any>(`${environment.apiUrl}/caja/egresos`, payload).subscribe({
      next: (res) => {
        this.procesandoEgreso.set(false);
        if (res.success) {
          alert('✅ Egreso registrado correctamente');
          this.cerrarModalEgreso();
          this.cargarCajaAbierta();
        }
      },
      error: (err) => {
        this.procesandoEgreso.set(false);
        alert('Error: ' + (err.error?.message || 'Error al registrar egreso'));
      },
    });
  }

  /**
   * Abrir modal de cierre
   */
  abrirModalCierre(): void {
    this.efectivoFisico.set(this.efectivoEsperado);
    this.reporteCierre.set(null);
    this.modalCierre.set(true);
  }

  cerrarModalCierre(): void {
    this.modalCierre.set(false);
  }

  /**
   * Procesar cierre de caja
   */
  procesarCierre(): void {
    if (this.efectivoFisico() < 0) {
      alert('Ingrese un monto válido');
      return;
    }

    this.procesandoCierre.set(true);

    const payload = {
      efectivo_fisico: this.efectivoFisico(),
    };

    this.http.post<any>(`${environment.apiUrl}/caja/cerrar`, payload).subscribe({
      next: (res) => {
        this.procesandoCierre.set(false);
        if (res.success) {
          this.reporteCierre.set(res.data);
        }
      },
      error: (err) => {
        this.procesandoCierre.set(false);
        alert('Error: ' + (err.error?.message || 'Error al cerrar caja'));
      },
    });
  }

  /**
   * Imprimir solo el reporte de cierre (H58).
   */
  imprimirReporteCierre(): void {
    window.print();
  }

  /**
   * Confirmar después de ver el reporte
   */
  confirmarCierreFinal(): void {
    this.cerrarModalCierre();
    this.reporteCierre.set(null);
    this.cargarCajaAbierta();
  }

  /**
   * Obtener clase CSS del tipo de movimiento
   */
  getTipoClass(tipo: string): string {
    switch (tipo) {
      case 'INGRESO':
        return 'ingreso';
      case 'EGRESO':
        return 'egreso';
      case 'APERTURA':
        return 'apertura';
      default:
        return '';
    }
  }

  /**
   * Obtener icono del tipo de movimiento
   */
  getTipoIcon(tipo: string): string {
    switch (tipo) {
      case 'INGRESO':
        return 'fa-arrow-trend-up';
      case 'EGRESO':
        return 'fa-arrow-trend-down';
      case 'APERTURA':
        return 'fa-key';
      default:
        return 'fa-circle';
    }
  }

  /**
   * Math.abs wrapper para uso en templates
   */
  Math = Math;
}
