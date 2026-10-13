import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface Grado {
  id_grado: number;
  nombre_grado: string;
  seccion: string;
}

interface AuditoriaDocente {
  id_curso: number;
  nombre_curso: string;
  area_academica: string;
  id_personal: number;
  docente_nombre: string;
  docente_correo: string;
  id_grado: number;
  nombre_grado: string;
  total_alumnos: string;
  alumnos_calificados: string;
  porcentaje: string | null;
}

/**
 * Módulo de Exportación SIAGIE (Admin)
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-admin-siagie',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-siagie.component.html',
  styleUrl: './admin-siagie.component.scss',
})
export class AdminSiagieComponent implements OnInit {
  private http = inject(HttpClient);

  // Estado
  cargando = signal(true);
  error = signal<string | null>(null);
  grados = signal<Grado[]>([]);
  auditoria = signal<AuditoriaDocente[]>([]);

  // Filtros
  gradoSeleccionado = signal<number>(3);
  bimestre = signal<number>(2);

  // Estado de carga de archivo
  archivoCargado = signal<File | null>(null);
  analisisCompletado = signal(false);

  ngOnInit(): void {
    this.cargarGrados();
  }

  cargarGrados(): void {
    this.http.get<any>(`${environment.apiUrl}/grados`).subscribe({
      next: (res) => {
        if (res.success) {
          this.grados.set(res.data);
          if (res.data.length > 0) {
            this.cargarAuditoria();
          }
        }
      },
      error: (err) => {
        console.error('Error grados:', err);
        this.cargando.set(false);
      },
    });
  }

  cargarAuditoria(): void {
    this.cargando.set(true);
    this.error.set(null);

    const url = `${environment.apiUrl}/reportes/auditoria-docentes/${this.gradoSeleccionado()}?bimestre=${this.bimestre()}`;

    this.http.get<any>(url).subscribe({
      next: (res) => {
        if (res.success) this.auditoria.set(res.data);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error.set('No se pudo cargar la auditoría');
        this.cargando.set(false);
      },
    });
  }

  onGradoChange(idGrado: string): void {
    this.gradoSeleccionado.set(Number(idGrado));
    this.limpiarArchivo();
    this.cargarAuditoria();
  }

  onBimestreChange(bimestre: string): void {
    this.bimestre.set(Number(bimestre));
    this.limpiarArchivo();
    this.cargarAuditoria();
  }

  /**
   * Limpiar el archivo cargado
   */
  limpiarArchivo(): void {
    this.archivoCargado.set(null);
    this.analisisCompletado.set(false);
    // También limpiar el input file del DOM
    const fileInput = document.getElementById('fileSiagie') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  descargarPlantilla(): void {
    alert(
      '📥 Descargando plantilla oficial del SIAGIE desde el portal del MINEDU...\n\n' +
        'El archivo se guardará como:\n' +
        'PLANTILLA_SIAGIE_2026.xlsx\n\n' +
        'Una vez descargada, cárgala aquí para mapear las columnas.',
    );
  }

  onArchivoSeleccionado(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.archivoCargado.set(file);
      this.analisisCompletado.set(false);

      setTimeout(() => {
        this.analisisCompletado.set(true);
      }, 800);
    }
  }

  onDropzoneClick(): void {
    document.getElementById('fileSiagie')?.click();
  }

  generarExcel(): void {
    const grado = this.grados().find((g) => g.id_grado === this.gradoSeleccionado());
    const nombreGrado = grado ? grado.nombre_grado.replace(/\s+/g, '_') : 'GRADO';

    alert(
      `📊 Generando Excel SIAGIE inyectado...\n\n` +
        `Archivo: SIAGIE_${nombreGrado}_BIM${this.bimestre()}_2026.xlsx\n` +
        `Grado: ${grado?.nombre_grado}\n` +
        `Bimestre: ${this.bimestre()}\n\n` +
        `Las notas finales registradas por los docentes se inyectarán en las celdas correspondientes.\n\n` +
        `✅ Archivo listo para subir al portal del SIAGIE.`,
    );
  }

  estaCompleto(item: AuditoriaDocente): boolean {
    return parseFloat(item.porcentaje || '0') >= 100;
  }

  getEstadoClass(item: AuditoriaDocente): string {
    const porcentaje = parseFloat(item.porcentaje || '0');
    if (porcentaje >= 100) return 'completo';
    if (porcentaje >= 50) return 'proceso';
    return 'pendiente';
  }

  getEstadoTexto(item: AuditoriaDocente): string {
    const porcentaje = parseFloat(item.porcentaje || '0');
    if (porcentaje >= 100) return 'Completo';
    if (porcentaje >= 50) return 'En Proceso';
    if (porcentaje > 0) return 'Iniciado';
    return 'Pendiente';
  }

  get totalCompletos(): number {
    return this.auditoria().filter((a) => this.estaCompleto(a)).length;
  }

  get totalPendientes(): number {
    return this.auditoria().filter((a) => !this.estaCompleto(a)).length;
  }

  getAreaClass(area: string): string {
    switch (area) {
      case 'Matemáticas':
        return 'area-mate';
      case 'Lenguaje y Letras':
        return 'area-letras';
      case 'Ciencias Naturales':
        return 'area-ciencias';
      case 'Ciencias Sociales':
        return 'area-sociales';
      default:
        return '';
    }
  }

  alertarDocente(item: AuditoriaDocente): void {
    alert(
      `📧 Recordatorio enviado a: ${item.docente_nombre}\n` +
        `Correo: ${item.docente_correo}\n\n` +
        `Curso pendiente: ${item.nombre_curso}\n` +
        `Porcentaje completado: ${item.porcentaje || 0}%`,
    );
  }
}
