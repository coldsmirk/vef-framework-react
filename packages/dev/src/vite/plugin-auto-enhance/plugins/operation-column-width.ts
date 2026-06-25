/* eslint-disable unicorn/no-this-outside-of-class -- recast/ast-types PathVisitor methods invoke this.traverse per the visitor API */
import type { AutoEnhanceContext, AutoEnhancePlugin, TransformResult } from "../types";

import { types, visit } from "recast";

interface ButtonInfo {
  hasIcon: boolean;
  textContent: string;
}

interface WidthCalculationResult {
  calculatedWidth: number;
  buttonCount: number;
  analysis: string;
}

/**
 * CJK character regex for width calculation
 */
const CJK_CHAR_REGEX = /[\u4E00-\u9FFF\u3400-\u4DBF\uFF00-\uFFEF]/;

const OPERATION_COLUMN_ATTR = "operationColumn";
const OPERATION_BUTTON_COMPONENT = "OperationButton";

const VALID_IMPORT_SOURCES = [
  "@vef-framework-react/components",
  "@vef-framework-react/starter"
] as const;

/**
 * Map of local names to their original import names
 */
type ImportAliasMap = Map<string, string>;

function isValidImportSource(source: string): boolean {
  return VALID_IMPORT_SOURCES.some(pkg => source === pkg || source.startsWith(`${pkg}/`));
}

function collectOperationButtonAliases(ast: types.ASTNode): ImportAliasMap {
  const aliasMap: ImportAliasMap = new Map();

  visit(ast, {
    visitImportDeclaration(path) {
      const source = path.node.source.value;

      if (typeof source !== "string" || !isValidImportSource(source)) {
        this.traverse(path);
        return false;
      }

      for (const specifier of path.node.specifiers || []) {
        if (!types.namedTypes.ImportSpecifier.check(specifier)) {
          continue;
        }

        const { imported, local } = specifier;

        if (types.namedTypes.Identifier.check(imported)
          && types.namedTypes.Identifier.check(local)
          && imported.name === OPERATION_BUTTON_COMPONENT) {
          aliasMap.set(local.name, imported.name);
        }
      }

      this.traverse(path);
      return false;
    }
  });

  return aliasMap;
}

function calculateTextWidth(text: string): number {
  let width = 0;

  for (const char of text) {
    width += CJK_CHAR_REGEX.test(char) ? 14 : 8;
  }

  return width;
}

function calculateOperationColumnWidth(buttons: ButtonInfo[]): WidthCalculationResult {
  if (buttons.length === 0) {
    return {
      calculatedWidth: 64,
      buttonCount: 0,
      analysis: "No buttons found, using minimum width"
    };
  }

  let totalWidth = 0;
  const buttonCount = buttons.length;

  for (const [index, button] of buttons.entries()) {
    // Base padding
    let buttonWidth = 16;

    if (button.hasIcon) {
      // Icon width
      buttonWidth += 16;

      if (button.textContent) {
        // Gap between icon and text
        buttonWidth += 8;
      }
    }

    if (button.textContent) {
      buttonWidth += calculateTextWidth(button.textContent);
    }

    const minWidth = button.hasIcon && !button.textContent ? 32 : 64;
    buttonWidth = Math.max(buttonWidth, minWidth);
    totalWidth += buttonWidth;

    // Gap between buttons
    if (index < buttonCount - 1) {
      totalWidth += 8;
    }
  }

  // Container padding
  totalWidth += 16;

  const finalWidth = Math.ceil(totalWidth / 8) * 8;

  return {
    calculatedWidth: finalWidth,
    buttonCount,
    analysis: `${buttonCount} buttons, calculated: ${totalWidth}px, final: ${finalWidth}px`
  };
}

function extractButtonInfo(
  jsxElement: types.namedTypes.JSXElement,
  aliasMap: ImportAliasMap
): ButtonInfo | null {
  const { openingElement } = jsxElement;

  if (!types.namedTypes.JSXIdentifier.check(openingElement.name)) {
    return null;
  }

  const componentName = openingElement.name.name;

  if (!aliasMap.has(componentName)) {
    return null;
  }

  const buttonInfo: ButtonInfo = {
    hasIcon: false,
    textContent: ""
  };

  for (const attr of openingElement.attributes || []) {
    if (types.namedTypes.JSXAttribute.check(attr)
      && types.namedTypes.JSXIdentifier.check(attr.name)
      && attr.name.name === "icon") {
      buttonInfo.hasIcon = true;
      break;
    }
  }

  for (const child of jsxElement.children || []) {
    if (types.namedTypes.JSXText.check(child)) {
      buttonInfo.textContent += child.value.trim();
    } else if (types.namedTypes.JSXExpressionContainer.check(child)
      && types.namedTypes.StringLiteral.check(child.expression)) {
      buttonInfo.textContent += child.expression.value;
    }
  }

  return buttonInfo;
}

