import fs from "node:fs";
import type { Learning } from "../types.js";

// Import bundled templates directly (TypeScript will include them in build)
import genericTemplate from "./generic.json" with { type: "json" };
import typescriptTemplate from "./typescript.json" with { type: "json" };
import reactTemplate from "./react.json" with { type: "json" };
import nodeTemplate from "./node.json" with { type: "json" };

/**
 * Template metadata and content structure
 */
export interface Template {
  version: string;
  name: string;
  description: string;
  scope: "project" | "cross-project" | "global";
  learnings: TemplateLearning[];
}

/**
 * Learning structure within a template (without runtime fields)
 */
export interface TemplateLearning {
  title: string;
  content: string;
  type: Learning["type"];
  scope: Learning["scope"];
  tags: string[];
  confidence: Learning["confidence"];
}

/**
 * Template info for listing
 */
export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  learningCount: number;
}

/**
 * Bundled template IDs
 */
export const BUNDLED_TEMPLATES = ["generic", "typescript", "react", "node"] as const;
export type BundledTemplateId = (typeof BUNDLED_TEMPLATES)[number];

/**
 * Map of bundled templates
 */
const TEMPLATE_MAP: Record<BundledTemplateId, Template> = {
  generic: genericTemplate as Template,
  typescript: typescriptTemplate as Template,
  react: reactTemplate as Template,
  node: nodeTemplate as Template,
};

/**
 * List all available bundled templates
 */
export function listBundledTemplates(): TemplateInfo[] {
  const templates: TemplateInfo[] = [];

  for (const id of BUNDLED_TEMPLATES) {
    const template = TEMPLATE_MAP[id];
    templates.push({
      id,
      name: template.name,
      description: template.description,
      learningCount: template.learnings.length,
    });
  }

  return templates;
}

/**
 * Load a bundled template by ID
 */
export function loadBundledTemplate(id: BundledTemplateId): Template {
  const template = TEMPLATE_MAP[id];
  if (!template) {
    throw new Error(`Template not found: ${id}`);
  }
  return template;
}

/**
 * Check if a template ID is a bundled template
 */
export function isBundledTemplate(id: string): id is BundledTemplateId {
  return BUNDLED_TEMPLATES.includes(id as BundledTemplateId);
}

/**
 * Fetch a template from a URL
 */
export async function fetchTemplateFromUrl(url: string): Promise<Template> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch template: ${response.status} ${response.statusText}`);
  }

  const content = await response.text();

  try {
    const template = JSON.parse(content) as Template;

    // Basic validation
    if (!template.version || !template.name || !Array.isArray(template.learnings)) {
      throw new Error("Invalid template format");
    }

    return template;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Invalid JSON in template");
    }
    throw error;
  }
}

/**
 * Load a template from a local file path
 */
export function loadTemplateFromFile(filePath: string): Template {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Template file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf-8");

  try {
    const template = JSON.parse(content) as Template;

    // Basic validation
    if (!template.version || !template.name || !Array.isArray(template.learnings)) {
      throw new Error("Invalid template format");
    }

    return template;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Invalid JSON in template file");
    }
    throw error;
  }
}
