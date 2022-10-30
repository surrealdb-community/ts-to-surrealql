import ts from "npm:typescript";
import CodeBlockWriter2 from "npm:code-block-writer";
import {createPatch} from 'npm:rfc6902'
const CodeBlockWriter = CodeBlockWriter2.default

const node = ts.createSourceFile("_.ts", Deno.readTextFileSync('./def.ts'), ts.ScriptTarget.Latest);

const factoryCode = generateFactoryCode(ts, node)


Deno.writeTextFileSync('factory.mjs', `
  ${JSON.stringify(factoryCode, null, 2)}
`)

const old = JSON.parse(Deno.readTextFileSync('factory2.json'))
const out = parseOutput(factoryCode as any)

const __INTERNAL__TYPES__ = {
    'STRING': 'string',
    'INT': 'int',
    'BOOL': 'bool',
    'DECIMAL': 'decimal'
} as const

function genExpr(type: any): string {
    if(typeof type === 'string') {
        // Bigint type support!
        if(/\-?\d+n/.test(type)) {
            return type.slice(0, type.length - 1)
        }
    }
    if(typeof type !== 'object') return JSON.stringify(type)
    if(type.type === 'SQL_EXPR') {
        return type.typeArgs[0]
    }
    if(type.type === 'FUTURE') {
        return `<future> genExpr(type.typeArgs[1])`
    }
    // console.log(type)
    return '??'
}

function genFieldDef(t: string, field: string, type: any): string {
    let valueStr = '';
    if(type.type === 'WITH_DEFAULT') {
        valueStr = "$value OR " + genExpr(type.typeArgs[1])
        type = type.typeArgs[0]
    }
    if(type.type === 'WITH_VALUE') {
        valueStr = genExpr(type.typeArgs[1])
        type = type.typeArgs[0]
    }
    if(type.type === 'FUTURE') {
        valueStr = `<future> ${genExpr(type.typeArgs[1])}`
        type = type.typeArgs[0]
    }

    if(valueStr) valueStr = " VALUE " + valueStr;
    if(type.type in __INTERNAL__TYPES__) {
        return `DEFINE FIELD ${field} ON TABLE ${t} TYPE ${__INTERNAL__TYPES__[type.type as keyof typeof __INTERNAL__TYPES__]}${valueStr};`
    }
    if(type.type === 'keyword') {
        return `DEFINE FIELD ${field} ON TABLE ${t} TYPE any${valueStr};`
    }
    if(type.type === 'RECORD') {
        return `DEFINE FIELD ${field} ON TABLE ${t} TYPE record(${type.typeArgs[0].type})${valueStr};`
    }
    if(type.type === 'array' || type.type === 'Array') {
        return [
            `DEFINE FIELD ${field} ON TABLE ${t} TYPE array${valueStr};`,
            genFieldDef(t, field + '.*', type.typeArgs[0])
        ].join('\n')
    }
    if(type.type === 'typeLiteral') {
        return [
            `DEFINE FIELD ${field} ON TABLE ${t} TYPE object${valueStr};`,
            ...Object.keys(type.members).map(mem => genFieldDef(t, field + '.' + mem, type.members[mem].type))
        ].join('\n')
    }
    if(type.type === 'tuple') {
        return [
            `DEFINE FIELD ${field} ON TABLE ${t} TYPE array${valueStr};`,
            ...type.typeArgs.map((_: any, idx: number) => genFieldDef(t, field + '[' + idx + ']', type.typeArgs[idx]))
        ].join('\n')
    }
    if(type.type === 'union') {
        return `DEFINE FIELD ${field} ON TABLE ${t} TYPE any${valueStr};`
    }
    // console.log(type)
    return ''
}

const tableDef = Object.keys(out).map(v=>`DEFINE TABLE ${v} SCHEMAFULL;`).join('\n') + '\n'
const fieldDef = Object.keys(out).flatMap(t => {
    const tableMembers = out[t].members

    if(!tableMembers) {
        // TODO handle typedefs
        return '/*' +JSON.stringify( out[t] )+'*/'
    }

    if(out[t].extends) {
        // TODO handle types
        console.log(out[t].extends)
    }


    // console.log(tableMembers)
    return Object.keys(tableMembers).flatMap(field => {
        const tableField = tableMembers[field]
        return genFieldDef(t, field, tableField.type)
    })
}).join('\n')

Deno.writeTextFileSync('factory2.json', JSON.stringify(parseOutput(factoryCode as any), null, 2))

Deno.writeTextFileSync('diff.json', JSON.stringify(createPatch(old, parseOutput(factoryCode as any)), null, 2))
Deno.writeTextFileSync('out.surql', tableDef + fieldDef)




function parseOutput(out: [any]) {
  const realOut = out[0].filter(Boolean)
//   console.log(realOut)
  const ret: any = {}
  realOut.forEach((mem: any) => {
    // console.log(mem)
    ret[mem.name] = mem
  })
  return ret
}

