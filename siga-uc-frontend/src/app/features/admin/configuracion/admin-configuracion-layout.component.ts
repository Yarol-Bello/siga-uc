import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

/**
 * Shell del módulo de configuración.
 * Las pestañas se agregan a medida que cada fase se implementa.
 */
@Component({
  selector: 'app-admin-configuracion-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="config-shell">
      <nav class="config-tabs" aria-label="Secciones de configuración">
        @for (tab of tabs; track tab.path) {
        <a
          [routerLink]="tab.path"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: tab.exact }"
        >
          <i class="fa-solid" [ngClass]="tab.icon"></i>
          {{ tab.label }}
        </a>
        }
      </nav>
      <router-outlet></router-outlet>
    </div>
  `,
  styles: [
    `
      .config-shell {
        min-height: 100%;
        background: #f8fafc;
      }

      .config-tabs {
        display: flex;
        gap: 0.35rem;
        padding: 0.7rem 1.25rem 0;
        background: #fff;
        border-bottom: 1px solid #e2e8f0;
        overflow-x: auto;
        scrollbar-width: thin;
      }

      .config-tabs a {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.65rem 0.9rem;
        border-radius: 9px 9px 0 0;
        color: #64748b;
        font-size: 0.84rem;
        font-weight: 700;
        text-decoration: none;
        white-space: nowrap;
        border-bottom: 3px solid transparent;
      }

      .config-tabs a:hover {
        color: #800020;
        background: #fff7ed;
      }

      .config-tabs a.active {
        color: #800020;
        border-bottom-color: #800020;
        background: #fff7ed;
      }

      @media (max-width: 768px) {
        .config-tabs {
          padding: 0.5rem 0.75rem 0;
        }

        .config-tabs a {
          padding: 0.55rem 0.7rem;
          font-size: 0.78rem;
        }
      }
    `,
  ],
})
export class AdminConfiguracionLayoutComponent {
  readonly tabs = [
    {
      path: '/admin/configuracion',
      label: 'General',
      icon: 'fa-sliders',
      exact: true,
    },
    {
      path: '/admin/configuracion/tarifas',
      label: 'Tarifas y conceptos',
      icon: 'fa-money-bill-wave',
      exact: false,
    },
    {
      path: '/admin/configuracion/academico',
      label: 'Académico',
      icon: 'fa-book-open',
      exact: false,
    },
    {
      path: '/admin/configuracion/horarios',
      label: 'Horarios y jornada',
      icon: 'fa-clock',
      exact: false,
    },
    {
      path: '/admin/configuracion/becas',
      label: 'Becas',
      icon: 'fa-hand-holding-heart',
      exact: false,
    },
  ];
}
