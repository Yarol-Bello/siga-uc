import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { ConfiguracionService } from '../../../core/services/configuracion.service';

interface CursoAsignado {
  id_carga: number;
  id_grado: number;
  nombre_grado: string;
  seccion: string;
  id_curso: number;
  nombre_curso: string;
  area_academica: string;
}

interface ConclusionAlumno {
  id_alumno: number;
  dni: string;
  nombre_completo: string;
  codigo_estudiante: string;
  nota_final: string | null;
  id_conclusion: number | null;
  nivel_logro: string | null;
  avance: string | null;
  dificultad: string | null;
  sugerencia: string | null;
  descripcion: string | null;
  estado: string | null;
  actualizado_en: string | null;
}

interface RespuestaConclusiones {
  acta_cerrada: boolean;
  id_grado: number;
  id_curso: number;
  bimestre: number;
  anio_lectivo: number;
  alumnos: ConclusionAlumno[];
}

interface PlantillaConclusion {
  avance: string;
  dificultad: string;
  sugerencia: string;
}

/**
 * Conclusiones descriptivas estructuradas del docente (Opción A).
 * Nivel de logro + avance + dificultad + sugerencia, con texto compuesto.
 */
@Component({
  selector: 'app-docente-conclusiones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './docente-conclusiones.component.html',
  styleUrl: './docente-conclusiones.component.scss',
})
export class DocenteConclusionesComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private configuracion = inject(ConfiguracionService);

  usuario = this.authService.usuario;

  cargandoCursos = signal(true);
  cargando = signal(false);
  guardando = signal(false);
  error = signal<string | null>(null);
  mensajeExito = signal<string | null>(null);

  cursos = signal<CursoAsignado[]>([]);
  cursoSeleccionado = signal<CursoAsignado | null>(null);
  bimestre = signal<number>(2);
  busquedaAlumno = signal('');

  actaCerrada = signal(false);
  alumnos = signal<ConclusionAlumno[]>([]);

  modalAbierto = signal(false);
  alumnoSeleccionado = signal<ConclusionAlumno | null>(null);
  nivelLogro = signal('');
  avance = signal('');
  dificultad = signal('');
  sugerencia = signal('');
  errorModal = signal<string | null>(null);
  avisoNivel = signal<string | null>(null);

  readonly descripcionPreview = computed(() =>
    [this.avance(), this.dificultad(), this.sugerencia()]
      .map((valor) => String(valor || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .join(' '),
  );

  readonly longitud = computed(() => this.descripcionPreview().length);

  readonly nivelBloqueado = computed(
    () => Boolean(this.alumnoSeleccionado()?.nota_final),
  );

  readonly puedeGuardar = computed(
    () =>
      Boolean(this.nivelLogro()) &&
      this.longitud() > 0 &&
      this.longitud() <= 350 &&
      !this.guardando() &&
      !this.actaCerrada(),
  );

  readonly anioLectivo = computed(() => this.configuracion.anioLectivo());

  readonly alumnosFiltrados = computed(() => {
    const termino = this.normalizarBusqueda(this.busquedaAlumno());
    if (!termino) return this.alumnos();

    return this.alumnos().filter((alumno) => {
      const nombre = this.normalizarBusqueda(alumno.nombre_completo);
      const dni = String(alumno.dni || '');
      const codigo = this.normalizarBusqueda(alumno.codigo_estudiante);
      return (
        nombre.includes(termino) ||
        dni.includes(termino) ||
        codigo.includes(termino)
      );
    });
  });

  readonly textoConteo = computed(() => {
    const total = this.alumnos().length;
    const filtrados = this.alumnosFiltrados().length;
    return this.busquedaAlumno().trim()
      ? `${filtrados} de ${total} estudiantes`
      : `${total} estudiantes`;
  });

  ngOnInit(): void {
    this.cargarCursos();
  }

  /**
   * Cargar los cursos asignados al docente.
   */
  cargarCursos(): void {
    const usuarioActual = this.usuario();
    const idPersonal = usuarioActual?.info_adicional?.id_personal;

    if (!idPersonal) {
      this.error.set('No se encontró el ID del docente.');
      this.cargandoCursos.set(false);
      return;
    }

    this.cargandoCursos.set(true);
    this.error.set(null);

    this.http
      .get<any>(
        `${environment.apiUrl}/carga-curricular/docente/${idPersonal}`,
      )
      .subscribe({
        next: (res) => {
          this.cargandoCursos.set(false);
          const cursos: CursoAsignado[] = res?.success ? res.data || [] : [];
          this.cursos.set(cursos);
          if (cursos.length > 0) {
            this.seleccionarCurso(cursos[0]);
          }
        },
        error: (err) => {
          this.cargandoCursos.set(false);
          this.cursos.set([]);
          this.error.set(
            err?.error?.message || 'No se pudieron cargar los cursos.',
          );
        },
      });
  }

  seleccionarCurso(curso: CursoAsignado): void {
    this.cursoSeleccionado.set(curso);
    this.busquedaAlumno.set('');
    this.mensajeExito.set(null);
    this.cargarConclusiones();
  }

  cambiarBimestre(): void {
    this.mensajeExito.set(null);
    this.cargarConclusiones();
  }

  onCursoChange(idCarga: string | number): void {
    const curso = this.cursos().find(
      (item) => item.id_carga === Number(idCarga),
    );
    if (!curso) return;
    this.seleccionarCurso(curso);
  }

  onBimestreChange(valor: string | number): void {
    const bimestre = Number(valor);
    if (![1, 2, 3, 4].includes(bimestre)) return;
    this.bimestre.set(bimestre);
    this.cambiarBimestre();
  }

  /**
   * Cargar alumnos, nota final y conclusión del curso/bimestre.
   */
  cargarConclusiones(): void {
    const curso = this.cursoSeleccionado();
    if (!curso) {
      this.alumnos.set([]);
      return;
    }

    this.cargando.set(true);
    this.error.set(null);
    this.mensajeExito.set(null);

    const url =
      `${environment.apiUrl}/calificaciones/curso/${curso.id_curso}` +
      `/grado/${curso.id_grado}/conclusiones?bimestre=${this.bimestre()}` +
      `&anio=${this.anioLectivo()}`;

    this.http.get<any>(url).subscribe({
      next: (res) => {
        this.cargando.set(false);
        if (!res?.success) {
          this.alumnos.set([]);
          this.error.set('No se pudieron cargar las conclusiones.');
          return;
        }
        const data: RespuestaConclusiones = res.data;
        this.actaCerrada.set(Boolean(data.acta_cerrada));
        this.alumnos.set(data.alumnos || []);
      },
      error: (err) => {
        this.cargando.set(false);
        this.alumnos.set([]);
        this.error.set(
          err?.error?.message || 'No se pudieron cargar las conclusiones.',
        );
      },
    });
  }

  abrirModal(alumno: ConclusionAlumno): void {
    if (this.actaCerrada()) return;

    this.alumnoSeleccionado.set(alumno);
    const nivelNota = alumno.nota_final || '';
    const nivelGuardado = alumno.nivel_logro || '';
    const nivel = nivelNota || nivelGuardado;

    this.nivelLogro.set(nivel);
    this.avance.set(alumno.avance || '');
    this.dificultad.set(alumno.dificultad || '');
    this.sugerencia.set(alumno.sugerencia || '');
    this.errorModal.set(null);
    this.avisoNivel.set(
      nivelNota && nivelGuardado && nivelNota !== nivelGuardado
        ? `La conclusión guardada tenía nivel ${nivelGuardado}, pero la nota final es ${nivelNota}. Se usará ${nivelNota}.`
        : null,
    );
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    if (this.guardando()) return;
    this.modalAbierto.set(false);
    this.alumnoSeleccionado.set(null);
    this.errorModal.set(null);
  }

  /**
   * Rellena los campos con una plantilla pedagógica editable.
   * No inventa evidencias: el docente debe revisar y ajustar.
   */
  generarSugerencia(): void {
    const nivel = this.nivelLogro();
    const curso = this.cursoSeleccionado();
    if (!nivel || !curso) {
      this.errorModal.set('Seleccione un nivel de logro para generar la sugerencia.');
      return;
    }

    const plantilla = this.plantillaConclusion(nivel, curso.nombre_curso);
    this.avance.set(plantilla.avance);
    this.dificultad.set(plantilla.dificultad);
    this.sugerencia.set(plantilla.sugerencia);
    this.errorModal.set(null);
  }

  guardar(estado: 'BORRADOR' | 'PUBLICADO'): void {
    const alumno = this.alumnoSeleccionado();
    const curso = this.cursoSeleccionado();
    if (!alumno || !curso || this.guardando()) return;

    if (!this.nivelLogro()) {
      this.errorModal.set('Seleccione el nivel de logro.');
      return;
    }
    if (this.longitud() > 350) {
      this.errorModal.set(
        `La conclusión supera los 350 caracteres (${this.longitud()}).`,
      );
      return;
    }
    if (
      estado === 'PUBLICADO' &&
      (!this.avance().trim() ||
        !this.dificultad().trim() ||
        !this.sugerencia().trim())
    ) {
      this.errorModal.set(
        'Para publicar complete avance, dificultad y sugerencia.',
      );
      return;
    }

    this.guardando.set(true);
    this.errorModal.set(null);

    const body = {
      id_alumno: alumno.id_alumno,
      id_curso: curso.id_curso,
      id_grado: curso.id_grado,
      bimestre: this.bimestre(),
      anio_lectivo: this.anioLectivo(),
      nivel_logro: this.nivelLogro(),
      avance: this.avance(),
      dificultad: this.dificultad(),
      sugerencia: this.sugerencia(),
      estado,
    };

    this.http
      .put<any>(`${environment.apiUrl}/calificaciones/conclusiones`, body)
      .subscribe({
        next: (res) => {
          this.guardando.set(false);
          const guardada = res?.data;
          if (guardada) {
            this.alumnos.update((lista) =>
              lista.map((item) =>
                item.id_alumno === alumno.id_alumno
                  ? {
                      ...item,
                      id_conclusion: guardada.id_conclusion,
                      nivel_logro: guardada.nivel_logro,
                      avance: guardada.avance,
                      dificultad: guardada.dificultad,
                      sugerencia: guardada.sugerencia,
                      descripcion: guardada.descripcion,
                      estado: guardada.estado,
                      actualizado_en: guardada.actualizado_en,
                    }
                  : item,
              ),
            );
          }
          this.modalAbierto.set(false);
          this.alumnoSeleccionado.set(null);
          this.mensajeExito.set(
            estado === 'PUBLICADO'
              ? `Conclusión publicada para ${alumno.nombre_completo}.`
              : `Borrador guardado para ${alumno.nombre_completo}.`,
          );
        },
        error: (err) => {
          this.guardando.set(false);
          this.errorModal.set(
            err?.error?.message || 'No se pudo guardar la conclusión.',
          );
        },
      });
  }

  estadoClase(estado: string | null): string {
    if (estado === 'PUBLICADO') return 'estado-publicado';
    if (estado === 'BORRADOR') return 'estado-borrador';
    return 'estado-pendiente';
  }

  estadoTexto(estado: string | null): string {
    if (estado === 'PUBLICADO') return 'Publicada';
    if (estado === 'BORRADOR') return 'Borrador';
    return 'Sin conclusión';
  }

  limpiarBusqueda(): void {
    this.busquedaAlumno.set('');
  }

  private normalizarBusqueda(valor: string | null | undefined): string {
    return String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private plantillaConclusion(
    nivel: string,
    curso: string,
  ): PlantillaConclusion {
    switch (nivel) {
      case 'AD':
        return {
          avance: `Demuestra un dominio destacado de las competencias de ${curso} y explica sus procedimientos con autonomía.`,
          dificultad:
            'No se identifican dificultades relevantes; puede asumir retos de mayor complejidad.',
          sugerencia:
            'Se recomienda continuar con situaciones desafiantes y compartir sus estrategias con sus compañeros.',
        };
      case 'A':
        return {
          avance: `Logra los aprendizajes esperados de ${curso} y utiliza estrategias pertinentes para resolver las actividades.`,
          dificultad:
            'Requiere consolidar la transferencia de lo aprendido a situaciones nuevas.',
          sugerencia:
            'Se recomienda practicar con casos contextualizados y explicar sus procedimientos.',
        };
      case 'B':
        return {
          avance: `Muestra avances en ${curso} y participa en las actividades propuestas.`,
          dificultad:
            'Aún requiere fortalecer la explicación de sus procedimientos y la aplicación de estrategias en situaciones nuevas.',
          sugerencia:
            'Se recomienda acompañamiento cercano y práctica guiada con ejemplos contextualizados.',
        };
      case 'C':
        return {
          avance: `Requiere apoyo para alcanzar los aprendizajes esperados de ${curso}.`,
          dificultad:
            'Presenta dificultades para aplicar las nociones básicas y explicar sus procedimientos.',
          sugerencia:
            'Se sugiere reforzar con actividades breves y frecuentes, retroalimentación constante y acompañamiento de la familia.',
        };
      default:
        return { avance: '', dificultad: '', sugerencia: '' };
    }
  }
}