function findOperationButtons(node: types.namedTypes.Node, aliasMap: ImportAliasMap): ButtonInfo[] {
  const buttons: ButtonInfo[] = [];

  visit(node, {
    visitJSXElement(path: any) {
      const buttonInfo = extractButtonInfo(path.node, aliasMap);

      if (buttonInfo) {
        buttons.push(buttonInfo);
      }

      this.traverse(path);
      return false;
    }
  });

  return buttons;
}

function hasWidthProperty(objectExpression: types.namedTypes.ObjectExpression): boolean {
  return objectExpression.properties.some(prop => {
    if (!types.namedTypes.ObjectProperty.check(prop)) {
      return false;
    }

    const { key } = prop;

    if (types.namedTypes.Identifier.check(key)) {
      return key.name === "width";
    }

    if (types.namedTypes.StringLiteral.check(key)) {
      return key.value === "width";
    }

    return false;
  });
}

function getRenderProperty(
  objectExpression: types.namedTypes.ObjectExpression
): types.namedTypes.ObjectProperty | types.namedTypes.ObjectMethod | undefined {
  return objectExpression.properties.find((prop): prop is types.namedTypes.ObjectProperty | types.namedTypes.ObjectMethod => {
    if (!types.namedTypes.ObjectProperty.check(prop) && !types.namedTypes.ObjectMethod.check(prop)) {
      return false;
    }

    const { key } = prop;

    if (types.namedTypes.Identifier.check(key)) {
      return key.name === "render";
    }

    if (types.namedTypes.StringLiteral.check(key)) {
      return key.value === "render";
    }

    return false;
  });
}

/**
 * Map of function names to their AST nodes
 */
type FunctionDefinitionMap = Map<string, types.namedTypes.Node>;

/**
 * Map of variable names to their object expression nodes
 */
type ObjectDefinitionMap = Map<string, types.namedTypes.ObjectExpression>;

interface DefinitionMaps {
  functionMap: FunctionDefinitionMap;
  objectMap: ObjectDefinitionMap;
}

function isReactHookCall(node: types.namedTypes.CallExpression, hookName: string): boolean {
  const { callee } = node;
  return types.namedTypes.Identifier.check(callee) && callee.name === hookName;
}

function extractCallbackBody(node: types.namedTypes.CallExpression): types.namedTypes.Node | null {
  const [firstArg] = node.arguments;

  if (types.namedTypes.ArrowFunctionExpression.check(firstArg)
    || types.namedTypes.FunctionExpression.check(firstArg)) {
    return firstArg.body;
  }

  return null;
}

function extractMemoObject(node: types.namedTypes.CallExpression): types.namedTypes.ObjectExpression | null {
  const [firstArg] = node.arguments;

  if (!types.namedTypes.ArrowFunctionExpression.check(firstArg)
    && !types.namedTypes.FunctionExpression.check(firstArg)) {
    return null;
  }

  const { body } = firstArg;

  // () => ({ ... })
  if (types.namedTypes.ObjectExpression.check(body)) {
    return body;
  }

  // () => { return { ... } }
  if (types.namedTypes.BlockStatement.check(body)) {
    for (const stmt of body.body) {
      if (types.namedTypes.ReturnStatement.check(stmt)
        && types.namedTypes.ObjectExpression.check(stmt.argument)) {
        return stmt.argument;
      }
    }
  }

  return null;
}

function collectDefinitions(ast: types.ASTNode): DefinitionMaps {
  const functionMap: FunctionDefinitionMap = new Map();
  const objectMap: ObjectDefinitionMap = new Map();

  visit(ast, {
    visitFunctionDeclaration(path) {
      const { node } = path;

      if (types.namedTypes.Identifier.check(node.id)) {
        functionMap.set(node.id.name, node.body);
      }

      this.traverse(path);
      return false;
    },

    visitVariableDeclarator(path) {
      const { node } = path;

      if (!types.namedTypes.Identifier.check(node.id) || !node.init) {
        this.traverse(path);
        return false;
      }

      const varName = node.id.name;
      const { init } = node;

      // Arrow function or function expression
      if (types.namedTypes.ArrowFunctionExpression.check(init)
        || types.namedTypes.FunctionExpression.check(init)) {
        functionMap.set(varName, init.body);
        this.traverse(path);
        return false;
      }

      // Object literal
      if (types.namedTypes.ObjectExpression.check(init)) {
        objectMap.set(varName, init);
        this.traverse(path);
        return false;
      }

      // useCallback(() => ..., [])
      if (types.namedTypes.CallExpression.check(init) && isReactHookCall(init, "useCallback")) {
        const body = extractCallbackBody(init);

        if (body) {
          functionMap.set(varName, body);
        }

        this.traverse(path);
        return false;
      }

      // useMemo(() => ({ ... }), [])
      if (types.namedTypes.CallExpression.check(init) && isReactHookCall(init, "useMemo")) {
        const obj = extractMemoObject(init);

        if (obj) {
          objectMap.set(varName, obj);
        }

        this.traverse(path);
        return false;
      }

      this.traverse(path);
      return false;
    }
  });

  return { functionMap, objectMap };
}

