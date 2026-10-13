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
    if (
      !this.nuevaMatricula.apoderado.correo ||
      !this.nuevaMatricula.apoderado.correo.includes('@')
    ) {
      this.errorMatricula.set('El correo personal del apoderado es obligatorio');
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

  // ============================================================
  // MODAL EDITAR FICHA
  // ============================================================
  modalEditar = signal(false);
  alumnoEditando = signal<Alumno | null>(null);
  guardandoEdicion = signal(false);
  errorEdicion = signal<string | null>(null);
  formEditar: any = {
    nombres: '',
    apellidos: '',
    fecha_nacimiento: '',
    id_grado: '',
    condicion: 'Regular',
    colegio_procedencia: '',
  };

  abrirModalEditar(alumno: Alumno): void {
    this.alumnoEditando.set(alumno);
    this.formEditar = {
      nombres: alumno.nombres,
      apellidos: alumno.apellidos,
      fecha_nacimiento: alumno.fecha_nacimiento?.split('T')[0] || '',
      id_grado: alumno.id_grado,
      condicion: alumno.condicion || 'Regular',
      colegio_procedencia: '',
    };
    this.errorEdicion.set(null);
    this.modalEditar.set(true);
  }

  cerrarModalEditar(): void {
    this.modalEditar.set(false);
    this.alumnoEditando.set(null);
  }

  guardarEdicion(): void {
    if (!this.formEditar.nombres || !this.formEditar.apellidos) {
      this.errorEdicion.set('Nombres y apellidos son obligatorios');
      return;
    }

    const alumno = this.alumnoEditando();
    if (!alumno) return;

    this.guardandoEdicion.set(true);
    this.errorEdicion.set(null);

    const payload = {
      nombres: this.formEditar.nombres,
      apellidos: this.formEditar.apellidos,
      fecha_nacimiento: this.formEditar.fecha_nacimiento,
      id_grado: parseInt(this.formEditar.id_grado),
      condicion: this.formEditar.condicion,
      colegio_procedencia: this.formEditar.colegio_procedencia || null,
    };

    this.http.put<any>(`${environment.apiUrl}/alumnos/${alumno.id_alumno}`, payload).subscribe({
      next: (res) => {
        this.guardandoEdicion.set(false);
        if (res.success) {
          alert('✅ Ficha actualizada correctamente');
          this.cerrarModalEditar();
          this.cargarAlumnos();
        }
      },
      error: (err) => {
        this.guardandoEdicion.set(false);
        this.errorEdicion.set(err.error?.message || 'Error al actualizar la ficha');
      },
    });
  }

  // ============================================================
  // MODAL RESTABLECER CONTRASEÑA
  // ============================================================
  modalPassword = signal(false);
  alumnoPassword = signal<Alumno | null>(null);
  restableciendo = signal(false);
  passwordTemporal = signal<string>('');

  abrirModalPassword(alumno: Alumno): void {
    this.alumnoPassword.set(alumno);
    this.passwordTemporal.set('');
    this.modalPassword.set(true);
  }

  cerrarModalPassword(): void {
    this.modalPassword.set(false);
    this.alumnoPassword.set(null);
    this.passwordTemporal.set('');
  }

  confirmarRestablecer(): void {
    const alumno = this.alumnoPassword();
    if (!alumno) return;

    if (
      !confirm(
        `¿Restablecer la contraseña de ${alumno.nombre_completo}?\n\nSe generará una nueva clave temporal.`,
      )
    ) {
      return;
    }

    this.restableciendo.set(true);

    this.http
      .put<any>(`${environment.apiUrl}/auth/reset-password`, {
        dni: alumno.dni,
      })
      .subscribe({
        next: (res) => {
          this.restableciendo.set(false);
          if (res.success) {
            this.passwordTemporal.set(res.data.password_temporal);
          }
        },
        error: (err) => {
          this.restableciendo.set(false);
          alert('Error al restablecer: ' + (err.error?.message || 'Error desconocido'));
        },
      });
  }
}
