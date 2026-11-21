import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Paginador reutilizable para tablas con paginación server-side.
 * SIGA-UC - Sistema Integrado de Gestión Académica
 */
@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.scss',
})
export class PaginationComponent {
  @Input() page = 1;
  @Input() totalPages = 1;
  @Input() total = 0;
  @Input() pageSize = 20;

  @Output() pageChange = new EventEmitter<number>();

  get inicio(): number {
    return this.total === 0 ? 0 : (this.page - 1) * this.pageSize + 1;
  }

  get fin(): number {
    return Math.min(this.page * this.pageSize, this.total);
  }

  get puedeAnterior(): boolean {
    return this.page > 1;
  }

  get puedeSiguiente(): boolean {
    return this.page < this.totalPages;
  }

  irAnterior(): void {
    if (this.puedeAnterior) {
      this.pageChange.emit(this.page - 1);
    }
  }

  irSiguiente(): void {
    if (this.puedeSiguiente) {
      this.pageChange.emit(this.page + 1);
    }
  }
}
