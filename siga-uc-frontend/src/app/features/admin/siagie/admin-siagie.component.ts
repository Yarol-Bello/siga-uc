import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ConfiguracionService } from '../../../core/services/configuracion.service';
import { AnioLectivoService } from '../../../core/services/anio-lectivo.service';
import { SelectorAnioComponent } from '../../../shared/components/selector-anio/selector-anio.component';

interface Grado {
  id_grado: number;
  nombre_grado: string;
  seccion: string;
  anio_lectivo: number;
}

interface ResumenExportacion {
  anio_lectivo: number;
  bimestre: number;
  id_grado: number;
  nombre_grado: string;
  nivel: string;
  seccion: string;
  total_cursos: number;
  total_alumnos: number;
  total_notas: number;
  total_conclusiones: number;
  total_combinaciones: number;
  exportable: boolean;
  advertencias: string[];
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
 * Exportación interna de calificaciones (ADMIN).
 * Genera un Excel de apoyo con las notas finales de SIGA-UC.
 * No es una exportación oficial a SIAGIE/MINEDU.
 */
@Component({
  selector: 'app-admin-siagie',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectorAnioComponent],
  templateUrl: './admin-siagie.component.html',
  styleUrl: './admin-siagie.component.scss',
})
export class AdminSiagieComponent implements OnInit {
  private http = inject(HttpClient);
  protected readonly configuracion = inject(ConfiguracionService);
  private anioService = inject(AnioLectivoService);

  // Filtros
  anio = signal<number>(this.configuracion.anioLectivo());
  anios = signal<number[]>([this.configuracion.anioLectivo()]);
  bimestre = signal<number>(2);
  gradoSeleccionado = signal<number | null>(null);

  // Catálogo y estados
  grados = signal<Grado[]>([]);
  cargandoGrados = signal(true);
  error = signal<string | null>(null);

  resumen = signal<ResumenExportacion | null>(null);
  cargandoResumen = signal(false);
  exportando = signal(false);
  errorExportacion = signal<string | null>(null);
  mensajeExito = signal<string | null>(null);

  // Auditoría de notas por docente
  auditoria = signal<AuditoriaDocente[]>([]);
  cargandoAuditoria = signal(false);
  errorAuditoria = signal<string | null>(null);

  readonly puedeExportar = computed(
    () => this.resumen()?.exportable === true && !this.exportando(),
  );

  async ngOnInit(): Promise<void> {
    await this.cargarAnios();
    this.cargarGrados();
  }

  /**
   * Catálogo de años con respaldo en el año activo si el endpoint falla.
   */
  private async cargarAnios(): Promise<void> {
    try {
      await this.anioService.asegurarCargado();
      const disponibles = this.anioService.aniosDisponibles();
      if (disponibles.length > 0) {
        this.anios.set(disponibles);
        if (!disponibles.includes(this.anio())) {
          const activo = this.configuracion.anioLectivo();
          this.anio.set(
            disponibles.includes(activo) ? activo : disponibles[0],
          );
        }
      }
    } catch {
      // Sin catálogo de años la exportación sigue limitada al año activo.
      this.anios.set([this.configuracion.anioLectivo()]);
    }
  }

  cargarGrados(): void {
    this.cargandoGrados.set(true);
    this.error.set(null);
    this.mensajeExito.set(null);
    this.errorExportacion.set(null);

    this.http
      .get<any>(`${environment.apiUrl}/grados`, {
        params: { anio: this.anio() },
      })
      .subscribe({
        next: (res) => {
          const grados: Grado[] = res?.success ? res.data || [] : [];
          this.grados.set(grados);

          const actual = this.gradoSeleccionado();
          if (!grados.some((g) => g.id_grado === actual)) {
            this.gradoSeleccionado.set(
              grados.length > 0 ? grados[0].id_grado : null,
            );
          }
          this.cargandoGrados.set(false);

          if (this.gradoSeleccionado() !== null) {
            this.cargarResumen();
            this.cargarAuditoria();
          } else {
            this.resumen.set(null);
            this.auditoria.set([]);
          }
        },
        error: (err) => {
          this.cargandoGrados.set(false);
          this.grados.set([]);
          this.gradoSeleccionado.set(null);
          this.resumen.set(null);
          this.auditoria.set([]);
          this.error.set(
            err?.error?.message ||
              'No se pudieron cargar los grados del año seleccionado.',
          );
        },
      });
  }

  cargarResumen(): void {
    const idGrado = this.gradoSeleccionado();
    if (idGrado === null) {
      this.resumen.set(null);
      return;
    }

    this.cargandoResumen.set(true);
    this.errorExportacion.set(null);

    this.http
      .get<any>(`${environment.apiUrl}/siagie/resumen`, {
        params: this.parametrosExportacion(idGrado),
      })
      .subscribe({
        next: (res) => {
          this.cargandoResumen.set(false);
          this.resumen.set(res?.success ? res.data : null);
        },
        error: (err) => {
          this.cargandoResumen.set(false);
          this.resumen.set(null);
          this.errorExportacion.set(
            err?.error?.message ||
              'No se pudo preparar la exportación interna.',
          );
        },
      });
  }

  cargarAuditoria(): void {
    const idGrado = this.gradoSeleccionado();
    if (idGrado === null) {
      this.auditoria.set([]);
      return;
    }

    this.cargandoAuditoria.set(true);
    this.errorAuditoria.set(null);

    this.http
      .get<any>(`${environment.apiUrl}/reportes/auditoria-docentes/${idGrado}`, {
        params: {
          bimestre: this.bimestre(),
          anio: this.anio(),
        },
      })
      .subscribe({
        next: (res) => {
          this.cargandoAuditoria.set(false);
          this.auditoria.set(res?.success ? res.data || [] : []);
        },
        error: (err) => {
          this.cargandoAuditoria.set(false);
          this.auditoria.set([]);
          this.errorAuditoria.set(
            err?.error?.message || 'No se pudo cargar el estado de las notas.',
          );
        },
      });
  }

