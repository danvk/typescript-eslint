import {
  TSESTree,
  AST_NODE_TYPES,
} from '@typescript-eslint/experimental-utils';
import * as ts from 'typescript';
import * as util from '../util';

export default util.createRule({
  name: 'no-third-party-any',
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallows any types coming from third-party code (lib or @types)',
      category: 'Possible Errors',
      recommended: 'error',
      requiresTypeChecking: true,
    },
    messages: {
      contextualAny: 'any type inferred for parameter in call expression',
      assignedAny: 'any type assigned to variable',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const { program, esTreeNodeToTSNodeMap } = util.getParserServices(context);
    const checker = program.getTypeChecker();

    const findContainingCallExpression = (
      node: ts.Node,
    ): ts.CallExpression | ts.NewExpression | null => {
      if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
        return node;
      }
      const { parent } = node;
      return parent.kind === ts.SyntaxKind.SourceFile
        ? null
        : findContainingCallExpression(parent);
    };

    return {
      'VariableDeclarator[init != null]'(
        node: TSESTree.VariableDeclarator,
      ): void {
        const init = util.nullThrows(
          node.init,
          util.NullThrowsReasons.MissingToken(node.type, 'init'),
        );
        if (node.id.typeAnnotation) {
          return; // explicit type annotations are OK
        }

        const idNodeTs = esTreeNodeToTSNodeMap.get(node.id);
        const isAny = util.isAnyOrAnyArrayTypeDiscriminated(idNodeTs, checker);
        if (isAny === util.AnyType.Safe) {
          return; // not an any type
        }

        const initTsNode = esTreeNodeToTSNodeMap.get(init);
        if (ts.isCallExpression(initTsNode) || ts.isNewExpression(initTsNode)) {
          const sig = checker.getResolvedSignature(initTsNode);
          const decl = sig?.declaration;
          const src = decl?.getSourceFile();
          if (src?.fileName.match(/node_modules/)) {
            // Gotcha!
            context.report({
              node: node.id,
              messageId: 'assignedAny',
            });
          }
        }
      },
      'ArrowFunctionExpression, FunctionExpression'(
        node: TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression,
      ): void {
        for (const param of node.params) {
          if (param.type === AST_NODE_TYPES.TSParameterProperty) {
            continue;
          }

          // console.log(paramTsNode.getText(), param.typeAnnotation);

          if (param.typeAnnotation) {
            continue; // explicitly annotated parameters are OK, even if they're any.
          }

          const paramTsNode = esTreeNodeToTSNodeMap.get(param);

          const isAny = util.isAnyOrAnyArrayTypeDiscriminated(
            paramTsNode,
            checker,
          );
          if (isAny === util.AnyType.Safe) {
            continue; // not an any type
          }

          // We've got an implicit any! So where did it come from?
          // TODO: look into using util.getContextualType instead of checker.getResolvedSignature
          const callExpr = findContainingCallExpression(paramTsNode);
          if (callExpr) {
            const sig = checker.getResolvedSignature(callExpr);
            const decl = sig?.declaration;
            const src = decl?.getSourceFile();
            if (src?.fileName.match(/node_modules/)) {
              // Gotcha!
              context.report({
                node: param,
                messageId: 'contextualAny',
              });
            }
          }
        }

        // const tsn = esTreeNodeToTSNodeMap.get(node); // "(argMatch, argGroup1) => argGroup1"
        // const callExpr = tsn.parent as ts.CallExpression; // "''.replace(/blah (d+)/, (argMatch, argGroup1) => argGroup1)"
        // callExpr.expression = ''.replace
        // checker.getTypeAtLocation(callExpr);  // this is the type of the return value of the call expression
        // const sig = checker.getResolvedSignature(callExpr);
        // const decl = sig?.declaration;
        // const src = decl?.getSourceFile();
        // const t = checker.getTypeAtLocation(callExpr.expression);
        // const decls = t.getSymbol()!.getDeclarations()!;  // how do we know which one to use?
        // const sigs = t.getCallSignatures();  // how do you figure out which one is being used?
        // for (const decl of decls) {
        //   const source = decl.getSourceFile();
        //   console.log(source.fileName, decl.getFullText());
        // }

        // tsn.parameters[N].type is defined if it has a declared type

        // debugger;
        // > checker.getSignatureFromDeclaration(decls[1]).resolvedReturnType === checker.getTypeAtLocation(callExpr)
        // === true

        // `''.replace(/blah (\d+)/, (argMatch, argGroup1) => argGroup1);`
        // for (const param of node.params) {
        //   const tsNode = esTreeNodeToTSNodeMap.get(param);
        //   const type = checker.getTypeAtLocation(tsNode);
        //   console.log(param, tsNode, type);
        //   debugger;
        // }
      },
    };
  },
});

// ''.replace(/blah (\d+)/, (argMatch, argGroup1) => argGroup1);
