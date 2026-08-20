import { ProductCustomizationOptions } from '../models/product.model';

export interface ProductCreationPreset {
  id: string;
  label: string;
  product: {
    name: string;
    description: string;
    price: number;
    category: string;
    minimumQuantity: number;
    unitLabel: string;
    customizationOptions?: ProductCustomizationOptions;
  };
}

const classicCakeSizes = [
  { name: 'Pequeña · 15 cm · 6–8 porciones' },
  { name: 'Mediana', price: 15 },
  { name: 'Grande', price: 35 }
];

const classicFillings = [
  { name: 'Coco en almíbar' },
  { name: 'Guayaba' },
  { name: 'Dulce de leche' }
];

export const PRODUCT_CREATION_PRESETS: ProductCreationPreset[] = [
  {
    id: 'tarta-personalizada',
    label: 'Tarta personalizada',
    product: {
      name: 'Tarta Personalizada',
      description: 'Tarta a medida con tamaño, bizcocho, relleno, cobertura y decoración a elegir.',
      price: 32,
      category: 'tartas',
      minimumQuantity: 1,
      unitLabel: 'tarta',
      customizationOptions: {
        sizes: [
          { name: 'Pequeña · 15 cm · 8–10 porciones' },
          { name: 'Mediana', price: 28 },
          { name: 'Grande', price: 64 }
        ],
        flavors: [
          { name: 'Vainilla' },
          { name: 'Chocolate' },
          { name: 'Red Velvet', price: 3 },
          { name: 'Zanahoria', price: 3 }
        ],
        fillings: [
          { name: 'Dulce de leche' },
          { name: 'Coco en almíbar' },
          { name: 'Crema pastelera' },
          { name: 'Guayaba' },
          { name: 'Melocotón' },
          { name: 'Frutos del bosque', price: 2 },
          { name: 'Oreo', price: 3 },
          { name: 'Ganache', price: 3 },
          { name: 'Nutella', price: 3 }
        ],
        toppings: [
          { name: 'Merengue italiano' },
          { name: 'Chantilly' },
          { name: 'Buttercream' }
        ],
        decorations: [
          { name: 'Foto impresa' },
          { name: 'Topper premium', price: 10 }
        ]
      }
    }
  },
  {
    id: 'tarta-clasica-cubana',
    label: 'Tarta clásica cubana',
    product: {
      name: 'Tarta Clásica Cubana',
      description: 'Bizcocho de vainilla, relleno tradicional a elegir y cobertura de merengue italiano.',
      price: 25,
      category: 'tartas',
      minimumQuantity: 1,
      unitLabel: 'tarta',
      customizationOptions: {
        sizes: classicCakeSizes,
        flavors: [{ name: 'Vainilla' }],
        fillings: classicFillings,
        toppings: [{ name: 'Merengue italiano' }]
      }
    }
  },
  {
    id: 'tarta-capuchino-cubano',
    label: 'Tarta capuchino cubano',
    product: {
      name: 'Tarta Capuchino Cubano',
      description: 'Tarta capuchino con bizcocho de vainilla, relleno a elegir y merengue italiano.',
      price: 25,
      category: 'tartas',
      minimumQuantity: 1,
      unitLabel: 'tarta',
      customizationOptions: {
        sizes: classicCakeSizes,
        flavors: [{ name: 'Vainilla' }],
        fillings: classicFillings,
        toppings: [{ name: 'Merengue italiano' }]
      }
    }
  },
  {
    id: 'tarta-tres-leches',
    label: 'Tarta tres leches',
    product: {
      name: 'Tarta Tres Leches',
      description: 'Bizcocho de vainilla bañado en tres leches con cobertura a elegir.',
      price: 30,
      category: 'tartas',
      minimumQuantity: 1,
      unitLabel: 'tarta',
      customizationOptions: {
        sizes: [
          { name: 'Pequeña' },
          { name: 'Mediana', price: 15 },
          { name: 'Grande', price: 35 }
        ],
        flavors: [{ name: 'Vainilla' }],
        toppings: [{ name: 'Merengue italiano' }, { name: 'Chantilly' }]
      }
    }
  },
  {
    id: 'tarta-zanahoria',
    label: 'Tarta de zanahoria',
    product: {
      name: 'Tarta de Zanahoria',
      description: 'Bizcocho de zanahoria con frosting de queso y nueces.',
      price: 30,
      category: 'tartas',
      minimumQuantity: 1,
      unitLabel: 'tarta',
      customizationOptions: {
        sizes: [
          { name: 'Pequeña' },
          { name: 'Mediana', price: 15 },
          { name: 'Grande', price: 35 }
        ],
        flavors: [{ name: 'Zanahoria' }],
        fillings: [{ name: 'Frosting de queso' }],
        toppings: [{ name: 'Frosting de queso y nueces' }]
      }
    }
  },
  ...[
    ['cupcakes', 'Cupcakes', 2, 'Cupcakes artesanales para celebraciones y mesas dulces.'],
    ['vasitos-postre', 'Vasitos de Postre', 2.5, 'Postres individuales presentados en vasitos.'],
    ['cake-pops', 'Cake Pops', 2.5, 'Bocados de bizcocho decorados para celebraciones.'],
    ['cabezote', 'Cabezote', 2, 'Dulce gourmet individual elaborado artesanalmente.'],
    ['tartaletas', 'Tartaletas', 2, 'Tartaletas individuales para celebraciones y eventos.'],
    ['pastelitos', 'Pastelitos', 2, 'Pastelitos individuales de elaboración artesanal.']
  ].map(([id, name, price, description]) => ({
    id: String(id),
    label: String(name),
    product: {
      name: String(name),
      description: String(description),
      price: Number(price),
      category: 'dulces-gourmet',
      minimumQuantity: 6,
      unitLabel: 'unidad'
    }
  })),
  {
    id: 'croquetas',
    label: 'Croquetas',
    product: {
      name: 'Croquetas',
      description: 'Ración de 20 croquetas caseras.',
      price: 15,
      category: 'aperitivos',
      minimumQuantity: 1,
      unitLabel: 'ración de 20 uds.'
    }
  },
  {
    id: 'tamales',
    label: 'Tamales',
    product: {
      name: 'Tamales',
      description: 'Tamales cubanos caseros. Pedido mínimo de 5 unidades.',
      price: 4,
      category: 'aperitivos',
      minimumQuantity: 5,
      unitLabel: 'unidad'
    }
  },
  {
    id: 'torreznos',
    label: 'Torreznos',
    product: {
      name: 'Torreznos',
      description: 'Ración de torreznos de aproximadamente 600 g.',
      price: 18,
      category: 'aperitivos',
      minimumQuantity: 1,
      unitLabel: 'ración de 600 g'
    }
  },
  {
    id: 'ensalada-fria',
    label: 'Ensalada fría',
    product: {
      name: 'Ensalada Fría',
      description: 'Ración de ensalada fría de aproximadamente 1 kg.',
      price: 30,
      category: 'aperitivos',
      minimumQuantity: 1,
      unitLabel: 'ración de 1 kg'
    }
  }
];