  onAnioChange(anio: number): void {
    if (!Number.isInteger(anio) || anio <= 0 || anio === this.anio()) return;
    this.anio.set(anio);
    this.gradoSeleccionado.set(null);
    this.resumen.set(null);
    this.auditoria.set([]);
    this.mensajeExito.set(null);
    this.errorExportacion.set(null);
    this.cargarGrados();
  }

  onGradoChange(valor: string | number): void {
    const idGrado = Number(valor);
    if (!Number.isInteger(idGrado) || idGrado <= 0) return;
    this.gradoSeleccionado.set(idGrado);
    this.mensajeExito.set(null);
    this.cargarResumen();
    this.cargarAuditoria();
  }

  onBimestreChange(valor: string | number): void {
    const bimestre = Number(valor);
    if (!Number.isInteger(bimestre) || bimestre < 1 || bimestre > 4) return;
    this.bimestre.set(bimestre);
    this.mensajeExito.set(null);
    this.cargarResumen();
    this.cargarAuditoria();
  }

  /**
   * Descarga el Excel interno generado directamente desde la base de datos.
   */
  exportarExcel(): void {
    const idGrado = this.gradoSeleccionado();
    const resumen = this.resumen();
    if (idGrado === null || !resumen?.exportable || this.exportando()) return;

    this.exportando.set(true);
    this.errorExportacion.set(null);
    this.mensajeExito.set(null);

    this.http
      .get(`${environment.apiUrl}/siagie/exportar`, {
        params: this.parametrosExportacion(idGrado),
        observe: 'response',
        responseType: 'blob',
      })
      .subscribe({
        next: (respuesta) => {
          const blob = respuesta.body;
          if (!blob) {
            this.exportando.set(false);
            this.errorExportacion.set(
              'El servidor no devolvió un archivo Excel.',
            );
            return;
          }

          const nombre =
            this.nombreDesdeCabecera(
              respuesta.headers.get('content-disposition'),
            ) ||
            `EXPORTACION_INTERNA_BIM${this.bimestre()}_${this.anio()}.xlsx`;

          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = nombre;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);

          this.exportando.set(false);
          const alumnos =
            resumen.total_alumnos === 1 ? 'alumno' : 'alumnos';
          const cursos = resumen.total_cursos === 1 ? 'curso' : 'cursos';
          const notas =
            resumen.total_notas === 1 ? 'nota final' : 'notas finales';
          this.mensajeExito.set(
            `Excel interno descargado: ${resumen.total_alumnos} ${alumnos}, ` +
              `${resumen.total_cursos} ${cursos} y ${resumen.total_notas} ${notas}.`,
          );
        },
        error: async (err) => {
          this.exportando.set(false);
          this.errorExportacion.set(await this.mensajeErrorBlob(err));
        },
      });
  }

  private parametrosExportacion(idGrado: number): Record<string, number> {
    return {
      id_grado: idGrado,
      bimestre: this.bimestre(),
      anio: this.anio(),
    };
  }

  private nombreDesdeCabecera(cabecera: string | null): string | null {
    if (!cabecera) return null;
    const coincidencia = /filename="?([^";]+)"?/i.exec(cabecera);
    if (!coincidencia?.[1]) return null;
    try {
      return decodeURIComponent(coincidencia[1]);
    } catch {
      return coincidencia[1];
    }
  }

  private async mensajeErrorBlob(err: any): Promise<string> {
    const cuerpo = err?.error;
    if (cuerpo instanceof Blob) {
      try {
        const texto = await cuerpo.text();
        const json = JSON.parse(texto);
        if (json?.message) return json.message;
      } catch {
        // El cuerpo del error no era JSON.
      }
      return 'No se pudo generar el Excel interno.';
    }
    return (
      cuerpo?.message || err?.message || 'No se pudo generar el Excel interno.'
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

  /**
   * Enviar notificación real al docente (campanita + correo).
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
          this.grados().find((g) => g.id_grado === this.gradoSeleccionado())
            ?.nombre_grado || '';

        const asunto = `Recordatorio: Notas Pendientes — ${item.nombre_curso} ${gradoNombre} ${this.getBimestreTexto()}`;
        const cuerpo =
          `Estimado(a) Prof. ${item.docente_nombre},\n\n` +
          `Te recordamos que tienes notas pendientes de registrar en el curso de ${item.nombre_curso} ` +
          `para el ${gradoNombre} — ${this.getBimestreTexto()} ${this.anio()}.\n\n` +
          `📊 Alumnos pendientes: ${pendientes} de ${totalAlumnos} ` +
          `(${item.porcentaje || 0}% completado)\n\n` +
          `Por favor, ingresa al módulo "Registro de Notas" para completar las calificaciones ` +
          `antes del cierre del bimestre.\n\n` +
          `Atentamente,\nDirección Académica - ${this.configuracion.nombreInstitucion()}`;

        this.http
          .post<any>(`${environment.apiUrl}/notificaciones`, {
            id_usuario_destino: idUsuarioDestino,
            asunto,
            cuerpo,
          })
          .subscribe({
            next: () => {
              alert(
                `✅ Notificación enviada a ${item.docente_nombre}.\n\nLlegará a su campanita y a su correo personal.`,
              );
            },
            error: (err) => {
              console.error('Error al enviar notificación:', err);
              alert(
                '❌ Error al enviar la notificación: ' +
                  (err.error?.message || 'Error desconocido'),
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
