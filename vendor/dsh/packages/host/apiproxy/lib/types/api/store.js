/**
 * store domain contract. Method signatures are the source of truth:
 * unary methods take the RpcRequest<P> narrow form and the impl echoes rpcId;
 * everything else references RequestPayload<'store.*'> / ResponseValue<'store.*'>.
 *
 * Wire shapes mirror the @dsh/store-core contract (BR-001): the platform
 * patch must not depend on the out-of-tree store plugin package, so the
 * payload entity types are re-declared here and stay shape-identical to
 * StoreService's results — `store.list`→list、`store.read`→read、
 * `store.write`→write、`store.history`→history、`store.search`→search、
 * `store.stat`→stat.
 */
export {};
//# sourceMappingURL=store.js.map