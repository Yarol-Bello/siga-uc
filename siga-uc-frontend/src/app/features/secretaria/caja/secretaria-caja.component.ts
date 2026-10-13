import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface Movimiento {
  id_movimiento: number;
  tipo: string;
  concepto: string;
  monto: string;
  medio_pago: string;
  nro_comprobante: string;
  fecha_hora: string;
  usuario: string;
}

interface CajaAbierta {
  id_apertura: number;
  monto_inicial: string;
  fecha_apertura: string;
  observaciones: string;
  id_caja: number;
  nombre_caja: string;
  responsable: string;
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
   * Cálculos derivados del estado de la caja
   */
  get efectivoEsperado(): number {
    const caja = this.cajaAbierta();
    if (!caja) return 0;
    const montoInicial = parseFloat(caja.monto_inicial) || 0;
    const ingresos = parseFloat(caja.total_ingresos) || 0;
    const egresos = parseFloat(caja.total_egresos) || 0;
    return montoInicial + ingresos - egresos;
  }

  get totalGeneral(): number {
    const caja = this.cajaAbierta();
    if (!caja) return 0;
    const montoInicial = parseFloat(caja.monto_inicial) || 0;
    const ingresos = parseFloat(caja.total_ingresos) || 0;
    return montoInicial + ingresos;
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