function resolveRenderNode(
  renderProperty: types.namedTypes.ObjectProperty | types.namedTypes.ObjectMethod,
  functionMap: FunctionDefinitionMap
): types.namedTypes.Node | null {
  if (types.namedTypes.ObjectMethod.check(renderProperty)) {
    return renderProperty.body;
  }

  const { value } = renderProperty;

  // Inline function: render: (row) => <OperationButton>...</OperationButton>
  if (types.namedTypes.ArrowFunctionExpression.check(value)
    || types.namedTypes.FunctionExpression.check(value)) {
    return value.body;
  }

  // Function reference: render: renderOperationColumn
  if (types.namedTypes.Identifier.check(value)) {
    const functionBody = functionMap.get(value.name);

    if (functionBody) {
      return functionBody;
    }
  }

  return null;
}

function getComponentName(jsxElement: types.namedTypes.JSXElement): string {
  const { openingElement } = jsxElement;

  if (types.namedTypes.JSXIdentifier.check(openingElement.name)) {
    return openingElement.name.name;
  }

  if (types.namedTypes.JSXMemberExpression.check(openingElement.name)) {
    const { object, property } = openingElement.name;
    const objectName = types.namedTypes.JSXIdentifier.check(object) ? object.name : "?";
    const propertyName = types.namedTypes.JSXIdentifier.check(property) ? property.name : "?";
    return `${objectName}.${propertyName}`;
  }

  return "Unknown";
}

function findParentComponentName(path: any): string {
  let currentPath = path.parentPath;

  while (currentPath) {
    if (types.namedTypes.JSXElement.check(currentPath.node)) {
      return getComponentName(currentPath.node);
    }

    currentPath = currentPath.parentPath;
  }

  return "Unknown";
}

/**
 * Auto-calculate optimal width for operationColumn based on OperationButton components
 */
export const operationColumnWidthPlugin: AutoEnhancePlugin = {
  name: "operation-column-width",
  description: "Automatically calculate optimal width for operation columns based on button analysis",

  shouldProcess(context: AutoEnhanceContext): boolean {
    return context.code.includes(OPERATION_COLUMN_ATTR);
  },

  transform(context: AutoEnhanceContext): TransformResult {
    const aliasMap = collectOperationButtonAliases(context.ast);

    if (aliasMap.size === 0) {
      return { hasChanges: false, logs: [] };
    }

    const { functionMap, objectMap } = collectDefinitions(context.ast);

    let hasChanges = false;
    const logs: string[] = [];

    visit(context.ast, {
      visitJSXAttribute(path) {
        const attr = path.node;

        if (!types.namedTypes.JSXIdentifier.check(attr.name)
          || attr.name.name !== OPERATION_COLUMN_ATTR) {
          this.traverse(path);
          return false;
        }

        if (!types.namedTypes.JSXExpressionContainer.check(attr.value)) {
          this.traverse(path);
          return false;
        }

        const { expression } = attr.value;
        let objectExpression: types.namedTypes.ObjectExpression | null = null;

        if (types.namedTypes.ObjectExpression.check(expression)) {
          // operationColumn={{ render: ... }}
          objectExpression = expression;
        } else if (types.namedTypes.Identifier.check(expression)) {
          // operationColumn={variableName}
          objectExpression = objectMap.get(expression.name) ?? null;
        }

        if (!objectExpression) {
          this.traverse(path);
          return false;
        }

        if (hasWidthProperty(objectExpression)) {
          this.traverse(path);
          return false;
        }

        const renderProperty = getRenderProperty(objectExpression);

        if (!renderProperty) {
          this.traverse(path);
          return false;
        }

        const renderNode = resolveRenderNode(renderProperty, functionMap);

        if (!renderNode) {
          this.traverse(path);
          return false;
        }

        const buttons = findOperationButtons(renderNode, aliasMap);

        if (buttons.length === 0) {
          this.traverse(path);
          return false;
        }

        const { calculatedWidth, analysis } = calculateOperationColumnWidth(buttons);

        const widthProperty = types.builders.objectProperty(
          types.builders.identifier("width"),
          types.builders.numericLiteral(calculatedWidth)
        );

        widthProperty.comments = [types.builders.commentLine(` Auto-calculated: ${analysis} `, true, false)];

        objectExpression.properties.unshift(widthProperty);
        hasChanges = true;

        const componentName = findParentComponentName(path);

        logs.push(
          `[${componentName}]: ${context.fileName}`,
          `   -> Operation column auto-width: ${calculatedWidth}px (${analysis})`
        );

        this.traverse(path);
        return false;
      }
    });

    return { hasChanges, logs };
  }
};
