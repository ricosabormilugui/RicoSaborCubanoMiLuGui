import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProductApiRecord } from '../../core/models/product.model';
import { matchesProductSearch } from '../../core/models/product-filter';
import { PRODUCT_CREATION_PRESETS } from '../../core/config/product-creation-presets.config';
import { DEFAULT_PRODUCT_CATEGORY, getProductCategoryLabel, mergeCategoryOptions, normalizeCategorySlug } from '../../core/config/product-categories.config';
import { AdminAuthService } from '../../core/services/admin-auth.service';
import { AdminOrderService } from '../../core/services/admin-order.service';
import {
  AdminProductPayload,
  AdminProductService
} from '../../core/services/admin-product.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-products-page.component.html',
  styleUrls: ['./admin-products-page.component.css']
})
export class AdminProductsPageComponent {
  email = '';
  password = '';
  readonly search = signal('');
  readonly categoryFilter = signal('');
  imagesText = '';
  ingredientsText = '';
  reviewsText = '';
  customizationThemesText = '';
  customizationColorsText = '';
  customizationSizesText = '';
  customizationFlavorsText = '';
  customizationFillingsText = '';
  customizationToppingsText = '';
  customizationDecorationsText = '';
  selectedPresetId = '';

  readonly productPresets = PRODUCT_CREATION_PRESETS;

  readonly loading = signal(false);
  readonly error = signal('');
  readonly editId = signal<string>('');
  readonly formStep = signal(1);
  readonly maxReachedStep = signal(1);
  readonly attemptedSteps = signal<ReadonlySet<number>>(new Set<number>());
  readonly customizationEditorOpen = signal(false);
  readonly products = signal<ProductApiRecord[]>([]);
  readonly formSteps = [
    { number: 1, label: 'Datos básicos' },
    { number: 2, label: 'Presentación' },
    { number: 3, label: 'Venta y stock' },
    { number: 4, label: 'Personalización' },
    { number: 5, label: 'Revisar' }
  ];
  readonly wizardProgress = computed(() => (this.formStep() / this.formSteps.length) * 100);
  readonly categoryOptions = computed(() => mergeCategoryOptions(this.products().map((product) => product.category)));

  readonly filteredProducts = computed(() => {
    const query = this.search();
    const category = normalizeCategorySlug(this.categoryFilter());

    return this.products()
      .filter((item) => (category ? normalizeCategorySlug(item.category) === category : true))
      .filter((item) => matchesProductSearch({
        name: item.name,
        description: item.description,
        category: item.category
      }, query));
  });

  form: AdminProductPayload = {
    name: '',
    description: '',
    price: 0,
    category: DEFAULT_PRODUCT_CATEGORY,
    imageUrl: '',
    available: true,
    published: true,
    trackStock: false,
    stock: 0,
    lowStockAlert: 5,
    minimumQuantity: 1,
    unitLabel: '',
    order: 0
  };

  constructor(
    public readonly auth: AdminAuthService,
    private readonly adminOrders: AdminOrderService,
    private readonly adminProducts: AdminProductService
  ) {
    if (this.auth.isAuthenticated()) {
      void this.loadProducts();
    }
  }

