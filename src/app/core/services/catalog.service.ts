import { Injectable, signal } from '@angular/core';
import { Product } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  readonly products = signal<Product[]>([
    {
      id: 'combo-1',
      name: 'Combo Cubano Clásico',
      description: 'Ropa vieja, arroz moro y plátano maduro.',
      price: 11.5,
      category: 'combos',
      imageUrl: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=900',
      available: true
    },
    {
      id: 'plato-1',
      name: 'Lechón Asado',
      description: 'Porción con yuca y mojo criollo.',
      price: 13,
      category: 'platos',
      imageUrl: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=900',
      available: true
    },
    {
      id: 'bebida-1',
      name: 'Guarapo Natural',
      description: 'Bebida fresca de caña.',
      price: 3.2,
      category: 'bebidas',
      imageUrl: 'https://images.unsplash.com/photo-1523677011781-c91d1bbe2f9e?w=900',
      available: true
    },
    {
      id: 'extra-1',
      name: 'Croquetas (x6)',
      description: 'Croquetas artesanales.',
      price: 4.5,
      category: 'extras',
      imageUrl: 'https://images.unsplash.com/photo-1625937751474-67c4b7f4f6af?w=900',
      available: true
    }
  ]);
}
