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

interface Grado {
  id_grado: number;
  nombre_grado: string;
  seccion: string;
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

  // Estado principal
  cargando = signal(true);
  error = signal<string | null>(null);
  alumnos = signal<Alumno[]>([]);
  grados = signal<Grado[]>([]);

  // Filtros
  filtroGrado = signal<string>('');
  filtroEstado = signal<string>('');
  busqueda = signal<string>('');

  // Modal Ficha
  modalAbierto = signal(false);
  alumnoSeleccionado = signal<Alumno | null>(null);

  // Modal Nueva Matrícula
  modalMatricula = signal(false);
  guardando = signal(false);
  errorMatricula = signal<string | null>(null);
  nuevaMatricula: any = {
    dni: '',
    nombres: '',
    apellidos: '',
    fecha_nacimiento: '',
    id_grado: '',
    condicion: 'Regular',
    colegio_procedencia: '',
    apoderado: {
      nombres: '',
      apellidos: '',
      telefono: '',
      correo: '',
    },
  };

  // Modal Retiro
  modalRetiro = signal(false);
  retiroAlumno = signal<Alumno | null>(null);
  motivoRetiro = signal('');
  fechaRetiro = signal('');
  colegioDestino = signal('');

  ngOnInit(): void {
    this.cargarAlumnos();
    this.cargarGrados();
  }

  cargarAlumnos(): void {
    this.cargando.set(true);
    this.error.set(null);

    const params: any = { anio: 2026 };
    if (this.filtroGrado()) params.id_grado = this.filtroGrado();
    if (this.filtroEstado()) params.estado_matricula = this.filtroEstado();
    if (this.busqueda()) params.search = this.busqueda();

    this.http.get<any>(`${environment.apiUrl}/alumnos`, { params }).subscribe({
      next: (response) => {
        if (response.success) this.alumnos.set(response.data);
        this.cargando.set(false);
      },
      error: (err) => {
        console.error('❌ Error:', err);
        this.error.set('No se pudieron cargar los alumnos.');
        this.cargando.set(false);
      },
    });
  }

  cargarGrados(): void {
    this.http.get<any>(`${environment.apiUrl}/grados`).subscribe({
      next: (res) => {
        if (res.success) this.grados.set(res.data);
      },
    });
  }

  aplicarFiltros(): void {
    this.cargarAlumnos();
  }

  limpiarFiltros(): void {
    this.filtroGrado.set('');
    this.filtroEstado.set('');
    this.busqueda.set('');
    this.cargarAlumnos();
  }

  // ============================================================
  // MODAL FICHA
  // ============================================================
  verDetalle(alumno: Alumno): void {
    this.alumnoSeleccionado.set(alumno);
    this.modalAbierto.set(true);
  }

  cerrarModal(): void {
    this.modalAbierto.set(false);
    this.alumnoSeleccionado.set(null);
  }

  // ============================================================
  // MODAL NUEVA MATRÍCULA
  // ============================================================
  abrirModalMatricula(): void {
    this.nuevaMatricula = {
      dni: '',
      nombres: '',
      apellidos: '',
      fecha_nacimiento: '',
      id_grado: '',
      condicion: 'Regular',
      colegio_procedencia: '',
      apoderado: { nombres: '', apellidos: '', telefono: '', correo: '' },
    };
    this.errorMatricula.set(null);
    this.modalMatricula.set(true);
  }

  cerrarModalMatricula(): void {
    this.modalMatricula.set(false);
  }

  guardarMatricula(): void {
    // Validaciones básicas
    if (!this.nuevaMatricula.dni || this.nuevaMatricula.dni.length !== 8) {
      this.errorMatricula.set('El DNI debe tener 8 dígitos');
      return;
    }
    if (!this.nuevaMatricula.nombres || !this.nuevaMatricula.apellidos) {
      this.errorMatricula.set('Nombres y apellidos son obligatorios');
      return;
    }
    if (!this.nuevaMatricula.fecha_nacimiento) {
      this.errorMatricula.set('La fecha de nacimiento es obligatoria');
      return;
    }
    if (!this.nuevaMatricula.id_grado) {
      this.errorMatricula.set('Debe seleccionar un grado');
      return;
    }

    this.guardando.set(true);
    this.errorMatricula.set(null);

    // Preparar payload
    const payload = {
      dni: this.nuevaMatricula.dni,
      nombres: this.nuevaMatricula.nombres,
      apellidos: this.nuevaMatricula.apellidos,
      fecha_nacimiento: this.nuevaMatricula.fecha_nacimiento,
      id_grado: parseInt(this.nuevaMatricula.id_grado),
      condicion: this.nuevaMatricula.condicion,
      colegio_procedencia: this.nuevaMatricula.colegio_procedencia || null,
      apoderado: this.nuevaMatricula.apoderado.nombres ? this.nuevaMatricula.apoderado : null,
    };

    this.http.post<any>(`${environment.apiUrl}/alumnos`, payload).subscribe({
      next: (res) => {
        this.guardando.set(false);
        if (res.success) {
          alert(
            `✅ Matrícula registrada exitosamente\n\n` +
              `Estudiante: ${res.data.nombre_completo}\n` +
              `Código: ${res.data.codigo_estudiante}\n` +
              `Contraseña temporal: ${res.data.password_temporal}\n` +
              `Correo: ${res.data.correo_institucional}\n\n` +
              `📌 Estado: Pendiente de Pago (debe ir a Tesorería)`,
          );
          this.cerrarModalMatricula();
          this.cargarAlumnos();
        }
      },
      error: (err) => {
        this.guardando.set(false);
        console.error('❌ Error:', err);
        this.errorMatricula.set(err.error?.message || 'Error al registrar la matrícula');
      },
    });
  }

  // ============================================================
  // MODAL RETIRO
  // ============================================================
  abrirModalRetiro(alumno: Alumno): void {
    if (alumno.estado_matricula === 'Retirado') {
      alert('Este alumno ya está retirado');
      return;
    }
    this.retiroAlumno.set(alumno);
    this.motivoRetiro.set('');
    this.fechaRetiro.set(new Date().toISOString().split('T')[0]);
    this.colegioDestino.set('');
    this.modalRetiro.set(true);
  }

  cerrarModalRetiro(): void {
    this.modalRetiro.set(false);
    this.retiroAlumno.set(null);
  }

  confirmarRetiro(): void {
    if (!this.motivoRetiro()) {
      alert('Debe seleccionar un motivo de retiro');
      return;
    }

    const alumno = this.retiroAlumno();
    if (!alumno) return;

    const payload = {
      motivo_retiro: this.motivoRetiro(),
      fecha_retiro: this.fechaRetiro(),
      colegio_destino: this.colegioDestino() || null,
    };

    this.http
      .put<any>(`${environment.apiUrl}/alumnos/${alumno.id_alumno}/retirar`, payload)
      .subscribe({
        next: (res) => {
          if (res.success) {
            alert(`✅ Retiro registrado exitosamente para ${alumno.nombre_completo}`);
            this.cerrarModalRetiro();
            this.cargarAlumnos();
          }
        },
        error: (err) => {
          console.error('❌ Error:', err);
          alert('Error al registrar el retiro: ' + (err.error?.message || 'Error desconocido'));
        },
      });
  }
}