  async login(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.adminOrders.login(this.email, this.password);
      await this.loadProducts();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    } finally {
      this.loading.set(false);
    }
  }

  logout(): void {
    this.auth.logout();
    this.products.set([]);
  }

  async loadProducts(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      this.products.set(await this.adminProducts.listProducts());
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudieron cargar productos.');
    } finally {
      this.loading.set(false);
    }
  }

  categoryLabel(value: string | null | undefined): string {
    return getProductCategoryLabel(value);
  }

  goToStep(step: number): void {
    const target = Math.max(1, Math.min(this.formSteps.length, Math.floor(step)));
    if (target > this.maxReachedStep()) return;
    this.formStep.set(target);
  }

  nextStep(): void {
    const currentStep = this.formStep();
    this.markStepAttempted(currentStep);
    if (!this.isStepValid(currentStep)) return;

    const nextStep = Math.min(this.formSteps.length, currentStep + 1);
    this.maxReachedStep.update((value) => Math.max(value, nextStep));
    this.formStep.set(nextStep);
  }

  previousStep(): void {
    this.formStep.update((step) => Math.max(1, step - 1));
  }

  editReviewStep(step: number): void {
    this.maxReachedStep.set(this.formSteps.length);
    this.formStep.set(step);
  }

  isStepAccessible(step: number): boolean {
    return step <= this.maxReachedStep();
  }

  isStepComplete(step: number): boolean {
    return step < this.maxReachedStep() && this.isStepValid(step);
  }

  isStepInvalid(step: number): boolean {
    return this.attemptedSteps().has(step) && !this.isStepValid(step);
  }

  isStepValid(step: number): boolean {
    if (step === 1) {
      const price = Number(this.form.price);
      const minimumQuantity = Number(this.form.minimumQuantity);
      const order = Number(this.form.order);
      return this.form.name.trim().length >= 2
        && Boolean(this.form.category.trim())
        && Number.isFinite(price) && price >= 0
        && Number.isInteger(minimumQuantity) && minimumQuantity >= 1
        && Number.isFinite(order);
    }

    if (step === 3) {
      const stock = Number(this.form.stock);
      const lowStockAlert = Number(this.form.lowStockAlert);
      return Number.isFinite(stock) && stock >= 0
        && Number.isFinite(lowStockAlert) && lowStockAlert >= 0;
    }

    return true;
  }

  nameError(): string {
    if (!this.shouldShowStepErrors(1) || this.form.name.trim().length >= 2) return '';
    return 'El nombre es obligatorio y debe tener al menos 2 caracteres.';
  }

  categoryError(): string {
    if (!this.shouldShowStepErrors(1) || this.form.category.trim()) return '';
    return 'Selecciona una categoría.';
  }

  priceError(): string {
    const price = Number(this.form.price);
    if (!this.shouldShowStepErrors(1) || (Number.isFinite(price) && price >= 0)) return '';
    return 'Introduce un precio válido igual o mayor que 0.';
  }

  minimumQuantityError(): string {
    const quantity = Number(this.form.minimumQuantity);
    if (!this.shouldShowStepErrors(1) || (Number.isInteger(quantity) && quantity >= 1)) return '';
    return 'La cantidad mínima debe ser un número entero igual o mayor que 1.';
  }

  stockError(): string {
    const stock = Number(this.form.stock);
    if (!this.shouldShowStepErrors(3) || (Number.isFinite(stock) && stock >= 0)) return '';
    return 'El stock no puede ser negativo.';
  }

  lowStockError(): string {
    const value = Number(this.form.lowStockAlert);
    if (!this.shouldShowStepErrors(3) || (Number.isFinite(value) && value >= 0)) return '';
    return 'La alerta de stock no puede ser negativa.';
  }

  hasCustomizationData(): boolean {
    return [
      this.customizationThemesText,
      this.customizationColorsText,
      this.customizationSizesText,
      this.customizationFlavorsText,
      this.customizationFillingsText,
      this.customizationToppingsText,
      this.customizationDecorationsText
    ].some((value) => value.trim().length > 0);
  }

  customizationOptionCount(): number {
    return [
      this.customizationThemesText,
      this.customizationColorsText,
      this.customizationSizesText,
      this.customizationFlavorsText,
      this.customizationFillingsText,
      this.customizationToppingsText,
      this.customizationDecorationsText
    ].reduce((total, value) => total + value.split('\n').filter((line) => line.trim()).length, 0);
  }

  imagePreviewUrls(): string[] {
    return Array.from(new Set([this.form.imageUrl, ...this.parseLines(this.imagesText)].map((value) => String(value ?? '').trim()).filter(Boolean)));
  }

  openCustomizationEditor(): void {
    this.customizationEditorOpen.set(true);
  }

  private buildProductPayload(product: ProductApiRecord): AdminProductPayload {
    return {
      name: product.name,
      description: product.description ?? '',
      price: Number(product.price ?? 0),
      category: product.category ?? DEFAULT_PRODUCT_CATEGORY,
      imageUrl: product.imageUrl ?? '',
      images: product.images ?? [],
      ingredients: Array.isArray(product.ingredients) ? product.ingredients : [],
      reviews: product.reviews ?? [],
      customizationOptions: product.customizationOptions ?? {},
      available: product.available ?? true,
      published: product.published ?? true,
      trackStock: product.trackStock ?? false,
      stock: Number(product.stock ?? 0),
      lowStockAlert: Number(product.lowStockAlert ?? 5),
      minimumQuantity: Number(product.minimumQuantity ?? 1),
      unitLabel: product.unitLabel ?? '',
      order: Number(product.order ?? 0)
    };
  }

  private normalizedFormPayload(): AdminProductPayload {
    return {
      ...this.form,
      category: normalizeCategorySlug(this.form.category) || DEFAULT_PRODUCT_CATEGORY,
      images: this.parseLines(this.imagesText || this.form.imageUrl),
      ingredients: this.parseLines(this.ingredientsText),
      reviews: this.parseReviews(this.reviewsText),
      customizationOptions: {
        themes: this.parseOptions(this.customizationThemesText),
        colors: this.parseOptions(this.customizationColorsText),
        sizes: this.parseOptions(this.customizationSizesText),
        flavors: this.parseOptions(this.customizationFlavorsText),
        fillings: this.parseOptions(this.customizationFillingsText),
        toppings: this.parseOptions(this.customizationToppingsText),
        decorations: this.parseOptions(this.customizationDecorationsText)
      }
    };
  }

  isLowStock(product: ProductApiRecord): boolean {
    return Boolean(product.trackStock) && Number(product.stock ?? 0) <= Number(product.lowStockAlert ?? 5);
  }

  getStatus(product: ProductApiRecord): { label: string; kind: 'ok' | 'warn' | 'off' } {
    if (!product.published) return { label: '⚫ No publicado', kind: 'off' };
    if (!product.available) return { label: '⚫ No disponible', kind: 'off' };

    if (product.trackStock) {
      const stock = Number(product.stock ?? 0);
      if (stock <= 0) return { label: '🔴 Sin stock', kind: 'off' };
      if (this.isLowStock(product)) return { label: '🟡 Stock bajo', kind: 'warn' };
    }

    return { label: '🟢 Disponible', kind: 'ok' };
  }

  editProduct(product: ProductApiRecord): void {
    this.editId.set(product._id);
    this.formStep.set(1);
    this.maxReachedStep.set(this.formSteps.length);
    this.attemptedSteps.set(new Set<number>());
    this.form = {
      name: product.name,
      description: product.description ?? '',
      price: Number(product.price ?? 0),
      category: product.category ?? DEFAULT_PRODUCT_CATEGORY,
      imageUrl: product.imageUrl ?? '',
      images: product.images ?? [],
      ingredients: Array.isArray(product.ingredients) ? product.ingredients : [],
      reviews: product.reviews ?? [],
      customizationOptions: product.customizationOptions ?? {},
      available: product.available ?? true,
      published: product.published ?? true,
      trackStock: product.trackStock ?? false,
      stock: Number(product.stock ?? 0),
      lowStockAlert: Number(product.lowStockAlert ?? 5),
      minimumQuantity: Number(product.minimumQuantity ?? 1),
      unitLabel: product.unitLabel ?? '',
      order: Number(product.order ?? 0)
    };
    this.imagesText = this.stringifyLines(product.images ?? [product.imageUrl].filter(Boolean));
    this.ingredientsText = this.stringifyLines(Array.isArray(product.ingredients) ? product.ingredients : []);
    this.reviewsText = (product.reviews ?? []).map((review) => `${review.author} | ${review.rating} | ${review.comment}${review.date ? ` | ${review.date}` : ''}`).join('\n');
    this.customizationThemesText = this.stringifyOptions(product.customizationOptions?.themes);
    this.customizationColorsText = this.stringifyOptions(product.customizationOptions?.colors);
    this.customizationSizesText = this.stringifyOptions(product.customizationOptions?.sizes);
    this.customizationFlavorsText = this.stringifyOptions(product.customizationOptions?.flavors);
    this.customizationFillingsText = this.stringifyOptions(product.customizationOptions?.fillings);
    this.customizationToppingsText = this.stringifyOptions(product.customizationOptions?.toppings);
    this.customizationDecorationsText = this.stringifyOptions(product.customizationOptions?.decorations);
    this.customizationEditorOpen.set(this.hasCustomizationData());
    this.scrollToSection('product-editor');
  }

  resetForm(): void {
    this.editId.set('');
    this.formStep.set(1);
    this.maxReachedStep.set(1);
    this.attemptedSteps.set(new Set<number>());
    this.customizationEditorOpen.set(false);
    this.form = {
      name: '',
      description: '',
      price: 0,
      category: DEFAULT_PRODUCT_CATEGORY,
      imageUrl: '',
      available: true,
      published: true,
      trackStock: false,
      stock: 0,
      lowStockAlert: 5,
      minimumQuantity: 1,
      unitLabel: '',
      order: 0
    };
    this.imagesText = '';
    this.ingredientsText = '';
    this.reviewsText = '';
    this.customizationThemesText = '';
    this.customizationColorsText = '';
    this.customizationSizesText = '';
    this.customizationFlavorsText = '';
    this.customizationFillingsText = '';
    this.customizationToppingsText = '';
    this.customizationDecorationsText = '';
    this.selectedPresetId = '';
  }

  applySelectedPreset(): void {
    const preset = this.productPresets.find((item) => item.id === this.selectedPresetId);
    if (!preset) return;

    const selectedPresetId = this.selectedPresetId;
    this.resetForm();
    this.selectedPresetId = selectedPresetId;
    this.form = {
      ...this.form,
      ...preset.product,
      customizationOptions: preset.product.customizationOptions ?? {}
    };

    const options = preset.product.customizationOptions;
    this.customizationThemesText = this.stringifyOptions(options?.themes);
    this.customizationColorsText = this.stringifyOptions(options?.colors);
    this.customizationSizesText = this.stringifyOptions(options?.sizes);
    this.customizationFlavorsText = this.stringifyOptions(options?.flavors);
    this.customizationFillingsText = this.stringifyOptions(options?.fillings);
    this.customizationToppingsText = this.stringifyOptions(options?.toppings);
    this.customizationDecorationsText = this.stringifyOptions(options?.decorations);
    this.customizationEditorOpen.set(this.hasCustomizationData());
  }

  private parseLines(value: string): string[] {
    return String(value ?? '').split(/\n|,/).map((item) => item.trim()).filter(Boolean);
  }

  private stringifyLines(values: unknown[] = []): string {
    return values.map((item) => String(item ?? '').trim()).filter(Boolean).join('\n');
  }

  private parseOptions(value: string): Array<{ name: string; price?: number }> {
    return String(value ?? '').split('\n').map((line) => {
      const [name, priceValue] = line.split('|').map((part) => part.trim());
      const price = Number(priceValue ?? 0);
      return name ? { name, ...(Number.isFinite(price) && price > 0 ? { price } : {}) } : null;
    }).filter((item): item is { name: string; price?: number } => Boolean(item));
  }

  private stringifyOptions(values: Array<{ name?: string; price?: number }> = []): string {
    return values.map((item) => `${item.name ?? ''}${item.price ? ` | ${item.price}` : ''}`.trim()).filter(Boolean).join('\n');
  }

  private parseReviews(value: string): Array<{ author: string; rating: number; comment: string; date?: string }> {
    return String(value ?? '').split('\n').map((line) => {
      const [author, ratingValue, comment, date] = line.split('|').map((part) => part.trim());
      const rating = Math.max(1, Math.min(5, Number(ratingValue ?? 5)));
      return author && comment ? { author, rating, comment, ...(date ? { date } : {}) } : null;
    }).filter((item): item is { author: string; rating: number; comment: string; date?: string } => Boolean(item));
  }

  async saveProduct(): Promise<void> {
    this.markStepAttempted(1);
    this.markStepAttempted(3);
    const invalidStep = [1, 3].find((step) => !this.isStepValid(step));
    if (invalidStep) {
      this.formStep.set(invalidStep);
      this.scrollToSection('product-editor');
      return;
    }

    try {
      if (this.editId()) {
        await this.adminProducts.updateProduct(this.editId(), this.normalizedFormPayload());
      } else {
        await this.adminProducts.createProduct(this.normalizedFormPayload());
      }

      this.resetForm();
      await this.loadProducts();
      this.scrollToSection('product-management');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo guardar el producto.');
    }
  }

  async togglePublished(product: ProductApiRecord): Promise<void> {
    try {
      await this.adminProducts.updateProduct(product._id, {
        ...this.buildProductPayload(product),
        published: !(product.published ?? true)
      });
      await this.loadProducts();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo cambiar publicación.');
    }
  }

  async toggleAvailability(product: ProductApiRecord): Promise<void> {
    try {
      await this.adminProducts.updateProduct(product._id, {
        ...this.buildProductPayload(product),
        available: !(product.available ?? true)
      });
      await this.loadProducts();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo cambiar disponibilidad.');
    }
  }

  async removeProduct(product: ProductApiRecord): Promise<void> {
    if (!globalThis.confirm(`Eliminar producto ${product.name}?`)) return;

    try {
      await this.adminProducts.deleteProduct(product._id);
      await this.loadProducts();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo eliminar producto.');
    }
  }

  showProductEditor(): void {
    this.scrollToSection('product-editor');
  }

  showProductManagement(): void {
    this.scrollToSection('product-management');
  }

  private scrollToSection(id: string): void {
    globalThis.setTimeout(() => globalThis.document?.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  private markStepAttempted(step: number): void {
    this.attemptedSteps.update((steps) => new Set([...steps, step]));
  }

  private shouldShowStepErrors(step: number): boolean {
    return this.attemptedSteps().has(step);
  }
}
