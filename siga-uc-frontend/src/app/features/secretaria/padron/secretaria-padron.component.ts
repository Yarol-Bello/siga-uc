import { Component } from '@angular/core';
import { AdminAlumnosComponent } from '../../admin/alumnos/admin-alumnos.component';

/**
 * Módulo de Padrón de Alumnos (Secretaría)
 * Reutiliza el componente de Admin para el panel de Secretaría.
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-secretaria-padron',
  standalone: true,
  imports: [AdminAlumnosComponent],
  template: `<app-admin-alumnos></app-admin-alumnos>`,
})
export class SecretariaPadronComponent {}
