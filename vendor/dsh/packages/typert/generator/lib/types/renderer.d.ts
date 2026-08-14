/**
 * Rendering and traversal over the compiler-independent TypeGraph. Emitters
 * use this module instead of reaching back into TypeScript AST nodes.
 * @module @deepseek-ai/dsh-typert-generator/renderer
 */
import type { MemberModel, SignatureModel, SymbolId, TypeDeclarationModel, TypeGraph, TypeNodeId, TypeNodeModel } from './model.ts';
/** Failure to render or traverse an internally inconsistent TypeGraph. */
export declare class TypeGraphRenderError extends Error {
    name: string;
}
/** Read and render one TypeGraph without compiler objects. */
export declare class TypeGraphRenderer {
    readonly graph: TypeGraph;
    private readonly nodes;
    private readonly declarations;
    private readonly members;
    private readonly parameterNames;
    /**
     * Index one complete graph.
     * @param graph - compiler-independent graph to render.
     */
    constructor(graph: TypeGraph);
    /**
     * Resolve a node id or fail with the broken edge.
     * @param id - graph-local type node id.
     * @returns the referenced node.
     */
    node(id: TypeNodeId): TypeNodeModel;
    /**
     * Resolve a declaration id or fail with the broken edge.
     * @param id - workspace symbol id.
     * @returns the referenced declaration.
     */
    declaration(id: SymbolId): TypeDeclarationModel;
    /**
     * Resolve a public member id.
     * @param id - declaration member id.
     * @returns the referenced member.
     */
    member(id: string): MemberModel;
    /**
     * Render one type expression from the retained source structure.
     * @param id - type node id.
     * @returns TypeScript type text.
     */
    renderType(id: TypeNodeId): string;
    /**
     * Render a callable signature without a member name.
     * @param signature - modeled signature.
     * @returns parameter list and return type.
     */
    renderSignature(signature: SignatureModel): string;
    /**
     * Render one class/interface member as a body-free declaration.
     * @param member - modeled member.
     * @param sourceModifiers - retain source-only modifiers for reflection text.
     * @returns one-line TypeScript member text.
     */
    renderMember(member: MemberModel, sourceModifiers?: boolean): string;
    /**
     * Render a named declaration without JSDoc.
     * @param id - declaration symbol id.
     * @returns exported TypeScript declaration text.
     */
    renderDeclaration(id: SymbolId): string;
    /**
     * Find the transitive declaration closure referenced by members.
     * @param memberIds - business-surface member ids.
     * @returns declarations in graph order, excluding no roots implicitly.
     */
    declarationClosureForMembers(memberIds: readonly string[]): TypeDeclarationModel[];
    /**
     * Find the transitive declaration closure referenced by type roots.
     * @param typeIds - graph type roots.
     * @returns declarations in graph order.
     */
    declarationClosureForTypes(typeIds: readonly TypeNodeId[]): TypeDeclarationModel[];
    private declarationClosure;
    private renderSignatureHead;
    private renderReturn;
    private renderParameter;
    private renderTypeParameters;
    private renderTypeParameter;
    private renderObject;
    private indexParameters;
}
//# sourceMappingURL=renderer.d.ts.map