function generateFactoryCode(ts: typeof import("npm:typescript"), initialNode: import("npm:typescript").Node) {
    const writer = new CodeBlockWriter({ newLine: "\n", indentNumberOfSpaces: 2 });
    const syntaxKindToName = createSyntaxKindToNameMap();

    let out = ''

    if (ts.isSourceFile(initialNode)) {
      out = initialNode.statements.map(v=>writeNodeText(v))
    }
    else {
      out =  writeNodeText(initialNode);
    }
    writer.newLineIfLastNot();

    return [out, writer.toString()];

    function writeNodeText(node: import("npm:typescript").Node): any {
        switch (node.kind) {
            case ts.SyntaxKind.NumericLiteral:
                return createNumericLiteral(node as import("npm:typescript").NumericLiteral);
            case ts.SyntaxKind.BigIntLiteral:
                return createBigIntLiteral(node as import("npm:typescript").BigIntLiteral);
            case ts.SyntaxKind.StringLiteral:
                return createStringLiteral(node as import("npm:typescript").StringLiteral);
            case ts.SyntaxKind.RegularExpressionLiteral:
                return createRegularExpressionLiteral(node as import("npm:typescript").RegularExpressionLiteral);
            case ts.SyntaxKind.Identifier:
                return createIdentifier(node as import("npm:typescript").Identifier);
            case ts.SyntaxKind.PrivateIdentifier:
                return createPrivateIdentifier(node as import("npm:typescript").PrivateIdentifier);
            case ts.SyntaxKind.SuperKeyword:
                return createSuper(node as import("npm:typescript").SuperExpression);
            case ts.SyntaxKind.ThisKeyword:
                return createThis(node as import("npm:typescript").ThisExpression);
            case ts.SyntaxKind.NullKeyword:
                return createNull(node as import("npm:typescript").NullLiteral);
            case ts.SyntaxKind.TrueKeyword:
                return createTrue(node as import("npm:typescript").TrueLiteral);
            case ts.SyntaxKind.FalseKeyword:
                return createFalse(node as import("npm:typescript").FalseLiteral);
            case ts.SyntaxKind.QualifiedName:
                return createQualifiedName(node as import("npm:typescript").QualifiedName);
            case ts.SyntaxKind.ComputedPropertyName:
                return createComputedPropertyName(node as import("npm:typescript").ComputedPropertyName);
            case ts.SyntaxKind.TypeParameter:
                return createTypeParameterDeclaration(node as import("npm:typescript").TypeParameterDeclaration);
            case ts.SyntaxKind.Parameter:
                return createParameterDeclaration(node as import("npm:typescript").ParameterDeclaration);
            case ts.SyntaxKind.Decorator:
                return createDecorator(node as import("npm:typescript").Decorator);
            case ts.SyntaxKind.PropertySignature:
                return createPropertySignature(node as import("npm:typescript").PropertySignature);
            case ts.SyntaxKind.PropertyDeclaration:
                return createPropertyDeclaration(node as import("npm:typescript").PropertyDeclaration);
            case ts.SyntaxKind.MethodSignature:
                return createMethodSignature(node as import("npm:typescript").MethodSignature);
            case ts.SyntaxKind.MethodDeclaration:
                return createMethodDeclaration(node as import("npm:typescript").MethodDeclaration);
            case ts.SyntaxKind.Constructor:
                return createConstructorDeclaration(node as import("npm:typescript").ConstructorDeclaration);
            case ts.SyntaxKind.GetAccessor:
                return createGetAccessorDeclaration(node as import("npm:typescript").GetAccessorDeclaration);
            case ts.SyntaxKind.SetAccessor:
                return createSetAccessorDeclaration(node as import("npm:typescript").SetAccessorDeclaration);
            case ts.SyntaxKind.CallSignature:
                return createCallSignature(node as import("npm:typescript").CallSignatureDeclaration);
            case ts.SyntaxKind.ConstructSignature:
                return createConstructSignature(node as import("npm:typescript").ConstructSignatureDeclaration);
            case ts.SyntaxKind.IndexSignature:
                return createIndexSignature(node as import("npm:typescript").IndexSignatureDeclaration);
            case ts.SyntaxKind.TemplateLiteralTypeSpan:
                return createTemplateLiteralTypeSpan(node as import("npm:typescript").TemplateLiteralTypeSpan);
            case ts.SyntaxKind.ClassStaticBlockDeclaration:
                return createClassStaticBlockDeclaration(node as import("npm:typescript").ClassStaticBlockDeclaration);
            case ts.SyntaxKind.AnyKeyword:
                return createKeywordTypeNode(node as import("npm:typescript").KeywordTypeNode);
            case ts.SyntaxKind.BooleanKeyword:
                return createKeywordTypeNode(node as import("npm:typescript").KeywordTypeNode);
            case ts.SyntaxKind.IntrinsicKeyword:
                return createKeywordTypeNode(node as import("npm:typescript").KeywordTypeNode);
            case ts.SyntaxKind.NeverKeyword:
                return createKeywordTypeNode(node as import("npm:typescript").KeywordTypeNode);
            case ts.SyntaxKind.NumberKeyword:
                return createKeywordTypeNode(node as import("npm:typescript").KeywordTypeNode);
            case ts.SyntaxKind.ObjectKeyword:
                return createKeywordTypeNode(node as import("npm:typescript").KeywordTypeNode);
            case ts.SyntaxKind.StringKeyword:
                return createKeywordTypeNode(node as import("npm:typescript").KeywordTypeNode);
            case ts.SyntaxKind.SymbolKeyword:
                return createKeywordTypeNode(node as import("npm:typescript").KeywordTypeNode);
            case ts.SyntaxKind.UndefinedKeyword:
                return createKeywordTypeNode(node as import("npm:typescript").KeywordTypeNode);
            case ts.SyntaxKind.UnknownKeyword:
                return createKeywordTypeNode(node as import("npm:typescript").KeywordTypeNode);
            case ts.SyntaxKind.BigIntKeyword:
                return createKeywordTypeNode(node as import("npm:typescript").KeywordTypeNode);
            case ts.SyntaxKind.TypeReference:
                return createTypeReferenceNode(node as import("npm:typescript").TypeReferenceNode);
            case ts.SyntaxKind.FunctionType:
                return createFunctionTypeNode(node as import("npm:typescript").FunctionTypeNode);
            case ts.SyntaxKind.ConstructorType:
                return createConstructorTypeNode(node as import("npm:typescript").ConstructorTypeNode);
            case ts.SyntaxKind.TypeQuery:
                return createTypeQueryNode(node as import("npm:typescript").TypeQueryNode);
            case ts.SyntaxKind.TypeLiteral:
                return createTypeLiteralNode(node as import("npm:typescript").TypeLiteralNode);
            case ts.SyntaxKind.ArrayType:
                return createArrayTypeNode(node as import("npm:typescript").ArrayTypeNode);
            case ts.SyntaxKind.TupleType:
                return createTupleTypeNode(node as import("npm:typescript").TupleTypeNode);
            case ts.SyntaxKind.NamedTupleMember:
                return createNamedTupleMember(node as import("npm:typescript").NamedTupleMember);
            case ts.SyntaxKind.OptionalType:
                return createOptionalTypeNode(node as import("npm:typescript").OptionalTypeNode);
            case ts.SyntaxKind.RestType:
                return createRestTypeNode(node as import("npm:typescript").RestTypeNode);
            case ts.SyntaxKind.UnionType:
                return createUnionTypeNode(node as import("npm:typescript").UnionTypeNode);
            case ts.SyntaxKind.IntersectionType:
                return createIntersectionTypeNode(node as import("npm:typescript").IntersectionTypeNode);
            case ts.SyntaxKind.ConditionalType:
                return createConditionalTypeNode(node as import("npm:typescript").ConditionalTypeNode);
            case ts.SyntaxKind.InferType:
                return createInferTypeNode(node as import("npm:typescript").InferTypeNode);
            case ts.SyntaxKind.ImportType:
                return createImportTypeNode(node as import("npm:typescript").ImportTypeNode);
            case ts.SyntaxKind.ParenthesizedType:
                return createParenthesizedType(node as import("npm:typescript").ParenthesizedTypeNode);
            case ts.SyntaxKind.ThisType:
                return createThisTypeNode(node as import("npm:typescript").ThisTypeNode);
            case ts.SyntaxKind.TypeOperator:
                return createTypeOperatorNode(node as import("npm:typescript").TypeOperatorNode);
            case ts.SyntaxKind.IndexedAccessType:
                return createIndexedAccessTypeNode(node as import("npm:typescript").IndexedAccessTypeNode);
            case ts.SyntaxKind.MappedType:
                return createMappedTypeNode(node as import("npm:typescript").MappedTypeNode);
            case ts.SyntaxKind.LiteralType:
                return createLiteralTypeNode(node as import("npm:typescript").LiteralTypeNode);
            case ts.SyntaxKind.TemplateLiteralType:
                return createTemplateLiteralType(node as import("npm:typescript").TemplateLiteralTypeNode);
            case ts.SyntaxKind.ObjectBindingPattern:
                return createObjectBindingPattern(node as import("npm:typescript").ObjectBindingPattern);
            case ts.SyntaxKind.ArrayBindingPattern:
                return createArrayBindingPattern(node as import("npm:typescript").ArrayBindingPattern);
            case ts.SyntaxKind.BindingElement:
                return createBindingElement(node as import("npm:typescript").BindingElement);
            case ts.SyntaxKind.ArrayLiteralExpression:
                return createArrayLiteralExpression(node as import("npm:typescript").ArrayLiteralExpression);
            case ts.SyntaxKind.ObjectLiteralExpression:
                return createObjectLiteralExpression(node as import("npm:typescript").ObjectLiteralExpression);
            case ts.SyntaxKind.NewExpression:
                return createNewExpression(node as import("npm:typescript").NewExpression);
            case ts.SyntaxKind.TaggedTemplateExpression:
                return createTaggedTemplateExpression(node as import("npm:typescript").TaggedTemplateExpression);
            case ts.SyntaxKind.TypeAssertionExpression:
                return createTypeAssertion(node as import("npm:typescript").TypeAssertion);
            case ts.SyntaxKind.ParenthesizedExpression:
                return createParenthesizedExpression(node as import("npm:typescript").ParenthesizedExpression);
            case ts.SyntaxKind.FunctionExpression:
                return createFunctionExpression(node as import("npm:typescript").FunctionExpression);
            case ts.SyntaxKind.ArrowFunction:
                return createArrowFunction(node as import("npm:typescript").ArrowFunction);
            case ts.SyntaxKind.DeleteExpression:
                return createDeleteExpression(node as import("npm:typescript").DeleteExpression);
            case ts.SyntaxKind.TypeOfExpression:
                return createTypeOfExpression(node as import("npm:typescript").TypeOfExpression);
            case ts.SyntaxKind.VoidExpression:
                return createVoidExpression(node as import("npm:typescript").VoidExpression);
            case ts.SyntaxKind.AwaitExpression:
                return createAwaitExpression(node as import("npm:typescript").AwaitExpression);
            case ts.SyntaxKind.PrefixUnaryExpression:
                return createPrefixUnaryExpression(node as import("npm:typescript").PrefixUnaryExpression);
            case ts.SyntaxKind.PostfixUnaryExpression:
                return createPostfixUnaryExpression(node as import("npm:typescript").PostfixUnaryExpression);
            case ts.SyntaxKind.BinaryExpression:
                return createBinaryExpression(node as import("npm:typescript").BinaryExpression);
            case ts.SyntaxKind.ConditionalExpression:
                return createConditionalExpression(node as import("npm:typescript").ConditionalExpression);
            case ts.SyntaxKind.TemplateExpression:
                return createTemplateExpression(node as import("npm:typescript").TemplateExpression);
            case ts.SyntaxKind.TemplateHead:
                return createTemplateHead(node as import("npm:typescript").TemplateHead);
            case ts.SyntaxKind.TemplateMiddle:
                return createTemplateMiddle(node as import("npm:typescript").TemplateMiddle);
            case ts.SyntaxKind.TemplateTail:
                return createTemplateTail(node as import("npm:typescript").TemplateTail);
            case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
                return createNoSubstitutionTemplateLiteral(node as import("npm:typescript").NoSubstitutionTemplateLiteral);
            case ts.SyntaxKind.YieldExpression:
                return createYieldExpression(node as import("npm:typescript").YieldExpression);
            case ts.SyntaxKind.SpreadElement:
                return createSpreadElement(node as import("npm:typescript").SpreadElement);
            case ts.SyntaxKind.ClassExpression:
                return createClassExpression(node as import("npm:typescript").ClassExpression);
            case ts.SyntaxKind.OmittedExpression:
                return createOmittedExpression(node as import("npm:typescript").OmittedExpression);
            case ts.SyntaxKind.ExpressionWithTypeArguments:
                return createExpressionWithTypeArguments(node as import("npm:typescript").ExpressionWithTypeArguments);
            case ts.SyntaxKind.AsExpression:
                return createAsExpression(node as import("npm:typescript").AsExpression);
            case ts.SyntaxKind.MetaProperty:
                return createMetaProperty(node as import("npm:typescript").MetaProperty);
            case ts.SyntaxKind.TemplateSpan:
                return createTemplateSpan(node as import("npm:typescript").TemplateSpan);
            case ts.SyntaxKind.SemicolonClassElement:
                return createSemicolonClassElement(node as import("npm:typescript").SemicolonClassElement);
            case ts.SyntaxKind.Block:
                return createBlock(node as import("npm:typescript").Block);
            case ts.SyntaxKind.VariableStatement:
                return createVariableStatement(node as import("npm:typescript").VariableStatement);
            case ts.SyntaxKind.EmptyStatement:
                return createEmptyStatement(node as import("npm:typescript").EmptyStatement);
            case ts.SyntaxKind.ExpressionStatement:
                return createExpressionStatement(node as import("npm:typescript").ExpressionStatement);
            case ts.SyntaxKind.IfStatement:
                return createIfStatement(node as import("npm:typescript").IfStatement);
            case ts.SyntaxKind.DoStatement:
                return createDoStatement(node as import("npm:typescript").DoStatement);
            case ts.SyntaxKind.WhileStatement:
                return createWhileStatement(node as import("npm:typescript").WhileStatement);
            case ts.SyntaxKind.ForStatement:
                return createForStatement(node as import("npm:typescript").ForStatement);
            case ts.SyntaxKind.ForInStatement:
                return createForInStatement(node as import("npm:typescript").ForInStatement);
            case ts.SyntaxKind.ForOfStatement:
                return createForOfStatement(node as import("npm:typescript").ForOfStatement);
            case ts.SyntaxKind.ContinueStatement:
                return createContinueStatement(node as import("npm:typescript").ContinueStatement);
            case ts.SyntaxKind.BreakStatement:
                return createBreakStatement(node as import("npm:typescript").BreakStatement);
            case ts.SyntaxKind.ReturnStatement:
                return createReturnStatement(node as import("npm:typescript").ReturnStatement);
            case ts.SyntaxKind.WithStatement:
                return createWithStatement(node as import("npm:typescript").WithStatement);
            case ts.SyntaxKind.SwitchStatement:
                return createSwitchStatement(node as import("npm:typescript").SwitchStatement);
            case ts.SyntaxKind.LabeledStatement:
                return createLabeledStatement(node as import("npm:typescript").LabeledStatement);
            case ts.SyntaxKind.ThrowStatement:
                return createThrowStatement(node as import("npm:typescript").ThrowStatement);
            case ts.SyntaxKind.TryStatement:
                return createTryStatement(node as import("npm:typescript").TryStatement);
            case ts.SyntaxKind.DebuggerStatement:
                return createDebuggerStatement(node as import("npm:typescript").DebuggerStatement);
            case ts.SyntaxKind.VariableDeclaration:
                return createVariableDeclaration(node as import("npm:typescript").VariableDeclaration);
            case ts.SyntaxKind.VariableDeclarationList:
                return createVariableDeclarationList(node as import("npm:typescript").VariableDeclarationList);
            case ts.SyntaxKind.FunctionDeclaration:
                return createFunctionDeclaration(node as import("npm:typescript").FunctionDeclaration);
            case ts.SyntaxKind.ClassDeclaration:
                return createClassDeclaration(node as import("npm:typescript").ClassDeclaration);
            case ts.SyntaxKind.InterfaceDeclaration:
                return createInterfaceDeclaration(node as import("npm:typescript").InterfaceDeclaration);
            case ts.SyntaxKind.TypeAliasDeclaration:
                return createTypeAliasDeclaration(node as import("npm:typescript").TypeAliasDeclaration);
            case ts.SyntaxKind.EnumDeclaration:
                return createEnumDeclaration(node as import("npm:typescript").EnumDeclaration);
            case ts.SyntaxKind.ModuleDeclaration:
                return createModuleDeclaration(node as import("npm:typescript").ModuleDeclaration);
            case ts.SyntaxKind.ModuleBlock:
                return createModuleBlock(node as import("npm:typescript").ModuleBlock);
            case ts.SyntaxKind.CaseBlock:
                return createCaseBlock(node as import("npm:typescript").CaseBlock);
            case ts.SyntaxKind.NamespaceExportDeclaration:      
                return createNamespaceExportDeclaration(node as import("npm:typescript").NamespaceExportDeclaration);
            case ts.SyntaxKind.ImportEqualsDeclaration:
                return createImportEqualsDeclaration(node as import("npm:typescript").ImportEqualsDeclaration);
            case ts.SyntaxKind.ImportDeclaration:
                return createImportDeclaration(node as import("npm:typescript").ImportDeclaration);
            case ts.SyntaxKind.ImportClause:
                return createImportClause(node as import("npm:typescript").ImportClause);
            case ts.SyntaxKind.AssertClause:
                return createAssertClause(node as import("npm:typescript").AssertClause);
            case ts.SyntaxKind.AssertEntry:
                return createAssertEntry(node as import("npm:typescript").AssertEntry);
            case ts.SyntaxKind.NamespaceImport:
                return createNamespaceImport(node as import("npm:typescript").NamespaceImport);
            case ts.SyntaxKind.NamespaceExport:
                return createNamespaceExport(node as import("npm:typescript").NamespaceExport);
            case ts.SyntaxKind.NamedImports:
                return createNamedImports(node as import("npm:typescript").NamedImports);
            case ts.SyntaxKind.ImportSpecifier:
                return createImportSpecifier(node as import("npm:typescript").ImportSpecifier);
            case ts.SyntaxKind.ExportAssignment:
                return createExportAssignment(node as import("npm:typescript").ExportAssignment);
            case ts.SyntaxKind.ExportDeclaration:
                return createExportDeclaration(node as import("npm:typescript").ExportDeclaration);
            case ts.SyntaxKind.NamedExports:
                return createNamedExports(node as import("npm:typescript").NamedExports);
            case ts.SyntaxKind.ExportSpecifier:
                return createExportSpecifier(node as import("npm:typescript").ExportSpecifier);
            case ts.SyntaxKind.ExternalModuleReference:
                return createExternalModuleReference(node as import("npm:typescript").ExternalModuleReference);
            case ts.SyntaxKind.JsxElement:
                return createJsxElement(node as import("npm:typescript").JsxElement);
            case ts.SyntaxKind.JsxSelfClosingElement:
                return createJsxSelfClosingElement(node as import("npm:typescript").JsxSelfClosingElement);
            case ts.SyntaxKind.JsxOpeningElement:
                return createJsxOpeningElement(node as import("npm:typescript").JsxOpeningElement);
            case ts.SyntaxKind.JsxClosingElement:
                return createJsxClosingElement(node as import("npm:typescript").JsxClosingElement);
            case ts.SyntaxKind.JsxFragment:
                return createJsxFragment(node as import("npm:typescript").JsxFragment);
            case ts.SyntaxKind.JsxText:
                return createJsxText(node as import("npm:typescript").JsxText);
            case ts.SyntaxKind.JsxOpeningFragment:
                return createJsxOpeningFragment(node as import("npm:typescript").JsxOpeningFragment);
            case ts.SyntaxKind.JsxClosingFragment:
                return createJsxJsxClosingFragment(node as import("npm:typescript").JsxClosingFragment);
            case ts.SyntaxKind.JsxAttribute:
                return createJsxAttribute(node as import("npm:typescript").JsxAttribute);
            case ts.SyntaxKind.JsxAttributes:
                return createJsxAttributes(node as import("npm:typescript").JsxAttributes);
            case ts.SyntaxKind.JsxSpreadAttribute:
                return createJsxSpreadAttribute(node as import("npm:typescript").JsxSpreadAttribute);
            case ts.SyntaxKind.JsxExpression:
                return createJsxExpression(node as import("npm:typescript").JsxExpression);
            case ts.SyntaxKind.CaseClause:
                return createCaseClause(node as import("npm:typescript").CaseClause);
            case ts.SyntaxKind.DefaultClause:
                return createDefaultClause(node as import("npm:typescript").DefaultClause);
            case ts.SyntaxKind.HeritageClause:
                return createHeritageClause(node as import("npm:typescript").HeritageClause);
            case ts.SyntaxKind.CatchClause:
                return createCatchClause(node as import("npm:typescript").CatchClause);
            case ts.SyntaxKind.PropertyAssignment:
                return createPropertyAssignment(node as import("npm:typescript").PropertyAssignment);
            case ts.SyntaxKind.ShorthandPropertyAssignment:
                return createShorthandPropertyAssignment(node as import("npm:typescript").ShorthandPropertyAssignment);
            case ts.SyntaxKind.SpreadAssignment:
                return createSpreadAssignment(node as import("npm:typescript").SpreadAssignment);
            case ts.SyntaxKind.EnumMember:
                return createEnumMember(node as import("npm:typescript").EnumMember);
            case ts.SyntaxKind.CommaListExpression:
                return createCommaListExpression(node as import("npm:typescript").CommaListExpression);
            default:
                if (node.kind >= ts.SyntaxKind.FirstToken && node.kind <= ts.SyntaxKind.LastToken) {
                    writer.write("factory.createToken(ts.SyntaxKind.").write(syntaxKindToName[node.kind]).write(")");
                    return;
                }
                writer.write("/* Unhandled node kind: ").write(syntaxKindToName[node.kind]).write(" */")
        }
    }

    function writeNodeTextForTypeNode(node: import("npm:typescript").TypeNode) {
      return writeNodeText(node);
        // if (node.kind >= ts.SyntaxKind.FirstKeyword && node.kind <= ts.SyntaxKind.LastKeyword) {
        //     writer.write("factory.createKeywordTypeNode(ts.SyntaxKind.").write(syntaxKindToName[node.kind]).write(")");
        // }
        // else {
            
        // }
    }

    function createNumericLiteral(node: import("npm:typescript").NumericLiteral) {
        return parseFloat(node.text.toString())
    }

    function createBigIntLiteral(node: import("npm:typescript").BigIntLiteral) {
        return node.text.toString()
    }

    function createStringLiteral(node: import("npm:typescript").StringLiteral) {
        return node.text.toString()
    }

    function createRegularExpressionLiteral(node: import("npm:typescript").RegularExpressionLiteral) {
        writer.write("factory.createRegularExpressionLiteral(");
        writer.quote(node.text.toString())
        writer.write(")");
    }

    function createIdentifier(node: import("npm:typescript").Identifier) {
      return node.text.toString()
    }

    function createPrivateIdentifier(node: import("npm:typescript").PrivateIdentifier) {
        writer.write("factory.createPrivateIdentifier(");
        writer.quote(node.text.toString())
        writer.write(")");
    }

    function createSuper(node: import("npm:typescript").SuperExpression) {
        writer.write("factory.createSuper(");
        writer.write(")");
    }

    function createThis(node: import("npm:typescript").ThisExpression) {
        writer.write("factory.createThis(");
        writer.write(")");
    }

    function createNull(node: import("npm:typescript").NullLiteral) {
        return null
    }

    function createTrue(node: import("npm:typescript").TrueLiteral) {
      return true
    }

    function createFalse(node: import("npm:typescript").FalseLiteral) {
      return false
    }

    function createQualifiedName(node: import("npm:typescript").QualifiedName) {
        writer.write("factory.createQualifiedName(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.left)
            writer.write(",").newLine();
            writeNodeText(node.right)
        });
        writer.write(")");
    }

    function createComputedPropertyName(node: import("npm:typescript").ComputedPropertyName) {
        writer.write("factory.createComputedPropertyName(");
        writeNodeText(node.expression)
        writer.write(")");
    }

    function createTypeParameterDeclaration(node: import("npm:typescript").TypeParameterDeclaration) {
        writer.write("factory.createTypeParameterDeclaration(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.name)
            writer.write(",").newLine();
            if (node.constraint == null)
                writer.write("undefined");
            else {
                writeNodeTextForTypeNode(node.constraint)
            }
            writer.write(",").newLine();
            if (node.default == null)
                writer.write("undefined");
            else {
                writeNodeTextForTypeNode(node.default)
            }
        });
        writer.write(")");
    }

    function createParameterDeclaration(node: import("npm:typescript").ParameterDeclaration) {
        writer.write("factory.createParameterDeclaration(");
        writer.newLine();
        writer.indent(() => {
            if (node.decorators == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.decorators.length === 1) {
                    const item = node.decorators![0];
                    writeNodeText(item)
                }
                else if (node.decorators.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.decorators!.length; i++) {
                            const item = node.decorators![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.modifiers == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.modifiers.length === 1) {
                    const item = node.modifiers![0];
                    writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                }
                else if (node.modifiers.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.modifiers!.length; i++) {
                            const item = node.modifiers![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.dotDotDotToken == null)
                writer.write("undefined");
            else {
                writeNodeText(node.dotDotDotToken)
            }
            writer.write(",").newLine();
            writeNodeText(node.name)
            writer.write(",").newLine();
            if (node.questionToken == null)
                writer.write("undefined");
            else {
                writeNodeText(node.questionToken)
            }
            writer.write(",").newLine();
            if (node.type == null)
                writer.write("undefined");
            else {
                writeNodeTextForTypeNode(node.type)
            }
            writer.write(",").newLine();
            if (node.initializer == null)
                writer.write("undefined");
            else {
                writeNodeText(node.initializer)
            }
        });
        writer.write(")");
    }

    function createDecorator(node: import("npm:typescript").Decorator) {
        writer.write("factory.createDecorator(");
        writeNodeText(node.expression)
        writer.write(")");
    }

    function createPropertySignature(node: import("npm:typescript").PropertySignature) {
      // console.log(node)
      return {
        name: writeNodeText(node.name),
        question: node.questionToken ? true : false,
        type: writeNodeTextForTypeNode(node.type)
      }
    }

    function createPropertyDeclaration(node: import("npm:typescript").PropertyDeclaration) {
        writer.write("factory.createPropertyDeclaration(");
        writer.newLine();
        writer.indent(() => {
            if (node.decorators == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.decorators.length === 1) {
                    const item = node.decorators![0];
                    writeNodeText(item)
                }
                else if (node.decorators.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.decorators!.length; i++) {
                            const item = node.decorators![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.modifiers == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.modifiers.length === 1) {
                    const item = node.modifiers![0];
                    writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                }
                else if (node.modifiers.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.modifiers!.length; i++) {
                            const item = node.modifiers![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writeNodeText(node.name)
            writer.write(",").newLine();
            if (node.questionToken != null)
                writer.write("factory.createToken(ts.SyntaxKind.QuestionToken)");
            else if (node.exclamationToken != null)
                writer.write("factory.createToken(ts.SyntaxKind.ExclamationToken)");
            else
                writer.write("undefined");
            writer.write(",").newLine();
            if (node.type == null)
                writer.write("undefined");
            else {
                writeNodeTextForTypeNode(node.type)
            }
            writer.write(",").newLine();
            if (node.initializer == null)
                writer.write("undefined");
            else {
                writeNodeText(node.initializer)
            }
        });
        writer.write(")");
    }

    function createMethodSignature(node: import("npm:typescript").MethodSignature) {
        writer.write("factory.createMethodSignature(");
        writer.newLine();
        writer.indent(() => {
            if (node.modifiers == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.modifiers.length === 1) {
                    const item = node.modifiers![0];
                    writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                }
                else if (node.modifiers.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.modifiers!.length; i++) {
                            const item = node.modifiers![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writeNodeText(node.name)
            writer.write(",").newLine();
            if (node.questionToken == null)
                writer.write("undefined");
            else {
                writeNodeText(node.questionToken)
            }
            writer.write(",").newLine();
            if (node.typeParameters == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.typeParameters.length === 1) {
                    const item = node.typeParameters![0];
                    writeNodeText(item)
                }
                else if (node.typeParameters.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.typeParameters!.length; i++) {
                            const item = node.typeParameters![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writer.write("[");
            if (node.parameters.length === 1) {
                const item = node.parameters![0];
                writeNodeText(item)
            }
            else if (node.parameters.length > 1) {
                writer.indent(() => {
                    for (let i = 0; i < node.parameters!.length; i++) {
                        const item = node.parameters![i];
                        if (i > 0)
                            writer.write(",").newLine();
                        writeNodeText(item)
                    }
                });
            }
            writer.write("]");
            writer.write(",").newLine();
            if (node.type == null)
                writer.write("undefined");
            else {
                writeNodeTextForTypeNode(node.type)
            }
        });
        writer.write(")");
    }

    function createMethodDeclaration(node: import("npm:typescript").MethodDeclaration) {
        writer.write("factory.createMethodDeclaration(");
        writer.newLine();
        writer.indent(() => {
            if (node.decorators == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.decorators.length === 1) {
                    const item = node.decorators![0];
                    writeNodeText(item)
                }
                else if (node.decorators.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.decorators!.length; i++) {
                            const item = node.decorators![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.modifiers == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.modifiers.length === 1) {
                    const item = node.modifiers![0];
                    writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                }
                else if (node.modifiers.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.modifiers!.length; i++) {
                            const item = node.modifiers![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.asteriskToken == null)
                writer.write("undefined");
            else {
                writeNodeText(node.asteriskToken)
            }
            writer.write(",").newLine();
            writeNodeText(node.name)
            writer.write(",").newLine();
            if (node.questionToken == null)
                writer.write("undefined");
            else {
                writeNodeText(node.questionToken)
            }
            writer.write(",").newLine();
            if (node.typeParameters == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.typeParameters.length === 1) {
                    const item = node.typeParameters![0];
                    writeNodeText(item)
                }
                else if (node.typeParameters.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.typeParameters!.length; i++) {
                            const item = node.typeParameters![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writer.write("[");
            if (node.parameters.length === 1) {
                const item = node.parameters![0];
                writeNodeText(item)
            }
            else if (node.parameters.length > 1) {
                writer.indent(() => {
                    for (let i = 0; i < node.parameters!.length; i++) {
                        const item = node.parameters![i];
                        if (i > 0)
                            writer.write(",").newLine();
                        writeNodeText(item)
                    }
                });
            }
            writer.write("]");
            writer.write(",").newLine();
            if (node.type == null)
                writer.write("undefined");
            else {
                writeNodeTextForTypeNode(node.type)
            }
            writer.write(",").newLine();
            if (node.body == null)
                writer.write("undefined");
            else {
                writeNodeText(node.body)
            }
        });
        writer.write(")");
    }

    function createConstructorDeclaration(node: import("npm:typescript").ConstructorDeclaration) {
        writer.write("factory.createConstructorDeclaration(");
        writer.newLine();
        writer.indent(() => {
            if (node.decorators == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.decorators.length === 1) {
                    const item = node.decorators![0];
                    writeNodeText(item)
                }
                else if (node.decorators.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.decorators!.length; i++) {
                            const item = node.decorators![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.modifiers == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.modifiers.length === 1) {
                    const item = node.modifiers![0];
                    writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                }
                else if (node.modifiers.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.modifiers!.length; i++) {
                            const item = node.modifiers![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writer.write("[");
            if (node.parameters.length === 1) {
                const item = node.parameters![0];
                writeNodeText(item)
            }
            else if (node.parameters.length > 1) {
                writer.indent(() => {
                    for (let i = 0; i < node.parameters!.length; i++) {
                        const item = node.parameters![i];
                        if (i > 0)
                            writer.write(",").newLine();
                        writeNodeText(item)
                    }
                });
            }
            writer.write("]");
            writer.write(",").newLine();
            if (node.body == null)
                writer.write("undefined");
            else {
                writeNodeText(node.body)
            }
        });
        writer.write(")");
    }

    function createGetAccessorDeclaration(node: import("npm:typescript").GetAccessorDeclaration) {
        writer.write("factory.createGetAccessorDeclaration(");
        writer.newLine();
        writer.indent(() => {
            if (node.decorators == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.decorators.length === 1) {
                    const item = node.decorators![0];
                    writeNodeText(item)
                }
                else if (node.decorators.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.decorators!.length; i++) {
                            const item = node.decorators![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.modifiers == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.modifiers.length === 1) {
                    const item = node.modifiers![0];
                    writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                }
                else if (node.modifiers.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.modifiers!.length; i++) {
                            const item = node.modifiers![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writeNodeText(node.name)
            writer.write(",").newLine();
            writer.write("[");
            if (node.parameters.length === 1) {
                const item = node.parameters![0];
                writeNodeText(item)
            }
            else if (node.parameters.length > 1) {
                writer.indent(() => {
                    for (let i = 0; i < node.parameters!.length; i++) {
                        const item = node.parameters![i];
                        if (i > 0)
                            writer.write(",").newLine();
                        writeNodeText(item)
                    }
                });
            }
            writer.write("]");
            writer.write(",").newLine();
            if (node.type == null)
                writer.write("undefined");
            else {
                writeNodeTextForTypeNode(node.type)
            }
            writer.write(",").newLine();
            if (node.body == null)
                writer.write("undefined");
            else {
                writeNodeText(node.body)
            }
        });
        writer.write(")");
    }

    function createSetAccessorDeclaration(node: import("npm:typescript").SetAccessorDeclaration) {
        writer.write("factory.createSetAccessorDeclaration(");
        writer.newLine();
        writer.indent(() => {
            if (node.decorators == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.decorators.length === 1) {
                    const item = node.decorators![0];
                    writeNodeText(item)
                }
                else if (node.decorators.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.decorators!.length; i++) {
                            const item = node.decorators![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.modifiers == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.modifiers.length === 1) {
                    const item = node.modifiers![0];
                    writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                }
                else if (node.modifiers.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.modifiers!.length; i++) {
                            const item = node.modifiers![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writeNodeText(node.name)
            writer.write(",").newLine();
            writer.write("[");
            if (node.parameters.length === 1) {
                const item = node.parameters![0];
                writeNodeText(item)
            }
            else if (node.parameters.length > 1) {
                writer.indent(() => {
                    for (let i = 0; i < node.parameters!.length; i++) {
                        const item = node.parameters![i];
                        if (i > 0)
                            writer.write(",").newLine();
                        writeNodeText(item)
                    }
                });
            }
            writer.write("]");
            writer.write(",").newLine();
            if (node.body == null)
                writer.write("undefined");
            else {
                writeNodeText(node.body)
            }
        });
        writer.write(")");
    }

    function createCallSignature(node: import("npm:typescript").CallSignatureDeclaration) {
        writer.write("factory.createCallSignature(");
        writer.newLine();
        writer.indent(() => {
            if (node.typeParameters == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.typeParameters.length === 1) {
                    const item = node.typeParameters![0];
                    writeNodeText(item)
                }
                else if (node.typeParameters.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.typeParameters!.length; i++) {
                            const item = node.typeParameters![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writer.write("[");
            if (node.parameters.length === 1) {
                const item = node.parameters![0];
                writeNodeText(item)
            }
            else if (node.parameters.length > 1) {
                writer.indent(() => {
                    for (let i = 0; i < node.parameters!.length; i++) {
                        const item = node.parameters![i];
                        if (i > 0)
                            writer.write(",").newLine();
                        writeNodeText(item)
                    }
                });
            }
            writer.write("]");
            writer.write(",").newLine();
            if (node.type == null)
                writer.write("undefined");
            else {
                writeNodeTextForTypeNode(node.type)
            }
        });
        writer.write(")");
    }

    function createConstructSignature(node: import("npm:typescript").ConstructSignatureDeclaration) {
        writer.write("factory.createConstructSignature(");
        writer.newLine();
        writer.indent(() => {
            if (node.typeParameters == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.typeParameters.length === 1) {
                    const item = node.typeParameters![0];
                    writeNodeText(item)
                }
                else if (node.typeParameters.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.typeParameters!.length; i++) {
                            const item = node.typeParameters![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writer.write("[");
            if (node.parameters.length === 1) {
                const item = node.parameters![0];
                writeNodeText(item)
            }
            else if (node.parameters.length > 1) {
                writer.indent(() => {
                    for (let i = 0; i < node.parameters!.length; i++) {
                        const item = node.parameters![i];
                        if (i > 0)
                            writer.write(",").newLine();
                        writeNodeText(item)
                    }
                });
            }
            writer.write("]");
            writer.write(",").newLine();
            if (node.type == null)
                writer.write("undefined");
            else {
                writeNodeTextForTypeNode(node.type)
            }
        });
        writer.write(")");
    }

    function createIndexSignature(node: import("npm:typescript").IndexSignatureDeclaration) {
        writer.write("factory.createIndexSignature(");
        writer.newLine();
        writer.indent(() => {
            if (node.decorators == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.decorators.length === 1) {
                    const item = node.decorators![0];
                    writeNodeText(item)
                }
                else if (node.decorators.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.decorators!.length; i++) {
                            const item = node.decorators![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.modifiers == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.modifiers.length === 1) {
                    const item = node.modifiers![0];
                    writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                }
                else if (node.modifiers.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.modifiers!.length; i++) {
                            const item = node.modifiers![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writer.write("[");
            if (node.parameters.length === 1) {
                const item = node.parameters![0];
                writeNodeText(item)
            }
            else if (node.parameters.length > 1) {
                writer.indent(() => {
                    for (let i = 0; i < node.parameters!.length; i++) {
                        const item = node.parameters![i];
                        if (i > 0)
                            writer.write(",").newLine();
                        writeNodeText(item)
                    }
                });
            }
            writer.write("]");
            writer.write(",").newLine();
            writeNodeTextForTypeNode(node.type)
        });
        writer.write(")");
    }

    function createTemplateLiteralTypeSpan(node: import("npm:typescript").TemplateLiteralTypeSpan) {
        writer.write("factory.createTemplateLiteralTypeSpan(");
        writer.newLine();
        writer.indent(() => {
            writeNodeTextForTypeNode(node.type)
            writer.write(",").newLine();
            writeNodeText(node.literal)
        });
        writer.write(")");
    }

    function createClassStaticBlockDeclaration(node: import("npm:typescript").ClassStaticBlockDeclaration) {
        writer.write("factory.createClassStaticBlockDeclaration(");
        writer.newLine();
        writer.indent(() => {
            if (node.decorators == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.decorators.length === 1) {
                    const item = node.decorators![0];
                    writeNodeText(item)
                }
                else if (node.decorators.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.decorators!.length; i++) {
                            const item = node.decorators![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.modifiers == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.modifiers.length === 1) {
                    const item = node.modifiers![0];
                    writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                }
                else if (node.modifiers.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.modifiers!.length; i++) {
                            const item = node.modifiers![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writeNodeText(node.body)
        });
        writer.write(")");
    }

    function createKeywordTypeNode(node: import("npm:typescript").KeywordTypeNode) {
      return {
        type: 'keyword',
        typeArgs: [ syntaxKindToName[node.kind].replace('Keyword', '') ]
      }
        // writer.write("factory.createKeywordTypeNode(");
        // writer.write("ts.SyntaxKind.").write(syntaxKindToName[node.kind])
        // writer.write(")");
    }

    function createTypeReferenceNode(node: import("npm:typescript").TypeReferenceNode) {
      const data = {
        type: writeNodeText(node.typeName),
        typeArgs: (node.typeArguments ?? []).map(v=>writeNodeText(v))
      }

      return data
    }

    function createFunctionTypeNode(node: import("npm:typescript").FunctionTypeNode) {
        writer.write("factory.createFunctionTypeNode(");
        writer.newLine();
        writer.indent(() => {
            if (node.typeParameters == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.typeParameters.length === 1) {
                    const item = node.typeParameters![0];
                    writeNodeText(item)
                }
                else if (node.typeParameters.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.typeParameters!.length; i++) {
                            const item = node.typeParameters![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writer.write("[");
            if (node.parameters.length === 1) {
                const item = node.parameters![0];
                writeNodeText(item)
            }
            else if (node.parameters.length > 1) {
                writer.indent(() => {
                    for (let i = 0; i < node.parameters!.length; i++) {
                        const item = node.parameters![i];
                        if (i > 0)
                            writer.write(",").newLine();
                        writeNodeText(item)
                    }
                });
            }
            writer.write("]");
            writer.write(",").newLine();
            writeNodeTextForTypeNode(node.type)
        });
        writer.write(")");
    }

    function createConstructorTypeNode(node: import("npm:typescript").ConstructorTypeNode) {
        writer.write("factory.createConstructorTypeNode(");
        writer.newLine();
        writer.indent(() => {
            if (node.modifiers == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.modifiers.length === 1) {
                    const item = node.modifiers![0];
                    writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                }
                else if (node.modifiers.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.modifiers!.length; i++) {
                            const item = node.modifiers![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.typeParameters == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.typeParameters.length === 1) {
                    const item = node.typeParameters![0];
                    writeNodeText(item)
                }
                else if (node.typeParameters.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.typeParameters!.length; i++) {
                            const item = node.typeParameters![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writer.write("[");
            if (node.parameters.length === 1) {
                const item = node.parameters![0];
                writeNodeText(item)
            }
            else if (node.parameters.length > 1) {
                writer.indent(() => {
                    for (let i = 0; i < node.parameters!.length; i++) {
                        const item = node.parameters![i];
                        if (i > 0)
                            writer.write(",").newLine();
                        writeNodeText(item)
                    }
                });
            }
            writer.write("]");
            writer.write(",").newLine();
            writeNodeTextForTypeNode(node.type)
        });
        writer.write(")");
    }

    function createTypeQueryNode(node: import("npm:typescript").TypeQueryNode) {
        writer.write("factory.createTypeQueryNode(");
        writeNodeText(node.exprName)
        writer.write(")");
    }

    function createTypeLiteralNode(node: import("npm:typescript").TypeLiteralNode) {
      // console.log(node, (node.members ?? []).map(v=>writeNodeTextForTypeNode(v)))
      return {
        type: 'typeLiteral',
        members: Object.fromEntries((node.members ?? []).map(v=>writeNodeTextForTypeNode(v)).map(v=>[v.name, v]))
      }
    }

    function createArrayTypeNode(node: import("npm:typescript").ArrayTypeNode) {
      return {
        type: "array",
        typeArgs: [writeNodeTextForTypeNode(node.elementType)]
      }
    }

    function createTupleTypeNode(node: import("npm:typescript").TupleTypeNode) {
      return {
        type: "tuple",
        typeArgs: (node.elements ?? []).map(v=>writeNodeText(v))
      }
    }

    function createNamedTupleMember(node: import("npm:typescript").NamedTupleMember) {
        writer.write("factory.createNamedTupleMember(");
        writer.newLine();
        writer.indent(() => {
            if (node.dotDotDotToken == null)
                writer.write("undefined");
            else {
                writeNodeText(node.dotDotDotToken)
            }
            writer.write(",").newLine();
            writeNodeText(node.name)
            writer.write(",").newLine();
            if (node.questionToken == null)
                writer.write("undefined");
            else {
                writeNodeText(node.questionToken)
            }
            writer.write(",").newLine();
            writeNodeTextForTypeNode(node.type)
        });
        writer.write(")");
    }

    function createOptionalTypeNode(node: import("npm:typescript").OptionalTypeNode) {
        writer.write("factory.createOptionalTypeNode(");
        writeNodeTextForTypeNode(node.type)
        writer.write(")");
    }

    function createRestTypeNode(node: import("npm:typescript").RestTypeNode) {
        writer.write("factory.createRestTypeNode(");
        writeNodeTextForTypeNode(node.type)
        writer.write(")");
    }

    function createUnionTypeNode(node: import("npm:typescript").UnionTypeNode) {
      return {
        type: 'union',
        typeArgs: (node.types ?? []).map(v=>writeNodeTextForTypeNode(v))
      }
    }

    function createIntersectionTypeNode(node: import("npm:typescript").IntersectionTypeNode) {
        writer.write("factory.createIntersectionTypeNode(");
        writer.write("[");
        if (node.types.length === 1) {
            const item = node.types![0];
            writeNodeTextForTypeNode(item)
        }
        else if (node.types.length > 1) {
            writer.indent(() => {
                for (let i = 0; i < node.types!.length; i++) {
                    const item = node.types![i];
                    if (i > 0)
                        writer.write(",").newLine();
                    writeNodeTextForTypeNode(item)
                }
            });
        }
        writer.write("]");
        writer.write(")");
    }

    function createConditionalTypeNode(node: import("npm:typescript").ConditionalTypeNode) {
        writer.write("factory.createConditionalTypeNode(");
        writer.newLine();
        writer.indent(() => {
            writeNodeTextForTypeNode(node.checkType)
            writer.write(",").newLine();
            writeNodeTextForTypeNode(node.extendsType)
            writer.write(",").newLine();
            writeNodeTextForTypeNode(node.trueType)
            writer.write(",").newLine();
            writeNodeTextForTypeNode(node.falseType)
        });
        writer.write(")");
    }

    function createInferTypeNode(node: import("npm:typescript").InferTypeNode) {
        writer.write("factory.createInferTypeNode(");
        writeNodeText(node.typeParameter)
        writer.write(")");
    }

    function createImportTypeNode(node: import("npm:typescript").ImportTypeNode) {
        writer.write("factory.createImportTypeNode(");
        writer.newLine();
        writer.indent(() => {
            writeNodeTextForTypeNode(node.argument)
            writer.write(",").newLine();
            if (node.qualifier == null)
                writer.write("undefined");
            else {
                writeNodeText(node.qualifier)
            }
            writer.write(",").newLine();
            if (node.typeArguments == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.typeArguments.length === 1) {
                    const item = node.typeArguments![0];
                    writeNodeTextForTypeNode(item)
                }
                else if (node.typeArguments.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.typeArguments!.length; i++) {
                            const item = node.typeArguments![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeTextForTypeNode(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writer.write(node.isTypeOf.toString())
        });
        writer.write(")");
    }

    function createParenthesizedType(node: import("npm:typescript").ParenthesizedTypeNode) {
        writer.write("factory.createParenthesizedType(");
        writeNodeTextForTypeNode(node.type)
        writer.write(")");
    }

    function createThisTypeNode(node: import("npm:typescript").ThisTypeNode) {
        writer.write("factory.createThisTypeNode(");
        writer.write(")");
    }

    function createTypeOperatorNode(node: import("npm:typescript").TypeOperatorNode) {
        writer.write("factory.createTypeOperatorNode(");
        writer.newLine();
        writer.indent(() => {
            writer.write("ts.SyntaxKind.").write(syntaxKindToName[node.operator])
            writer.write(",").newLine();
            writeNodeTextForTypeNode(node.type)
        });
        writer.write(")");
    }

    function createIndexedAccessTypeNode(node: import("npm:typescript").IndexedAccessTypeNode) {
        writer.write("factory.createIndexedAccessTypeNode(");
        writer.newLine();
        writer.indent(() => {
            writeNodeTextForTypeNode(node.objectType)
            writer.write(",").newLine();
            writeNodeTextForTypeNode(node.indexType)
        });
        writer.write(")");
    }

    function createMappedTypeNode(node: import("npm:typescript").MappedTypeNode) {
        writer.write("factory.createMappedTypeNode(");
        writer.newLine();
        writer.indent(() => {
            if (node.readonlyToken == null)
                writer.write("undefined");
            else {
                writeNodeText(node.readonlyToken)
            }
            writer.write(",").newLine();
            writeNodeText(node.typeParameter)
            writer.write(",").newLine();
            if (node.nameType == null)
                writer.write("undefined");
            else {
                writeNodeTextForTypeNode(node.nameType)
            }
            writer.write(",").newLine();
            if (node.questionToken == null)
                writer.write("undefined");
            else {
                writeNodeText(node.questionToken)
            }
            writer.write(",").newLine();
            if (node.type == null)
                writer.write("undefined");
            else {
                writeNodeTextForTypeNode(node.type)
            }
            writer.write(",").newLine();
            if (node.members == null)
                writer.write("undefined");
            else {
                writer.write("/* unknown */")
            }
        });
        writer.write(")");
    }

    function createLiteralTypeNode(node: import("npm:typescript").LiteralTypeNode) {
        return writeNodeText(node.literal)
    }

    function createTemplateLiteralType(node: import("npm:typescript").TemplateLiteralTypeNode) {
        writer.write("factory.createTemplateLiteralType(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.head)
            writer.write(",").newLine();
            writer.write("[");
            if (node.templateSpans.length === 1) {
                const item = node.templateSpans![0];
                writeNodeText(item)
            }
            else if (node.templateSpans.length > 1) {
                writer.indent(() => {
                    for (let i = 0; i < node.templateSpans!.length; i++) {
                        const item = node.templateSpans![i];
                        if (i > 0)
                            writer.write(",").newLine();
                        writeNodeText(item)
                    }
                });
            }
            writer.write("]");
        });
        writer.write(")");
    }

    function createObjectBindingPattern(node: import("npm:typescript").ObjectBindingPattern) {
        writer.write("factory.createObjectBindingPattern(");
        writer.write("[");
        if (node.elements.length === 1) {
            const item = node.elements![0];
            writeNodeText(item)
        }
        else if (node.elements.length > 1) {
            writer.indent(() => {
                for (let i = 0; i < node.elements!.length; i++) {
                    const item = node.elements![i];
                    if (i > 0)
                        writer.write(",").newLine();
                    writeNodeText(item)
                }
            });
        }
        writer.write("]");
        writer.write(")");
    }

    function createArrayBindingPattern(node: import("npm:typescript").ArrayBindingPattern) {
        writer.write("factory.createArrayBindingPattern(");
        writer.write("[");
        if (node.elements.length === 1) {
            const item = node.elements![0];
            writeNodeText(item)
        }
        else if (node.elements.length > 1) {
            writer.indent(() => {
                for (let i = 0; i < node.elements!.length; i++) {
                    const item = node.elements![i];
                    if (i > 0)
                        writer.write(",").newLine();
                    writeNodeText(item)
                }
            });
        }
        writer.write("]");
        writer.write(")");
    }

    function createBindingElement(node: import("npm:typescript").BindingElement) {
        writer.write("factory.createBindingElement(");
        writer.newLine();
        writer.indent(() => {
            if (node.dotDotDotToken == null)
                writer.write("undefined");
            else {
                writeNodeText(node.dotDotDotToken)
            }
            writer.write(",").newLine();
            if (node.propertyName == null)
                writer.write("undefined");
            else {
                writeNodeText(node.propertyName)
            }
            writer.write(",").newLine();
            writeNodeText(node.name)
            writer.write(",").newLine();
            if (node.initializer == null)
                writer.write("undefined");
            else {
                writeNodeText(node.initializer)
            }
        });
        writer.write(")");
    }

    function createArrayLiteralExpression(node: import("npm:typescript").ArrayLiteralExpression) {
        writer.write("factory.createArrayLiteralExpression(");
        writer.newLine();
        writer.indent(() => {
            writer.write("[");
            if (node.elements.length === 1) {
                const item = node.elements![0];
                writeNodeText(item)
            }
            else if (node.elements.length > 1) {
                writer.indent(() => {
                    for (let i = 0; i < node.elements!.length; i++) {
                        const item = node.elements![i];
                        if (i > 0)
                            writer.write(",").newLine();
                        writeNodeText(item)
                    }
                });
            }
            writer.write("]");
            writer.write(",").newLine();
            writer.write(((node as any).multiLine || false).toString())
        });
        writer.write(")");
    }

    function createObjectLiteralExpression(node: import("npm:typescript").ObjectLiteralExpression) {
        writer.write("factory.createObjectLiteralExpression(");
        writer.newLine();
        writer.indent(() => {
            writer.write("[");
            if (node.properties.length === 1) {
                const item = node.properties![0];
                writeNodeText(item)
            }
            else if (node.properties.length > 1) {
                writer.indent(() => {
                    for (let i = 0; i < node.properties!.length; i++) {
                        const item = node.properties![i];
                        if (i > 0)
                            writer.write(",").newLine();
                        writeNodeText(item)
                    }
                });
            }
            writer.write("]");
            writer.write(",").newLine();
            writer.write(((node as any).multiLine || false).toString())
        });
        writer.write(")");
    }

    function createPropertyAccessExpression(node: import("npm:typescript").PropertyAccessExpression) {
        writer.write("factory.createPropertyAccessExpression(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.expression)
            writer.write(",").newLine();
            writeNodeText(node.name)
        });
        writer.write(")");
    }

    function createPropertyAccessChain(node: import("npm:typescript").PropertyAccessChain) {
        writer.write("factory.createPropertyAccessChain(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.expression)
            writer.write(",").newLine();
            if (node.questionDotToken == null)
                writer.write("undefined");
            else {
                writeNodeText(node.questionDotToken)
            }
            writer.write(",").newLine();
            writeNodeText(node.name)
        });
        writer.write(")");
    }

    function createElementAccessExpression(node: import("npm:typescript").ElementAccessExpression) {
        writer.write("factory.createElementAccessExpression(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.expression)
            writer.write(",").newLine();
            writeNodeText(node.argumentExpression)
        });
        writer.write(")");
    }

    function createElementAccessChain(node: import("npm:typescript").ElementAccessChain) {
        writer.write("factory.createElementAccessChain(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.expression)
            writer.write(",").newLine();
            if (node.questionDotToken == null)
                writer.write("undefined");
            else {
                writeNodeText(node.questionDotToken)
            }
            writer.write(",").newLine();
            writeNodeText(node.argumentExpression)
        });
        writer.write(")");
    }

    function createCallExpression(node: import("npm:typescript").CallExpression) {
        writer.write("factory.createCallExpression(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.expression)
            writer.write(",").newLine();
            if (node.typeArguments == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.typeArguments.length === 1) {
                    const item = node.typeArguments![0];
                    writeNodeTextForTypeNode(item)
                }
                else if (node.typeArguments.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.typeArguments!.length; i++) {
                            const item = node.typeArguments![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeTextForTypeNode(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writer.write("[");
            if (node.arguments.length === 1) {
                const item = node.arguments![0];
                writeNodeText(item)
            }
            else if (node.arguments.length > 1) {
                writer.indent(() => {
                    for (let i = 0; i < node.arguments!.length; i++) {
                        const item = node.arguments![i];
                        if (i > 0)
                            writer.write(",").newLine();
                        writeNodeText(item)
                    }
                });
            }
            writer.write("]");
        });
        writer.write(")");
    }

    function createCallChain(node: import("npm:typescript").CallChain) {
        writer.write("factory.createCallChain(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.expression)
            writer.write(",").newLine();
            if (node.questionDotToken == null)
                writer.write("undefined");
            else {
                writeNodeText(node.questionDotToken)
            }
            writer.write(",").newLine();
            if (node.typeArguments == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.typeArguments.length === 1) {
                    const item = node.typeArguments![0];
                    writeNodeTextForTypeNode(item)
                }
                else if (node.typeArguments.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.typeArguments!.length; i++) {
                            const item = node.typeArguments![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeTextForTypeNode(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writer.write("[");
            if (node.arguments.length === 1) {
                const item = node.arguments![0];
                writeNodeText(item)
            }
            else if (node.arguments.length > 1) {
                writer.indent(() => {
                    for (let i = 0; i < node.arguments!.length; i++) {
                        const item = node.arguments![i];
                        if (i > 0)
                            writer.write(",").newLine();
                        writeNodeText(item)
                    }
                });
            }
            writer.write("]");
        });
        writer.write(")");
    }

    function createNewExpression(node: import("npm:typescript").NewExpression) {
        writer.write("factory.createNewExpression(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.expression)
            writer.write(",").newLine();
            if (node.typeArguments == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.typeArguments.length === 1) {
                    const item = node.typeArguments![0];
                    writeNodeTextForTypeNode(item)
                }
                else if (node.typeArguments.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.typeArguments!.length; i++) {
                            const item = node.typeArguments![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeTextForTypeNode(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.arguments == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.arguments.length === 1) {
                    const item = node.arguments![0];
                    writeNodeText(item)
                }
                else if (node.arguments.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.arguments!.length; i++) {
                            const item = node.arguments![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
        });
        writer.write(")");
    }

    function createTaggedTemplateExpression(node: import("npm:typescript").TaggedTemplateExpression) {
        writer.write("factory.createTaggedTemplateExpression(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.tag)
            writer.write(",").newLine();
            if (node.typeArguments == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.typeArguments.length === 1) {
                    const item = node.typeArguments![0];
                    writeNodeTextForTypeNode(item)
                }
                else if (node.typeArguments.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.typeArguments!.length; i++) {
                            const item = node.typeArguments![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeTextForTypeNode(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writeNodeText(node.template)
        });
        writer.write(")");
    }

    function createTypeAssertion(node: import("npm:typescript").TypeAssertion) {
        writer.write("factory.createTypeAssertion(");
        writer.newLine();
        writer.indent(() => {
            writeNodeTextForTypeNode(node.type)
            writer.write(",").newLine();
            writeNodeText(node.expression)
        });
        writer.write(")");
    }

    function createParenthesizedExpression(node: import("npm:typescript").ParenthesizedExpression) {
        writer.write("factory.createParenthesizedExpression(");
        writeNodeText(node.expression)
        writer.write(")");
    }

    function createFunctionExpression(node: import("npm:typescript").FunctionExpression) {
        writer.write("factory.createFunctionExpression(");
        writer.newLine();
        writer.indent(() => {
            if (node.modifiers == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.modifiers.length === 1) {
                    const item = node.modifiers![0];
                    writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                }
                else if (node.modifiers.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.modifiers!.length; i++) {
                            const item = node.modifiers![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.asteriskToken == null)
                writer.write("undefined");
            else {
                writeNodeText(node.asteriskToken)
            }
            writer.write(",").newLine();
            if (node.name == null)
                writer.write("undefined");
            else {
                writeNodeText(node.name)
            }
            writer.write(",").newLine();
            if (node.typeParameters == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.typeParameters.length === 1) {
                    const item = node.typeParameters![0];
                    writeNodeText(item)
                }
                else if (node.typeParameters.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.typeParameters!.length; i++) {
                            const item = node.typeParameters![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writer.write("[");
            if (node.parameters.length === 1) {
                const item = node.parameters![0];
                writeNodeText(item)
            }
            else if (node.parameters.length > 1) {
                writer.indent(() => {
                    for (let i = 0; i < node.parameters!.length; i++) {
                        const item = node.parameters![i];
                        if (i > 0)
                            writer.write(",").newLine();
                        writeNodeText(item)
                    }
                });
            }
            writer.write("]");
            writer.write(",").newLine();
            if (node.type == null)
                writer.write("undefined");
            else {
                writeNodeTextForTypeNode(node.type)
            }
            writer.write(",").newLine();
            writeNodeText(node.body)
        });
        writer.write(")");
    }

    function createArrowFunction(node: import("npm:typescript").ArrowFunction) {
        writer.write("factory.createArrowFunction(");
        writer.newLine();
        writer.indent(() => {
            if (node.modifiers == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.modifiers.length === 1) {
                    const item = node.modifiers![0];
                    writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                }
                else if (node.modifiers.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.modifiers!.length; i++) {
                            const item = node.modifiers![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.typeParameters == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.typeParameters.length === 1) {
                    const item = node.typeParameters![0];
                    writeNodeText(item)
                }
                else if (node.typeParameters.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.typeParameters!.length; i++) {
                            const item = node.typeParameters![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writer.write("[");
            if (node.parameters.length === 1) {
                const item = node.parameters![0];
                writeNodeText(item)
            }
            else if (node.parameters.length > 1) {
                writer.indent(() => {
                    for (let i = 0; i < node.parameters!.length; i++) {
                        const item = node.parameters![i];
                        if (i > 0)
                            writer.write(",").newLine();
                        writeNodeText(item)
                    }
                });
            }
            writer.write("]");
            writer.write(",").newLine();
            if (node.type == null)
                writer.write("undefined");
            else {
                writeNodeTextForTypeNode(node.type)
            }
            writer.write(",").newLine();
            writeNodeText(node.equalsGreaterThanToken)
            writer.write(",").newLine();
            writeNodeText(node.body)
        });
        writer.write(")");
    }

    function createDeleteExpression(node: import("npm:typescript").DeleteExpression) {
        writer.write("factory.createDeleteExpression(");
        writeNodeText(node.expression)
        writer.write(")");
    }

    function createTypeOfExpression(node: import("npm:typescript").TypeOfExpression) {
        writer.write("factory.createTypeOfExpression(");
        writeNodeText(node.expression)
        writer.write(")");
    }

    function createVoidExpression(node: import("npm:typescript").VoidExpression) {
        writer.write("factory.createVoidExpression(");
        writeNodeText(node.expression)
        writer.write(")");
    }

    function createAwaitExpression(node: import("npm:typescript").AwaitExpression) {
        writer.write("factory.createAwaitExpression(");
        writeNodeText(node.expression)
        writer.write(")");
    }

    function createPrefixUnaryExpression(node: import("npm:typescript").PrefixUnaryExpression) {
        writer.write("factory.createPrefixUnaryExpression(");
        writer.newLine();
        writer.indent(() => {
            writer.write("ts.SyntaxKind.").write(syntaxKindToName[node.operator])
            writer.write(",").newLine();
            writeNodeText(node.operand)
        });
        writer.write(")");
    }

    function createPostfixUnaryExpression(node: import("npm:typescript").PostfixUnaryExpression) {
        writer.write("factory.createPostfixUnaryExpression(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.operand)
            writer.write(",").newLine();
            writer.write("ts.SyntaxKind.").write(syntaxKindToName[node.operator])
        });
        writer.write(")");
    }

    function createBinaryExpression(node: import("npm:typescript").BinaryExpression) {
        writer.write("factory.createBinaryExpression(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.left)
            writer.write(",").newLine();
            writeNodeText(node.operatorToken)
            writer.write(",").newLine();
            writeNodeText(node.right)
        });
        writer.write(")");
    }

    function createConditionalExpression(node: import("npm:typescript").ConditionalExpression) {
        writer.write("factory.createConditionalExpression(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.condition)
            writer.write(",").newLine();
            writeNodeText(node.questionToken)
            writer.write(",").newLine();
            writeNodeText(node.whenTrue)
            writer.write(",").newLine();
            writeNodeText(node.colonToken)
            writer.write(",").newLine();
            writeNodeText(node.whenFalse)
        });
        writer.write(")");
    }

    function createTemplateExpression(node: import("npm:typescript").TemplateExpression) {
        writer.write("factory.createTemplateExpression(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.head)
            writer.write(",").newLine();
            writer.write("[");
            if (node.templateSpans.length === 1) {
                const item = node.templateSpans![0];
                writeNodeText(item)
            }
            else if (node.templateSpans.length > 1) {
                writer.indent(() => {
                    for (let i = 0; i < node.templateSpans!.length; i++) {
                        const item = node.templateSpans![i];
                        if (i > 0)
                            writer.write(",").newLine();
                        writeNodeText(item)
                    }
                });
            }
            writer.write("]");
        });
        writer.write(")");
    }

    function createTemplateHead(node: import("npm:typescript").TemplateHead) {
        writer.write("factory.createTemplateHead(");
        writer.newLine();
        writer.indent(() => {
            writer.quote(node.text.toString())
            writer.write(",").newLine();
            if (node.rawText == null)
                writer.write("undefined");
            else {
                writer.quote(node.rawText.toString())
            }
        });
        writer.write(")");
    }

    function createTemplateMiddle(node: import("npm:typescript").TemplateMiddle) {
        writer.write("factory.createTemplateMiddle(");
        writer.newLine();
        writer.indent(() => {
            writer.quote(node.text.toString())
            writer.write(",").newLine();
            if (node.rawText == null)
                writer.write("undefined");
            else {
                writer.quote(node.rawText.toString())
            }
        });
        writer.write(")");
    }

    function createTemplateTail(node: import("npm:typescript").TemplateTail) {
        writer.write("factory.createTemplateTail(");
        writer.newLine();
        writer.indent(() => {
            writer.quote(node.text.toString())
            writer.write(",").newLine();
            if (node.rawText == null)
                writer.write("undefined");
            else {
                writer.quote(node.rawText.toString())
            }
        });
        writer.write(")");
    }

    function createNoSubstitutionTemplateLiteral(node: import("npm:typescript").NoSubstitutionTemplateLiteral) {
        writer.write("factory.createNoSubstitutionTemplateLiteral(");
        writer.newLine();
        writer.indent(() => {
            writer.quote(node.text.toString())
            writer.write(",").newLine();
            if (node.rawText == null)
                writer.write("undefined");
            else {
                writer.quote(node.rawText.toString())
            }
        });
        writer.write(")");
    }

    function createYieldExpression(node: import("npm:typescript").YieldExpression) {
        writer.write("factory.createYieldExpression(");
        writer.newLine();
        writer.indent(() => {
            if (node.asteriskToken == null)
                writer.write("undefined");
            else {
                writeNodeText(node.asteriskToken)
            }
            writer.write(",").newLine();
            if (node.expression == null)
                writer.write("undefined");
            else {
                writeNodeText(node.expression)
            }
        });
        writer.write(")");
    }

    function createSpreadElement(node: import("npm:typescript").SpreadElement) {
        writer.write("factory.createSpreadElement(");
        writeNodeText(node.expression)
        writer.write(")");
    }

    function createClassExpression(node: import("npm:typescript").ClassExpression) {
        writer.write("factory.createClassExpression(");
        writer.newLine();
        writer.indent(() => {
            if (node.decorators == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.decorators.length === 1) {
                    const item = node.decorators![0];
                    writeNodeText(item)
                }
                else if (node.decorators.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.decorators!.length; i++) {
                            const item = node.decorators![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.modifiers == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.modifiers.length === 1) {
                    const item = node.modifiers![0];
                    writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                }
                else if (node.modifiers.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.modifiers!.length; i++) {
                            const item = node.modifiers![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.name == null)
                writer.write("undefined");
            else {
                writeNodeText(node.name)
            }
            writer.write(",").newLine();
            if (node.typeParameters == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.typeParameters.length === 1) {
                    const item = node.typeParameters![0];
                    writeNodeText(item)
                }
                else if (node.typeParameters.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.typeParameters!.length; i++) {
                            const item = node.typeParameters![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.heritageClauses == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.heritageClauses.length === 1) {
                    const item = node.heritageClauses![0];
                    writeNodeText(item)
                }
                else if (node.heritageClauses.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.heritageClauses!.length; i++) {
                            const item = node.heritageClauses![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writer.write("[");
            if (node.members.length === 1) {
                const item = node.members![0];
                writeNodeText(item)
            }
            else if (node.members.length > 1) {
                writer.indent(() => {
                    for (let i = 0; i < node.members!.length; i++) {
                        const item = node.members![i];
                        if (i > 0)
                            writer.write(",").newLine();
                        writeNodeText(item)
                    }
                });
            }
            writer.write("]");
        });
        writer.write(")");
    }

    function createOmittedExpression(node: import("npm:typescript").OmittedExpression) {
        writer.write("factory.createOmittedExpression(");
        writer.write(")");
    }

    function createExpressionWithTypeArguments(node: import("npm:typescript").ExpressionWithTypeArguments) {
        return {
            type: writeNodeText(node.expression),
            typeArgs: node.typeArguments.map(v=>writeNodeTextForTypeNode(v))
        }
        // writer.write("factory.createExpressionWithTypeArguments(");
        // writer.newLine();
        // writer.indent(() => {
        //     writeNodeText(node.expression)
        //     writer.write(",").newLine();
        //     if (node.typeArguments == null)
        //         writer.write("undefined");
        //     else {
        //         writer.write("[");
        //         if (node.typeArguments.length === 1) {
        //             const item = node.typeArguments![0];
        //             writeNodeTextForTypeNode(item)
        //         }
        //         else if (node.typeArguments.length > 1) {
        //             writer.indent(() => {
        //                 for (let i = 0; i < node.typeArguments!.length; i++) {
        //                     const item = node.typeArguments![i];
        //                     if (i > 0)
        //                         writer.write(",").newLine();
        //                     writeNodeTextForTypeNode(item)
        //                 }
        //             });
        //         }
        //         writer.write("]");
        //     }
        // });
        // writer.write(")");
    }

    function createAsExpression(node: import("npm:typescript").AsExpression) {
        writer.write("factory.createAsExpression(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.expression)
            writer.write(",").newLine();
            writeNodeTextForTypeNode(node.type)
        });
        writer.write(")");
    }

    function createNonNullExpression(node: import("npm:typescript").NonNullExpression) {
        writer.write("factory.createNonNullExpression(");
        writeNodeText(node.expression)
        writer.write(")");
    }

    function createNonNullChain(node: import("npm:typescript").NonNullChain) {
        writer.write("factory.createNonNullChain(");
        writeNodeText(node.expression)
        writer.write(")");
    }

    function createMetaProperty(node: import("npm:typescript").MetaProperty) {
        writer.write("factory.createMetaProperty(");
        writer.newLine();
        writer.indent(() => {
            writer.write("ts.SyntaxKind.").write(syntaxKindToName[node.keywordToken])
            writer.write(",").newLine();
            writeNodeText(node.name)
        });
        writer.write(")");
    }

    function createTemplateSpan(node: import("npm:typescript").TemplateSpan) {
        writer.write("factory.createTemplateSpan(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.expression)
            writer.write(",").newLine();
            writeNodeText(node.literal)
        });
        writer.write(")");
    }

    function createSemicolonClassElement(node: import("npm:typescript").SemicolonClassElement) {
        writer.write("factory.createSemicolonClassElement(");
        writer.write(")");
    }

    function createBlock(node: import("npm:typescript").Block) {
        writer.write("factory.createBlock(");
        writer.newLine();
        writer.indent(() => {
            writer.write("[");
            if (node.statements.length === 1) {
                const item = node.statements![0];
                writeNodeText(item)
            }
            else if (node.statements.length > 1) {
                writer.indent(() => {
                    for (let i = 0; i < node.statements!.length; i++) {
                        const item = node.statements![i];
                        if (i > 0)
                            writer.write(",").newLine();
                        writeNodeText(item)
                    }
                });
            }
            writer.write("]");
            writer.write(",").newLine();
            writer.write(((node as any).multiLine || false).toString())
        });
        writer.write(")");
    }

    function createVariableStatement(node: import("npm:typescript").VariableStatement) {
        writer.write("factory.createVariableStatement(");
        writer.newLine();
        writer.indent(() => {
            if (node.modifiers == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.modifiers.length === 1) {
                    const item = node.modifiers![0];
                    writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                }
                else if (node.modifiers.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.modifiers!.length; i++) {
                            const item = node.modifiers![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writeNodeText(node.declarationList)
        });
        writer.write(")");
    }

    function createEmptyStatement(node: import("npm:typescript").EmptyStatement) {
        writer.write("factory.createEmptyStatement(");
        writer.write(")");
    }

    function createExpressionStatement(node: import("npm:typescript").ExpressionStatement) {
        writer.write("factory.createExpressionStatement(");
        writeNodeText(node.expression)
        writer.write(")");
    }

    function createIfStatement(node: import("npm:typescript").IfStatement) {
        writer.write("factory.createIfStatement(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.expression)
            writer.write(",").newLine();
            writeNodeText(node.thenStatement)
            writer.write(",").newLine();
            if (node.elseStatement == null)
                writer.write("undefined");
            else {
                writeNodeText(node.elseStatement)
            }
        });
        writer.write(")");
    }

    function createDoStatement(node: import("npm:typescript").DoStatement) {
        writer.write("factory.createDoStatement(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.statement)
            writer.write(",").newLine();
            writeNodeText(node.expression)
        });
        writer.write(")");
    }

    function createWhileStatement(node: import("npm:typescript").WhileStatement) {
        writer.write("factory.createWhileStatement(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.expression)
            writer.write(",").newLine();
            writeNodeText(node.statement)
        });
        writer.write(")");
    }

    function createForStatement(node: import("npm:typescript").ForStatement) {
        writer.write("factory.createForStatement(");
        writer.newLine();
        writer.indent(() => {
            if (node.initializer == null)
                writer.write("undefined");
            else {
                writeNodeText(node.initializer)
            }
            writer.write(",").newLine();
            if (node.condition == null)
                writer.write("undefined");
            else {
                writeNodeText(node.condition)
            }
            writer.write(",").newLine();
            if (node.incrementor == null)
                writer.write("undefined");
            else {
                writeNodeText(node.incrementor)
            }
            writer.write(",").newLine();
            writeNodeText(node.statement)
        });
        writer.write(")");
    }

    function createForInStatement(node: import("npm:typescript").ForInStatement) {
        writer.write("factory.createForInStatement(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.initializer)
            writer.write(",").newLine();
            writeNodeText(node.expression)
            writer.write(",").newLine();
            writeNodeText(node.statement)
        });
        writer.write(")");
    }

    function createForOfStatement(node: import("npm:typescript").ForOfStatement) {
        writer.write("factory.createForOfStatement(");
        writer.newLine();
        writer.indent(() => {
            if (node.awaitModifier == null)
                writer.write("undefined");
            else {
                writeNodeText(node.awaitModifier)
            }
            writer.write(",").newLine();
            writeNodeText(node.initializer)
            writer.write(",").newLine();
            writeNodeText(node.expression)
            writer.write(",").newLine();
            writeNodeText(node.statement)
        });
        writer.write(")");
    }

    function createContinueStatement(node: import("npm:typescript").ContinueStatement) {
        writer.write("factory.createContinueStatement(");
        if (node.label == null)
            writer.write("undefined");
        else {
            writeNodeText(node.label)
        }
        writer.write(")");
    }

    function createBreakStatement(node: import("npm:typescript").BreakStatement) {
        writer.write("factory.createBreakStatement(");
        if (node.label == null)
            writer.write("undefined");
        else {
            writeNodeText(node.label)
        }
        writer.write(")");
    }

    function createReturnStatement(node: import("npm:typescript").ReturnStatement) {
        writer.write("factory.createReturnStatement(");
        if (node.expression == null)
            writer.write("undefined");
        else {
            writeNodeText(node.expression)
        }
        writer.write(")");
    }

    function createWithStatement(node: import("npm:typescript").WithStatement) {
        writer.write("factory.createWithStatement(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.expression)
            writer.write(",").newLine();
            writeNodeText(node.statement)
        });
        writer.write(")");
    }

    function createSwitchStatement(node: import("npm:typescript").SwitchStatement) {
        writer.write("factory.createSwitchStatement(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.expression)
            writer.write(",").newLine();
            writeNodeText(node.caseBlock)
        });
          ; }

    function createLabeledStatement(node: import("npm:typescript").LabeledStatement) {
        writer.write("factory.createLabeledStatement(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.label)
            writer.write(",").newLine();
            writeNodeText(node.statement)
        });
        writer.write(")");
    }

    function createThrowStatement(node: import("npm:typescript").ThrowStatement) {
        writer.write("factory.createThrowStatement(");
        writeNodeText(node.expression)
        writer.write(")");
    }

    function createTryStatement(node: import("npm:typescript").TryStatement) {
        writer.write("factory.createTryStatement(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.tryBlock)
            writer.write(",").newLine();
            if (node.catchClause == null)
                writer.write("undefined");
            else {
                writeNodeText(node.catchClause)
            }
            writer.write(",").newLine();
            if (node.finallyBlock == null)
                writer.write("undefined");
            else {
                writeNodeText(node.finallyBlock)
            }
        });
        writer.write(")");
    }

    function createDebuggerStatement(node: import("npm:typescript").DebuggerStatement) {
        writer.write("factory.createDebuggerStatement(");
        writer.write(")");
    }

    function createVariableDeclaration(node: import("npm:typescript").VariableDeclaration) {
        writer.write("factory.createVariableDeclaration(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.name)
            writer.write(",").newLine();
            if (node.exclamationToken == null)
                writer.write("undefined");
            else {
                writeNodeText(node.exclamationToken)
            }
            writer.write(",").newLine();
            if (node.type == null)
                writer.write("undefined");
            else {
                writeNodeTextForTypeNode(node.type)
            }
            writer.write(",").newLine();
            if (node.initializer == null)
                writer.write("undefined");
            else {
                writeNodeText(node.initializer)
            }
        });
        writer.write(")");
    }

    function createVariableDeclarationList(node: import("npm:typescript").VariableDeclarationList) {
        writer.write("factory.createVariableDeclarationList(");
        writer.newLine();
        writer.indent(() => {
            writer.write("[");
            if (node.declarations.length === 1) {
                const item = node.declarations![0];
                writeNodeText(item)
            }
            else if (node.declarations.length > 1) {
                writer.indent(() => {
                    for (let i = 0; i < node.declarations!.length; i++) {
                        const item = node.declarations![i];
                        if (i > 0)
                            writer.write(",").newLine();
                        writeNodeText(item)
                    }
                });
            }
            writer.write("]");
            writer.write(",").newLine();
            writer.write(getNodeFlagValues(node.flags || 0));
        });
        writer.write(")");
    }

    function createFunctionDeclaration(node: import("npm:typescript").FunctionDeclaration) {
        writer.write("factory.createFunctionDeclaration(");
        writer.newLine();
        writer.indent(() => {
            if (node.decorators == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.decorators.length === 1) {
                    const item = node.decorators![0];
                    writeNodeText(item)
                }
                else if (node.decorators.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.decorators!.length; i++) {
                            const item = node.decorators![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.modifiers == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.modifiers.length === 1) {
                    const item = node.modifiers![0];
                    writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                }
                else if (node.modifiers.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.modifiers!.length; i++) {
                            const item = node.modifiers![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.asteriskToken == null)
                writer.write("undefined");
            else {
                writeNodeText(node.asteriskToken)
            }
            writer.write(",").newLine();
            if (node.name == null)
                writer.write("undefined");
            else {
                writeNodeText(node.name)
            }
            writer.write(",").newLine();
            if (node.typeParameters == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.typeParameters.length === 1) {
                    const item = node.typeParameters![0];
                    writeNodeText(item)
                }
                else if (node.typeParameters.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.typeParameters!.length; i++) {
                            const item = node.typeParameters![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writer.write("[");
            if (node.parameters.length === 1) {
                const item = node.parameters![0];
                writeNodeText(item)
            }
            else if (node.parameters.length > 1) {
                writer.indent(() => {
                    for (let i = 0; i < node.parameters!.length; i++) {
                        const item = node.parameters![i];
                        if (i > 0)
                            writer.write(",").newLine();
                        writeNodeText(item)
                    }
                });
            }
            writer.write("]");
            writer.write(",").newLine();
            if (node.type == null)
                writer.write("undefined");
            else {
                writeNodeTextForTypeNode(node.type)
            }
            writer.write(",").newLine();
            if (node.body == null)
                writer.write("undefined");
            else {
                writeNodeText(node.body)
            }
        });
        writer.write(")");
    }

    function createClassDeclaration(node: import("npm:typescript").ClassDeclaration) {
        writer.write("factory.createClassDeclaration(");
        writer.newLine();
        writer.indent(() => {
            if (node.decorators == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.decorators.length === 1) {
                    const item = node.decorators![0];
                    writeNodeText(item)
                }
                else if (node.decorators.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.decorators!.length; i++) {
                            const item = node.decorators![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.modifiers == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.modifiers.length === 1) {
                    const item = node.modifiers![0];
                    writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                }
                else if (node.modifiers.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.modifiers!.length; i++) {
                            const item = node.modifiers![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.name == null)
                writer.write("undefined");
            else {
                writeNodeText(node.name)
            }
            writer.write(",").newLine();
            if (node.typeParameters == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.typeParameters.length === 1) {
                    const item = node.typeParameters![0];
                    writeNodeText(item)
                }
                else if (node.typeParameters.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.typeParameters!.length; i++) {
                            const item = node.typeParameters![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.heritageClauses == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.heritageClauses.length === 1) {
                    const item = node.heritageClauses![0];
                    writeNodeText(item)
                }
                else if (node.heritageClauses.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.heritageClauses!.length; i++) {
                            const item = node.heritageClauses![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writer.write("[");
            if (node.members.length === 1) {
                const item = node.members![0];
                writeNodeText(item)
            }
            else if (node.members.length > 1) {
                writer.indent(() => {
                    for (let i = 0; i < node.members!.length; i++) {
                        const item = node.members![i];
                        if (i > 0)
                            writer.write(",").newLine();
                        writeNodeText(item)
                    }
                });
            }
            writer.write("]");
        });
        writer.write(")");
    }

    function createInterfaceDeclaration(node: import("npm:typescript").InterfaceDeclaration) {
        // console.log()
      return {
        name: writeNodeText(node.name),
        extends: node.heritageClauses?.map(v=>writeNodeText(v)),
        members: Object.fromEntries((node.members ?? []).map(v=>writeNodeText(v)).map(v=>[v.name, v]))
      }
      // node.typeParameters
    }

    function createTypeAliasDeclaration(node: import("npm:typescript").TypeAliasDeclaration) {
        return {
            name: writeNodeText(node.name),
            type: writeNodeTextForTypeNode(node.type)
        }
    }

    function createEnumDeclaration(node: import("npm:typescript").EnumDeclaration) {
        writer.write("factory.createEnumDeclaration(");
        writer.newLine();
        writer.indent(() => {
            if (node.decorators == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.decorators.length === 1) {
                    const item = node.decorators![0];
                    writeNodeText(item)
                }
                else if (node.decorators.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.decorators!.length; i++) {
                            const item = node.decorators![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.modifiers == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.modifiers.length === 1) {
                    const item = node.modifiers![0];
                    writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                }
                else if (node.modifiers.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.modifiers!.length; i++) {
                            const item = node.modifiers![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writeNodeText(node.name)
            writer.write(",").newLine();
            writer.write("[");
            if (node.members.length === 1) {
                const item = node.members![0];
                writeNodeText(item)
            }
            else if (node.members.length > 1) {
                writer.indent(() => {
                    for (let i = 0; i < node.members!.length; i++) {
                        const item = node.members![i];
                        if (i > 0)
                            writer.write(",").newLine();
                        writeNodeText(item)
                    }
                });
            }
            writer.write("]");
        });
        writer.write(")");
    }

    function createModuleDeclaration(node: import("npm:typescript").ModuleDeclaration) {
        writer.write("factory.createModuleDeclaration(");
        writer.newLine();
        writer.indent(() => {
            if (node.decorators == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.decorators.length === 1) {
                    const item = node.decorators![0];
                    writeNodeText(item)
                }
                else if (node.decorators.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.decorators!.length; i++) {
                            const item = node.decorators![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.modifiers == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.modifiers.length === 1) {
                    const item = node.modifiers![0];
                    writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                }
                else if (node.modifiers.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.modifiers!.length; i++) {
                            const item = node.modifiers![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writeNodeText(node.name)
            writer.write(",").newLine();
            if (node.body == null)
                writer.write("undefined");
            else {
                writeNodeText(node.body)
            }
            writer.write(",").newLine();
            writer.write(getNodeFlagValues(node.flags || 0));
        });
        writer.write(")");
    }

    function createModuleBlock(node: import("npm:typescript").ModuleBlock) {
        writer.write("factory.createModuleBlock(");
        writer.write("[");
        if (node.statements.length === 1) {
            const item = node.statements![0];
            writeNodeText(item)
        }
        else if (node.statements.length > 1) {
            writer.indent(() => {
                for (let i = 0; i < node.statements!.length; i++) {
                    const item = node.statements![i];
                    if (i > 0)
                        writer.write(",").newLine();
                    writeNodeText(item)
                }
            });
        }
        writer.write("]");
        writer.write(")");
    }

    function createNamespaceExportDeclaration(node: import("npm:typescript").NamespaceExportDeclaration) {
        writer.write("factory.createNamespaceExportDeclaration(");
        writeNodeText(node.name)
        writer.write(")");
    }

    function createImportEqualsDeclaration(node: import("npm:typescript").ImportEqualsDeclaration) {
        writer.write("factory.createImportEqualsDeclaration(");
        writer.newLine();
        writer.indent(() => {
            if (node.decorators == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.decorators.length === 1) {
                    const item = node.decorators![0];
                    writeNodeText(item)
                }
                else if (node.decorators.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.decorators!.length; i++) {
                            const item = node.decorators![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.modifiers == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.modifiers.length === 1) {
                    const item = node.modifiers![0];
                    writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                }
                else if (node.modifiers.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.modifiers!.length; i++) {
                            const item = node.modifiers![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writer.write(node.isTypeOnly.toString())
            writer.write(",").newLine();
            writeNodeText(node.name)
            writer.write(",").newLine();
            writeNodeText(node.moduleReference)
        });
        writer.write(")");
    }

    function createImportDeclaration(node: import("npm:typescript").ImportDeclaration) {
        writer.write("factory.createImportDeclaration(");
        writer.newLine();
        writer.indent(() => {
            if (node.decorators == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.decorators.length === 1) {
                    const item = node.decorators![0];
                    writeNodeText(item)
                }
                else if (node.decorators.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.decorators!.length; i++) {
                            const item = node.decorators![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.modifiers == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.modifiers.length === 1) {
                    const item = node.modifiers![0];
                    writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                }
                else if (node.modifiers.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.modifiers!.length; i++) {
                            const item = node.modifiers![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.importClause == null)
                writer.write("undefined");
            else {
                writeNodeText(node.importClause)
            }
            writer.write(",").newLine();
            writeNodeText(node.moduleSpecifier)
            writer.write(",").newLine();
            if (node.assertClause == null)
                writer.write("undefined");
            else {
                writeNodeText(node.assertClause)
            }
        });
        writer.write(")");
    }

    function createImportClause(node: import("npm:typescript").ImportClause) {
        writer.write("factory.createImportClause(");
        writer.newLine();
        writer.indent(() => {
            writer.write(node.isTypeOnly.toString())
            writer.write(",").newLine();
            if (node.name == null)
                writer.write("undefined");
            else {
                writeNodeText(node.name)
            }
            writer.write(",").newLine();
            if (node.namedBindings == null)
                writer.write("undefined");
            else {
                writeNodeText(node.namedBindings)
            }
        });
        writer.write(")");
    }

    function createAssertClause(node: import("npm:typescript").AssertClause) {
        writer.write("factory.createAssertClause(");
        writer.newLine();
        writer.indent(() => {
            writer.write("/* unknown */")
            writer.write(",").newLine();
            if (node.multiLine == null)
                writer.write("undefined");
            else {
                writer.write(node.multiLine.toString())
            }
        });
        writer.write(")");
    }

    function createAssertEntry(node: import("npm:typescript").AssertEntry) {
        writer.write("factory.createAssertEntry(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.name)
            writer.write(",").newLine();
            writeNodeText(node.value)
        });
        writer.write(")");
    }

    function createNamespaceImport(node: import("npm:typescript").NamespaceImport) {
        writer.write("factory.createNamespaceImport(");
        writeNodeText(node.name)
        writer.write(")");
    }

    function createNamespaceExport(node: import("npm:typescript").NamespaceExport) {
        writer.write("factory.createNamespaceExport(");
        writeNodeText(node.name)
        writer.write(")");
    }

    function createNamedImports(node: import("npm:typescript").NamedImports) {
        writer.write("factory.createNamedImports(");
        writer.write("[");
        if (node.elements.length === 1) {
            const item = node.elements![0];
            writeNodeText(item)
        }
        else if (node.elements.length > 1) {
            writer.indent(() => {
                for (let i = 0; i < node.elements!.length; i++) {
                    const item = node.elements![i];
                    if (i > 0)
                        writer.write(",").newLine();
                    writeNodeText(item)
                }
            });
        }
        writer.write("]");
        writer.write(")");
    }

    function createImportSpecifier(node: import("npm:typescript").ImportSpecifier) {
        writer.write("factory.createImportSpecifier(");
        writer.newLine();
        writer.indent(() => {
            writer.write(node.isTypeOnly.toString())
            writer.write(",").newLine();
            if (node.propertyName == null)
                writer.write("undefined");
            else {
                writeNodeText(node.propertyName)
            }
            writer.write(",").newLine();
            writeNodeText(node.name)
        });
        writer.write(")");
    }

    function createExportAssignment(node: import("npm:typescript").ExportAssignment) {
        writer.write("factory.createExportAssignment(");
        writer.newLine();
        writer.indent(() => {
            if (node.decorators == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.decorators.length === 1) {
                    const item = node.decorators![0];
                    writeNodeText(item)
                }
                else if (node.decorators.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.decorators!.length; i++) {
                            const item = node.decorators![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.modifiers == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.modifiers.length === 1) {
                    const item = node.modifiers![0];
                    writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                }
                else if (node.modifiers.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.modifiers!.length; i++) {
                            const item = node.modifiers![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.isExportEquals == null)
                writer.write("undefined");
            else {
                writer.write(node.isExportEquals.toString())
            }
            writer.write(",").newLine();
            writeNodeText(node.expression)
        });
        writer.write(")");
    }

    function createExportDeclaration(node: import("npm:typescript").ExportDeclaration) {
        writer.write("factory.createExportDeclaration(");
        writer.newLine();
        writer.indent(() => {
            if (node.decorators == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.decorators.length === 1) {
                    const item = node.decorators![0];
                    writeNodeText(item)
                }
                else if (node.decorators.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.decorators!.length; i++) {
                            const item = node.decorators![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeText(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            if (node.modifiers == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.modifiers.length === 1) {
                    const item = node.modifiers![0];
                    writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                }
                else if (node.modifiers.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.modifiers!.length; i++) {
                            const item = node.modifiers![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writer.write("factory.createModifier(ts.SyntaxKind." + syntaxKindToName[item.kind] + ")");
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writer.write(node.isTypeOnly.toString())
            writer.write(",").newLine();
            if (node.exportClause == null)
                writer.write("undefined");
            else {
                writeNodeText(node.exportClause)
            }
            writer.write(",").newLine();
            if (node.moduleSpecifier == null)
                writer.write("undefined");
            else {
                writeNodeText(node.moduleSpecifier)
            }
            writer.write(",").newLine();
            if (node.assertClause == null)
                writer.write("undefined");
            else {
                writeNodeText(node.assertClause)
            }
        });
        writer.write(")");
    }

    function createNamedExports(node: import("npm:typescript").NamedExports) {
        writer.write("factory.createNamedExports(");
        writer.write("[");
        if (node.elements.length === 1) {
            const item = node.elements![0];
            writeNodeText(item)
        }
        else if (node.elements.length > 1) {
            writer.indent(() => {
                for (let i = 0; i < node.elements!.length; i++) {
                    const item = node.elements![i];
                    if (i > 0)
                        writer.write(",").newLine();
                    writeNodeText(item)
                }
            });
        }
        writer.write("]");
        writer.write(")");
    }

    function createExportSpecifier(node: import("npm:typescript").ExportSpecifier) {
        writer.write("factory.createExportSpecifier(");
        writer.newLine();
        writer.indent(() => {
            writer.write(node.isTypeOnly.toString())
            writer.write(",").newLine();
            if (node.propertyName == null)
                writer.write("undefined");
            else {
                writeNodeText(node.propertyName)
            }
            writer.write(",").newLine();
            writeNodeText(node.name)
        });
        writer.write(")");
    }

    function createExternalModuleReference(node: import("npm:typescript").ExternalModuleReference) {
        writer.write("factory.createExternalModuleReference(");
        writeNodeText(node.expression)
        writer.write(")");
    }

    function createJsxElement(node: import("npm:typescript").JsxElement) {
        writer.write("factory.createJsxElement(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.openingElement)
            writer.write(",").newLine();
            writer.write("[");
            if (node.children.length === 1) {
                const item = node.children![0];
                writeNodeText(item)
            }
            else if (node.children.length > 1) {
                writer.indent(() => {
                    for (let i = 0; i < node.children!.length; i++) {
                        const item = node.children![i];
                        if (i > 0)
                            writer.write(",").newLine();
                        writeNodeText(item)
                    }
                });
            }
            writer.write("]");
            writer.write(",").newLine();
            writeNodeText(node.closingElement)
        });
        writer.write(")");
    }

    function createJsxSelfClosingElement(node: import("npm:typescript").JsxSelfClosingElement) {
        writer.write("factory.createJsxSelfClosingElement(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.tagName)
            writer.write(",").newLine();
            if (node.typeArguments == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.typeArguments.length === 1) {
                    const item = node.typeArguments![0];
                    writeNodeTextForTypeNode(item)
                }
                else if (node.typeArguments.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.typeArguments!.length; i++) {
                            const item = node.typeArguments![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeTextForTypeNode(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writeNodeText(node.attributes)
        });
        writer.write(")");
    }

    function createJsxOpeningElement(node: import("npm:typescript").JsxOpeningElement) {
        writer.write("factory.createJsxOpeningElement(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.tagName)
            writer.write(",").newLine();
            if (node.typeArguments == null)
                writer.write("undefined");
            else {
                writer.write("[");
                if (node.typeArguments.length === 1) {
                    const item = node.typeArguments![0];
                    writeNodeTextForTypeNode(item)
                }
                else if (node.typeArguments.length > 1) {
                    writer.indent(() => {
                        for (let i = 0; i < node.typeArguments!.length; i++) {
                            const item = node.typeArguments![i];
                            if (i > 0)
                                writer.write(",").newLine();
                            writeNodeTextForTypeNode(item)
                        }
                    });
                }
                writer.write("]");
            }
            writer.write(",").newLine();
            writeNodeText(node.attributes)
        });
        writer.write(")");
    }

    function createJsxClosingElement(node: import("npm:typescript").JsxClosingElement) {
        writer.write("factory.createJsxClosingElement(");
        writeNodeText(node.tagName)
        writer.write(")");
    }

    function createJsxFragment(node: import("npm:typescript").JsxFragment) {
        writer.write("factory.createJsxFragment(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.openingFragment)
            writer.write(",").newLine();
            writer.write("[");
            if (node.children.length === 1) {
                const item = node.children![0];
                writeNodeText(item)
            }
            else if (node.children.length > 1) {
                writer.indent(() => {
                    for (let i = 0; i < node.children!.length; i++) {
                        const item = node.children![i];
                        if (i > 0)
                            writer.write(",").newLine();
                        writeNodeText(item)
                    }
                });
            }
            writer.write("]");
            writer.write(",").newLine();
            writeNodeText(node.closingFragment)
        });
        writer.write(")");
    }

    function createJsxText(node: import("npm:typescript").JsxText) {
        writer.write("factory.createJsxText(");
        writer.newLine();
        writer.indent(() => {
            writer.quote(node.text.toString())
            writer.write(",").newLine();
            writer.write(node.containsOnlyTriviaWhiteSpaces.toString())
        });
        writer.write(")");
    }

    function createJsxOpeningFragment(node: import("npm:typescript").JsxOpeningFragment) {
        writer.write("factory.createJsxOpeningFragment(");
        writer.write(")");
    }

    function createJsxJsxClosingFragment(node: import("npm:typescript").JsxClosingFragment) {
        writer.write("factory.createJsxJsxClosingFragment(");
        writer.write(")");
    }

    function createJsxAttribute(node: import("npm:typescript").JsxAttribute) {
        writer.write("factory.createJsxAttribute(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.name)
            writer.write(",").newLine();
            if (node.initializer == null)
                writer.write("undefined");
            else {
                writeNodeText(node.initializer)
            }
        });
        writer.write(")");
    }

    function createJsxAttributes(node: import("npm:typescript").JsxAttributes) {
        writer.write("factory.createJsxAttributes(");
        writer.write("[");
        if (node.properties.length === 1) {
            const item = node.properties![0];
            writeNodeText(item)
        }
        else if (node.properties.length > 1) {
            writer.indent(() => {
                for (let i = 0; i < node.properties!.length; i++) {
                    const item = node.properties![i];
                    if (i > 0)
                        writer.write(",").newLine();
                    writeNodeText(item)
                }
            });
        }
        writer.write("]");
        writer.write(")");
    }

    function createJsxSpreadAttribute(node: import("npm:typescript").JsxSpreadAttribute) {
        writer.write("factory.createJsxSpreadAttribute(");
        writeNodeText(node.expression)
        writer.write(")");
    }

    function createJsxExpression(node: import("npm:typescript").JsxExpression) {
        writer.write("factory.createJsxExpression(");
        writer.newLine();
        writer.indent(() => {
            if (node.dotDotDotToken == null)
                writer.write("undefined");
            else {
                writeNodeText(node.dotDotDotToken)
            }
            writer.write(",").newLine();
            if (node.expression == null)
                writer.write("undefined");
            else {
                writeNodeText(node.expression)
            }
        });
        writer.write(")");
    }

    function createDefaultClause(node: import("npm:typescript").DefaultClause) {
        writer.write("factory.createDefaultClause(");
        writer.write("[");
        if (node.statements.length === 1) {
            const item = node.statements![0];
            writeNodeText(item)
        }
        else if (node.statements.length > 1) {
            writer.indent(() => {
                for (let i = 0; i < node.statements!.length; i++) {
                    const item = node.statements![i];
                    if (i > 0)
                        writer.write(",").newLine();
                    writeNodeText(item)
                }
            });
        }
        writer.write("]");
        writer.write(")");
    }

    function createHeritageClause(node: import("npm:typescript").HeritageClause) {
        return node.types.map(v=>writeNodeText(v))
        // writer.write("factory.createHeritageClause(");
        // writer.newLine();
        // writer.indent(() => {
            // writer.write("ts.SyntaxKind.").write(syntaxKindToName[node.token])
            // writer.write(",").newLine();
            // writer.write("[");
            // if (node.types.length === 1) {
            //     const item = node.types![0];
            //     writeNodeText(item)
            // }
            // else if (node.types.length > 1) {
            //     writer.indent(() => {
            //         for (let i = 0; i < node.types!.length; i++) {
            //             const item = node.types![i];
            //             if (i > 0)
            //                 writer.write(",").newLine();
            //             writeNodeText(item)
            //         }
            //     });
            // }
            // writer.write("]");
        // });
        // writer.write(")");
    }

    function createCatchClause(node: import("npm:typescript").CatchClause) {
        writer.write("factory.createCatchClause(");
        writer.newLine();
        writer.indent(() => {
            if (node.variableDeclaration == null)
                writer.write("undefined");
            else {
                writeNodeText(node.variableDeclaration)
            }
            writer.write(",").newLine();
            writeNodeText(node.block)
        });
        writer.write(")");
    }

    function createPropertyAssignment(node: import("npm:typescript").PropertyAssignment) {
        writer.write("factory.createPropertyAssignment(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.name)
            writer.write(",").newLine();
            writeNodeText(node.initializer)
        });
        writer.write(")");
    }

    function createShorthandPropertyAssignment(node: import("npm:typescript").ShorthandPropertyAssignment) {
        writer.write("factory.createShorthandPropertyAssignment(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.name)
            writer.write(",").newLine();
            if (node.objectAssignmentInitializer == null)
                writer.write("undefined");
            else {
                writeNodeText(node.objectAssignmentInitializer)
            }
        });
        writer.write(")");
    }

    function createSpreadAssignment(node: import("npm:typescript").SpreadAssignment) {
        writer.write("factory.createSpreadAssignment(");
        writeNodeText(node.expression)
        writer.write(")");
    }

    function createEnumMember(node: import("npm:typescript").EnumMember) {
        writer.write("factory.createEnumMember(");
        writer.newLine();
        writer.indent(() => {
            writeNodeText(node.name)
            writer.write(",").newLine();
            if (node.initializer == null)
                writer.write("undefined");
            else {
                writeNodeText(node.initializer)
            }
        });
        writer.write(")");
    }

    function createCommaListExpression(node: import("npm:typescript").CommaListExpression) {
        writer.write("factory.createCommaListExpression(");
        writer.write("[");
        if (node.elements.length === 1) {
            const item = node.elements![0];
            writeNodeText(item)
        }
        else if (node.elements.length > 1) {
            writer.indent(() => {
                for (let i = 0; i < node.elements!.length; i++) {
                    const item = node.elements![i];
                    if (i > 0)
                        writer.write(",").newLine();
                    writeNodeText(item)
                }
            });
        }
        writer.write("]");
        writer.write(")");
    }

    function createSyntaxKindToNameMap() {
        const map: { [kind: number]: string } = {};
        for (const name of Object.keys(ts.SyntaxKind).filter(k => isNaN(parseInt(k, 10)))) {
            const value = (ts.SyntaxKind as any)[name] as number;
            if (map[value] == null)
                map[value] = name;
        }
        return map;
    }

    function getNodeFlagValues(value: number) {
        // ignore the BlockScoped node flag
        return getFlagValuesAsString(ts.NodeFlags, "ts.NodeFlags", value || 0, "None", getFlagValues(ts.NodeFlags, value).filter(v => v !== ts.NodeFlags.BlockScoped));
    }

    function getFlagValuesAsString(enumObj: any, enumName: string, value: number, defaultName: string, flagValues?: number[]) {
        flagValues = flagValues || getFlagValues(enumObj, value);
        const members: string[] = [];
        for (const flagValue of flagValues)
            members.push(enumName + "." + enumObj[flagValue]);
        if (members.length === 0)
            members.push(enumName + "." + defaultName);
        return members.join(" | ");
    }

    function getFlagValues(enumObj: any, value: number) {
        const members: number[] = [];
        for (const prop in enumObj) {
            if (typeof enumObj[prop] === "string")
                continue;
            if ((enumObj[prop] & value) !== 0)
                members.push(enumObj[prop]);
        }
        return members;
    }
}
