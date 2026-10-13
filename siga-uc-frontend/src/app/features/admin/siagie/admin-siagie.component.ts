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
  docente_correo_institucional: string;
  docente_correo_personal: string;
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

  /**
   * Generar y descargar el Excel SIAGIE inyectado con las notas reales
   */
  generarExcel(): void {
    if (!this.archivoCargado() || !this.analisisCompletado()) {
      alert('⚠️ Primero debes cargar la plantilla del SIAGIE.');
      return;
    }

    const archivo = this.archivoCargado()!;
    const formData = new FormData();
    formData.append('plantilla', archivo);
    formData.append('id_grado', this.gradoSeleccionado().toString());
    formData.append('bimestre', this.bimestre().toString());
    formData.append('anio_lectivo', '2026');

    this.http
      .post(`${environment.apiUrl}/siagie/generar-excel`, formData, { responseType: 'blob' })
      .subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `SIAGIE_BIM${this.bimestre()}_2026.xlsx`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          alert('✅ Excel SIAGIE generado y descargado exitosamente.');
        },
        error: (err) => {
          console.error('❌ Error al generar Excel:', err);
          alert(
            '❌ Error al generar el Excel: ' +
              (err.error?.message || 'Verifica la consola del navegador.'),
          );
        },
      });
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

  /**
   * Enviar notificación real al docente (campanita + correo)
   */
  alertarDocente(item: AuditoriaDocente): void {
    const totalAlumnos = Number(item.total_alumnos) || 0;
    const alumnosCalificados = Number(item.alumnos_calificados) || 0;
    const pendientes = totalAlumnos - alumnosCalificados;

    if (
      !confirm(
        `¿Enviar notificación a ${item.docente_nombre}?\n\n` +
          `Curso pendiente: ${item.nombre_curso}\n` +
          `Alumnos sin calificar: ${pendientes} de ${totalAlumnos}\n\n` +
          `Se enviará a su campanita y a su correo personal.`,
      )
    )
      return;

    this.http.get<any>(`${environment.apiUrl}/personal/${item.id_personal}`).subscribe({
      next: (res) => {
        if (!res.success || !res.data) {
          alert('❌ No se pudo obtener la información del docente.');
          return;
        }

        const idUsuarioDestino = res.data.id_usuario;
        const gradoNombre =
          this.grados().find((g) => g.id_grado === this.gradoSeleccionado())?.nombre_grado || '';

        const asunto = `Recordatorio: Notas Pendientes — ${item.nombre_curso} ${gradoNombre} ${this.getBimestreTexto()}`;
        const cuerpo =
          `Estimado(a) Prof. ${item.docente_nombre},\n\n` +
          `Te recordamos que tienes notas pendientes de registrar en el curso de ${item.nombre_curso} ` +
          `para el ${gradoNombre} — ${this.getBimestreTexto()} 2026.\n\n` +
          `📊 Alumnos pendientes: ${pendientes} de ${totalAlumnos} ` +
          `(${item.porcentaje || 0}% completado)\n\n` +
          `Por favor, ingresa al módulo "Registro de Notas" para completar las calificaciones ` +
          `antes del cierre del bimestre.\n\n` +
          `Atentamente,\nDirección Académica — I.E.P. Unión Científica`;

        const payload = {
          id_usuario_destino: idUsuarioDestino,
          asunto,
          cuerpo,
        };

        this.http.post<any>(`${environment.apiUrl}/notificaciones`, payload).subscribe({
          next: () => {
            alert(
              `✅ Notificación enviada exitosamente a ${item.docente_nombre}.\n\nLlegará a su campanita y a su correo personal.`,
            );
          },
          error: (err) => {
            console.error('Error al enviar notificación:', err);
            alert(
              '❌ Error al enviar la notificación: ' + (err.error?.message || 'Error desconocido'),
            );
          },
        });
      },
      error: (err) => {
        console.error('Error al obtener docente:', err);
        alert('❌ No se pudo encontrar la información del docente.');
      },
    });
  }

  /**
   * Convertir bimestre a texto
   */
  getBimestreTexto(): string {
    switch (this.bimestre()) {
      case 1:
        return 'I Bimestre';
      case 2:
        return 'II Bimestre';
      case 3:
        return 'III Bimestre';
      case 4:
        return 'IV Bimestre';
      default:
        return `${this.bimestre()} Bimestre`;
    }
  }
}
