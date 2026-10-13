import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';

interface CursoConNotas {
  id_curso: number;
  nombre_curso: string;
  area_academica: string;
  bimestres: { [key: string]: string };
  conclusion?: string;
}

/**
 * Dashboard del Estudiante
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-estudiante-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './estudiante-dashboard.component.html',
  styleUrl: './estudiante-dashboard.component.scss',
})
export class EstudianteDashboardComponent implements OnInit {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  usuario = this.authService.usuario;

  cargando = signal(true);
  error = signal<string | null>(null);
  cursos = signal<CursoConNotas[]>([]);
  promedioGeneral = signal<string>('-');

  ngOnInit(): void {
    this.cargarNotas();
  }

  cargarNotas(): void {
    const usuarioActual = this.usuario();
    if (!usuarioActual?.info_adicional?.id_alumno) {
      this.error.set('No se encontró el ID de alumno');
      this.cargando.set(false);
      return;
    }

    const id_alumno = usuarioActual.info_adicional.id_alumno;
    this.cargando.set(true);

    this.http
      .get<any>(`${environment.apiUrl}/calificaciones/notas-finales/alumno/${id_alumno}`)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.cursos.set(response.data.cursos);
            this.calcularPromedio(response.data.cursos);
          }
          this.cargando.set(false);
        },
        error: (err) => {
          console.error('❌ Error:', err);
          this.error.set('No se pudieron cargar las calificaciones.');
          this.cargando.set(false);
        },
      });
  }

  calcularPromedio(cursos: CursoConNotas[]): void {
    const mapa: { [key: string]: number } = { AD: 4, A: 3, B: 2, C: 1 };
    let suma = 0;
    let total = 0;

    cursos.forEach((c) => {
      Object.values(c.bimestres).forEach((nota) => {
        if (mapa[nota]) {
          suma += mapa[nota];
          total++;
        }
      });
    });

    if (total === 0) {
      this.promedioGeneral.set('-');
      return;
    }

    const promedio = suma / total;
    if (promedio >= 3.5) this.promedioGeneral.set('AD');
    else if (promedio >= 2.5) this.promedioGeneral.set('A');
    else if (promedio >= 1.5) this.promedioGeneral.set('B');
    else this.promedioGeneral.set('C');
  }

  /**
   * Obtener clase CSS según la nota
   */
  getNotaClass(nota: string | undefined): string {
    if (!nota) return 'nota-vacia';
    return 'nota-' + nota.toLowerCase();
  }
}
