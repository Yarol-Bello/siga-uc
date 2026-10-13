import { Component } from '@angular/core';
import { AdminAsistenciaQrComponent } from '../../admin/asistencia-qr/admin-asistencia-qr.component';

/**
 * Módulo de Control de Asistencia QR (Secretaría)
 * Reutiliza el componente del Admin pero con un layout distinto.
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-secretaria-asistencia-qr',
  standalone: true,
  imports: [AdminAsistenciaQrComponent],
  template: `<app-admin-asistencia-qr></app-admin-asistencia-qr>`,
})
export class SecretariaAsistenciaQrComponent {}
