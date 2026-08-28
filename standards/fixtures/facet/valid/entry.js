// 合法 facet entry fixture：defineFacet 品牌默认导出 + setup 函数。
// 顶层零业务副作用、零上游依赖（facet-model §2.2），装载即通过。
export default {
  [Symbol.for('dsh-community-standard.facet-definition')]: true,
  name: 'fixture.valid',
  setup() {},
}
