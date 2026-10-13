import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface Alumno {
  id_alumno: number;
  dni: string;
  nombres: string;
  apellidos: string;
  nombre_completo: string;
  fecha_nacimiento: string;
  condicion: string;
  estado_matricula: string;
  codigo_estudiante: string;
  anio_lectivo: number;
  id_grado: number;
  nombre_grado: string;
  seccion: string;
  apoderado_nombre: string;
  apoderado_telefono: string;
}

/**
 * Módulo de Padrón de Alumnos
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-admin-alumnos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-alumnos.component.html',
  styleUrl: './admin-alumnos.component.scss',
})
export class AdminAlumnosComponent implements OnInit {
  private http = inject(HttpClient);

  // Estado
  cargando = signal(true);
  error = signal<string | null>(null);
  alumnos = signal<Alumno[]>([]);

  // Filtros
  filtroGrado = signal<string>('');
  filtroEstado = signal<string>('');
  busqueda = signal<string>('');

  // Modal
  modalAbierto = signal(false);
  alumnoSeleccionado = signal<Alumno | null>(null);

  ngOnInit(): void {
    this.cargarAlumnos();
  }

  /**
   * Cargar alumnos del backend con filtros
   */
  cargarAlumnos(): void {
    this.cargando.set(true);
    this.error.set(null);

    const params: any = { anio: 2026 };
    if (this.filtroGrado()) params.id_grado = this.filtroGrado();
    if (this.filtroEstado()) params.estado_matricula = this.filtroEstado();
    if (this.busqueda()) params.search = this.busqueda();

    this.http.get<any>(`${environment.apiUrl}/alumnos`, { params }).subscribe({
      next: (response) => {
        if (response.success) {
          this.alumnos.set(response.data);
        }
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error.set('No se pudieron cargar los alumnos.');
        this.cargando.set(false);
      },
    });
  }

  /**
   * Aplicar filtros
   */
  aplicarFiltros(): void {
    this.cargarAlumnos();
  }

  /**
   * Limpiar filtros
   */
  limpiarFiltros(): void {
    this.filtroGrado.set('');
    this.filtroEstado.set('');
    this.busqueda.set('');
    this.cargarAlumnos();
  }

  /**
   * Ver detalle del alumno
   */
  verDetalle(alumno: Alumno): void {
    this.alumnoSeleccionado.set(alumno);
    this.modalAbierto.set(true);
  }

  /**
   * Cerrar modal
   */
  cerrarModal(): void {
    this.modalAbierto.set(false);
    this.alumnoSeleccionado.set(null);
  }

  /**
   * Registrar nueva matrícula (placeholder por ahora)
   */
  nuevaMatricula(): void {
    alert('🚧 El formulario de nueva matrícula se implementará próximamente');
  }
}
