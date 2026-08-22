import { logger } from "../lib/logger.js";
import * as categoriesRepository from "../repositories/categories.repository.js";
import { normalizeCategorySlug } from "../config/product-categories.config.js";

function readLabel(body = {}) {
  return String(body.label ?? body.name ?? "").trim().replace(/\s+/g, " ");
}

function isDuplicateError(error) {
  return error?.code === 11000;
}

export function createCategoryHandlers(repository = categoriesRepository) {
  return {
    async listPublic(_req, res) {
      try {
        const categories = await repository.listCategories();
        return res.status(200).json({ categories });
      } catch (error) {
        logger.error("categories.public.list.failed", { error: error.message ?? "Unexpected error" });
        return res.status(500).json({ message: "No fue posible cargar las categorías." });
      }
    },

    async listAdmin(_req, res) {
      try {
        const categories = await repository.listCategories({ includeProductCount: true });
        return res.status(200).json({ categories });
      } catch (error) {
        logger.error("categories.admin.list.failed", { error: error.message ?? "Unexpected error" });
        return res.status(500).json({ message: "No fue posible cargar las categorías." });
      }
    },

    async create(req, res) {
      const label = readLabel(req.body);
      const slug = normalizeCategorySlug(label);
      if (label.length < 2 || label.length > 80 || !slug) {
        return res.status(400).json({ message: "El nombre de la categoría debe tener entre 2 y 80 caracteres." });
      }

      try {
        if (await repository.findCategoryByNormalizedName(label)) {
          return res.status(409).json({ message: "Ya existe una categoría con ese nombre." });
        }
        const category = await repository.createCategory({ label, slug });
        return res.status(201).json({ category });
      } catch (error) {
        if (isDuplicateError(error)) return res.status(409).json({ message: "Ya existe una categoría con ese nombre." });
        logger.error("categories.admin.create.failed", { error: error.message ?? "Unexpected error" });
        return res.status(500).json({ message: "No fue posible crear la categoría." });
      }
    },

    async update(req, res) {
      const label = readLabel(req.body);
      if (label.length < 2 || label.length > 80 || !normalizeCategorySlug(label)) {
        return res.status(400).json({ message: "El nombre de la categoría debe tener entre 2 y 80 caracteres." });
      }

      try {
        const existing = await repository.findCategoryById(req.params.id);
        if (!existing) return res.status(404).json({ message: "La categoría no existe." });
        const duplicate = await repository.findCategoryByNormalizedName(label);
        if (duplicate && String(duplicate._id) !== String(existing._id)) {
          return res.status(409).json({ message: "Ya existe una categoría con ese nombre." });
        }
        const category = await repository.updateCategoryLabel(req.params.id, label);
        return res.status(200).json({ category });
      } catch (error) {
        if (isDuplicateError(error)) return res.status(409).json({ message: "Ya existe una categoría con ese nombre." });
        logger.error("categories.admin.update.failed", { error: error.message ?? "Unexpected error" });
        return res.status(500).json({ message: "No fue posible actualizar la categoría." });
      }
    },

    async remove(req, res) {
      try {
        const category = await repository.findCategoryById(req.params.id);
        if (!category) return res.status(404).json({ message: "La categoría no existe." });

        const productCount = await repository.countProductsForCategory(category.slug);
        if (productCount > 0) {
          return res.status(409).json({
            message: "No se puede eliminar la categoría porque tiene productos asociados.",
            productCount
          });
        }

        const deleted = await repository.deleteCategoryById(req.params.id);
        if (!deleted) return res.status(404).json({ message: "La categoría ya no existe." });
        return res.status(200).json({ deleted: true, id: req.params.id });
      } catch (error) {
        logger.error("categories.admin.delete.failed", { error: error.message ?? "Unexpected error" });
        return res.status(500).json({ message: "No fue posible eliminar la categoría." });
      }
    }
  };
}

const handlers = createCategoryHandlers();
export const getCategories = handlers.listPublic;
export const getCategoriesForAdmin = handlers.listAdmin;
export const createCategoryForAdmin = handlers.create;
export const updateCategoryForAdmin = handlers.update;
export const deleteCategoryForAdmin = handlers.remove;
