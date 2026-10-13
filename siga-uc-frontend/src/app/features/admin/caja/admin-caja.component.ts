import { Component } from '@angular/core';
import { SecretariaCajaComponent } from '../../secretaria/caja/secretaria-caja.component';

/**
 * Módulo de Cuadre de Caja (Admin)
 * Reutiliza el componente de Secretaría para el panel de Administrador.
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-admin-caja',
  standalone: true,
  imports: [SecretariaCajaComponent],
  template: `<app-secretaria-caja></app-secretaria-caja>`,
})
export class AdminCajaComponent {}
