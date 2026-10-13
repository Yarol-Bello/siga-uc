import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface PersonalAsistencia {
  id_personal: number;
  dni: string;
  nombre_completo: string;
  nombres: string;
  apellidos: string;
  correo_institucional: string;
  nombre_rol: string;
  especialidad: string;
  cargo: string;
  id_asistencia_personal: number | null;
  fecha: string | null;
  hora_ingreso: string | null;
  hora_salida: string | null;
  estado: string | null;
  observacion: string | null;
}

interface Resumen {
  total_personal: string;
  total_puntual: string;
  total_tardanza: string;
  total_falta: string;
}

interface PersonalBuscado {
  id_personal: number;
  dni: string;
  nombre_completo: string;
  nombre_rol: string;
  cargo: string;
  estado: string;
}

/**
 * Módulo de Control de Asistencia QR (Admin)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-admin-asistencia-qr',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-asistencia-qr.component.html',
  styleUrl: './admin-asistencia-qr.component.scss',
})
export class AdminAsistenciaQrComponent implements OnInit {
  private http = inject(HttpClient);

  // Estado
  cargando = signal(true);
  error = signal<string | null>(null);
  personal = signal<PersonalAsistencia[]>([]);
  resumen = signal<Resumen | null>(null);
  fechaActual = signal<string>(new Date().toISOString().split('T')[0]);

  // Escaneo
  dniEscaneado = signal('');
  buscando = signal(false);
  personalEncontrado = signal<PersonalBuscado | null>(null);
  ultimoEscaneo = signal<any>(null);
  marcando = signal(false);
  errorEscaneo = signal<string | null>(null);

  ngOnInit(): void {
    this.cargarDatos();
  }

  /**
   * Cargar asistencias y resumen del día
   */
  cargarDatos(): void {
    this.cargando.set(true);
    this.error.set(null);

    const fecha = this.fechaActual();

    // Cargar lista de personal con su asistencia
    this.http
      .get<any>(`${environment.apiUrl}/asistencias/personal/todos?fecha=${fecha}`)
      .subscribe({
        next: (res) => {
          if (res.success) this.personal.set(res.data);
          this.cargando.set(false);
        },
        error: (err) => {
          console.error('❌ Error:', err);
          this.error.set('No se pudo cargar la asistencia del personal');
          this.cargando.set(false);
        },
      });

    // Cargar resumen
    this.http
      .get<any>(`${environment.apiUrl}/asistencias/personal/resumen?fecha=${fecha}`)
      .subscribe({
        next: (res) => {
          if (res.success) this.resumen.set(res.data);
        },
      });
  }

  onFechaChange(): void {
    this.cargarDatos();
    this.limpiarEscaneo();
  }

  /**
   * Simular escaneo de QR (o ingreso manual de DNI)
   */
  simularEscaneo(): void {
    const dni = this.dniEscaneado().trim();

    if (!dni || dni.length !== 8) {
      this.errorEscaneo.set('Ingrese un DNI de 8 dígitos');
      return;
    }

    this.buscando.set(true);
    this.errorEscaneo.set(null);
    this.personalEncontrado.set(null);
    this.ultimoEscaneo.set(null);

    this.http.get<any>(`${environment.apiUrl}/asistencias/personal/dni/${dni}`).subscribe({
      next: (res) => {
        this.buscando.set(false);
        if (res.success) {
          this.personalEncontrado.set(res.data);
        }
      },
      error: (err) => {
        this.buscando.set(false);
        this.errorEscaneo.set(err.error?.message || 'No se encontró personal con ese DNI');
      },
    });
  }

  /**
   * Registrar la marcación de asistencia
   */
  registrarMarcacion(estado: string): void {
    const persona = this.personalEncontrado();
    if (!persona) return;

    this.marcando.set(true);
    this.errorEscaneo.set(null);

    const ahora = new Date();
    const horaActual = `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}:${String(ahora.getSeconds()).padStart(2, '0')}`;

    const payload = {
      id_personal: persona.id_personal,
      fecha: this.fechaActual(),
      hora_ingreso: horaActual,
      estado: estado,
      observacion: estado === 'Puntual' ? 'Marcación por QR' : `Marcación por QR - ${estado}`,
    };

    this.http.post<any>(`${environment.apiUrl}/asistencias/personal/marcar`, payload).subscribe({
      next: (res) => {
        this.marcando.set(false);
        if (res.success) {
          this.ultimoEscaneo.set({
            ...persona,
            hora: horaActual,
            estado: estado,
          });
          this.limpiarEscaneoParcial();
          this.cargarDatos();
        }
      },
      error: (err) => {
        this.marcando.set(false);
        this.errorEscaneo.set(err.error?.message || 'Error al registrar marcación');
      },
    });
  }

  /**
   * Limpiar el escaneo actual
   */
  limpiarEscaneoParcial(): void {
    this.dniEscaneado.set('');
    this.personalEncontrado.set(null);
    this.errorEscaneo.set(null);
  }

  limpiarEscaneo(): void {
    this.limpiarEscaneoParcial();
    this.ultimoEscaneo.set(null);
  }

  /**
   * Obtener clase del estado
   */
  getEstadoClass(estado: string | null): string {
    if (!estado) return 'sin-registro';
    switch (estado) {
      case 'Puntual':
        return 'puntual';
      case 'Tardanza':
        return 'tardanza';
      case 'Falta':
        return 'falta';
      default:
        return 'sin-registro';
    }
  }

  /**
   * Obtener icono por rol
   */
  getRolIcon(rol: string): string {
    switch (rol) {
      case 'ADMIN':
        return 'fa-user-gear';
      case 'DOCENTE':
        return 'fa-chalkboard-user';
      case 'SECRETARIA':
        return 'fa-wallet';
      default:
        return 'fa-user';
    }
  }
}
