import { Component } from '@angular/core';
import { SecretariaTesoreriaComponent } from '../../secretaria/tesoreria/secretaria-tesoreria.component';

/**
 * Módulo de Tesorería y Pensiones (Admin)
 * Reutiliza el componente de Secretaría para el panel de Administrador.
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-admin-tesoreria',
  standalone: true,
  imports: [SecretariaTesoreriaComponent],
  template: `<app-secretaria-tesoreria></app-secretaria-tesoreria>`,
})
export class AdminTesoreriaComponent {}
