import { Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/**
 * Selector de año lectivo reutilizable (Fase 6.4).
 * Muestra el año elegido y un badge "Histórico" cuando no es el año activo.
 */
@Component({
  selector: 'app-selector-anio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="selector-anio">
      <label>
        <i class="fa-solid fa-calendar-days"></i>
        {{ etiqueta() }}
      </label>
      <select
        [ngModel]="anio()"
        (ngModelChange)="cambiar($event)"
        [disabled]="anios().length === 0"
        [attr.aria-label]="etiqueta()"
      >
        @for (item of anios(); track item) {
        <option [value]="item">{{ item }}</option>
        }
      </select>
      @if (historico()) {
      <span class="badge-historico" title="Los años no activos son de solo lectura">
        <i class="fa-solid fa-clock-rotate-left"></i> Histórico
      </span>
      }
    </div>
  `,
  styles: [
    `
      .selector-anio {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .selector-anio label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin: 0;
        font-size: 0.78rem;
        font-weight: 700;
        color: #475569;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }

      .selector-anio select {
        min-width: 96px;
        padding: 8px 10px;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        background: #fff;
        color: #1e293b;
        font-weight: 700;
      }

      .badge-historico {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4px 10px;
        border-radius: 999px;
        background: #fef3c7;
        border: 1px solid #fcd34d;
        color: #92400e;
        font-size: 0.72rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
    `,
  ],
})
export class SelectorAnioComponent {
  anios = input<number[]>([]);
  anioActivo = input<number>(0);
  anio = input<number>(0);
  etiqueta = input<string>('Año lectivo');

  anioChange = output<number>();

  historico = computed(
    () => this.anioActivo() > 0 && this.anio() !== this.anioActivo(),
  );

  cambiar(valor: string | number): void {
    const anio = Number(valor);
    if (Number.isInteger(anio) && anio > 0) {
      this.anioChange.emit(anio);
    }
  }
}
